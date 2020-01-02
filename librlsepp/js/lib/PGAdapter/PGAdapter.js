const _ = require('lodash')
  , fs = require('fs')
  , config = require('config')
  , pg = require('pg')
  , log4js = require('log4js')
  , log = require ('ololog')
  , Interface = require('interface')
  , Storable = require('../storable').Storable
  , OrderBook = require('../orderbook').OrderBook
  , OrderBooks = require('../orderbook').OrderBooks
  , JSON = require('JSON')
;

const logger = log4js.getLogger('file');

var _pgPoolHandles = {};
class PGAdapter {
  static getHandleInstance(connStr) {
    if (_pgPoolHandles[connStr] == null) {
      logger.debug("new pg.Pool handle "+connStr);
      _pgPoolHandles[connStr] = new pg.Pool({ connectionString: connStr }); 
    }
      
    return _pgPoolHandles[connStr];
  };

  //  factory pattern utility function
  //
  static create(settings) {
//    if (_singleton != null)
//      return _singleton;

    let self = null;
    try {
      self = new PGAdapter(settings);
    } catch (rejectedValue) {
      logger.error("PGAdapter borked, ",rejectedValue);
      throw rejectedValue;
    }
//    _singleton = self;
    return self;
  };

  static createInit(candleWriterEventCB, settings) {
//    if (PGAdapter._singleton != null)
//      return _singleton;

    let self = PGAdapter.create(settings);
//    _singleton = self;

    self.init(candleWriterEventCB, settings)
    return self;
  };

  constructor (settings) {
    this.plugin_config = settings
    this.exchange = settings.exchange;
    this.table = [];
    this.database = this.plugin_config.database
    this.schema = this.plugin_config.schema
    this.connectionString = this.plugin_config.connectionString
    this.handlePool = null;
    this.handlePoolPostgres = null;
    this.candleWriterEventCallback = null;

    this.cache = [];
//adaptor, multiwatch- here or not here?
  };
  done() {
    if (typeof this.candleWriterEventCallback === 'function')
      this.candleWriterEventCallback();
  }
  tableMoniker(words=[]) {
    let naming = [...words];
    let d = this.plugin_config.tableNamingDelimiter || "_";
    let r = naming.join(d);
    r.replace(/\-/g, d);
    return r.toLowerCase();
  };
  init (done, settings) {
    let c = (settings == null)?this.plugin_config:settings;

    this.candleWriterEventCallback = done;
    let assertHas = ['tableNamingDelimiter'];
    _.each(assertHas, t => {
      if (!_.has(c, t))
        throw('bad config, missing '+t);
    });

    this.table.push(this.tableMoniker(['tickers']))
    this.table.push(this.tableMoniker(['orderbook','snap']))
    this.table.push(this.tableMoniker(['orderbook','bids','snap']))
    this.table.push(this.tableMoniker(['orderbook','asks','snap']))

    this.handlePool = PGAdapter.getHandleInstance(
      this.connectionString + '/' + this.plugin_config.database
    );
    this.handlePoolPostgres = PGAdapter.getHandleInstance( 
      this.connectionString + '/postgres',
    );
    this.checkExists(this.table);
    this.done();
  };
  createDatabase() {
    this.handlePool.query("CREATE DATABASE " + this.plugin_config.database, err => {
        if(err) {
          logger.debug("database already exists");
        }

        logger.debug("creating database with tables\nPostgres connection pool is ready, db " + this.plugin_config.database);
        this.initTables();
        this.done();
  })
  }
  initTables() {
    let queries = []
    queries.push(
        "CREATE TABLE IF NOT EXISTS "
        +this.table[0]+` (
          exchange VARCHAR NOT NULL,
          symbol VARCHAR NOT NULL,
          price double precision NOT NULL,
          datetime TIMESTAMP WITH TIME ZONE NOT NULL,
          bid double precision NOT NULL,
          ask double precision NOT NULL,
          baseVolume double precision NOT NULL,
          quoteVolume double precision,
          primary key(exchange, symbol)
          );`
    )
      
    //orderbook, bids, asks
    queries.push(
        "CREATE TABLE IF NOT EXISTS "
        +this.table[1]+` (
          id bigserial not null,
          exchange VARCHAR NOT NULL,
          symbol VARCHAR NOT NULL,
          datetime TIMESTAMP WITH TIME ZONE NOT NULL,
          primary key(id),
          unique (exchange, symbol)
        );`
    )
    queries.push(
        "CREATE TABLE IF NOT EXISTS "
        +this.table[2]+` (
          id bigserial not null,
          orderbookid bigint not null,
          price double precision not null,
          amount double precision not null,
          datetime TIMESTAMP WITH TIME ZONE,
          primary key(id)
        );`
    )
    queries.push(
        "CREATE TABLE IF NOT EXISTS "
        +this.table[3]+` (
          id bigserial not null,
          orderbookid bigint not null,
          price double precision not null,
          amount double precision not null,
          datetime TIMESTAMP WITH TIME ZONE,
          primary key(id)
        );`
    )

    for (let q of queries) {
      this.handlePool.query(q, (err) => {
        if(err) {
          err.message += "\n"+q
          throw(err);
        }
      });
    }
  };

  async store(obj=null, type=null) {
    switch (type) {
      case 'ticker':
        return await this.storeTicker(obj)
      case 'orderbook':
        return await this.storeOrderBook(obj)
      default:
        throw new Error("no storage backend for type "+type)
    }
  }
  async retrieve(keys, type=null) {
    switch (type) {
      case 'orderbook':
        return await this.retrieveorderbook(keys)
      case 'ticker':
        return await this.retrieveticker(keys)
      default:
        throw new Error("no storage backend for type "+type)
    }
  }
  dbQuote (value) {
    if (value && value.constructor === String)
      return "'"+value+"'"
    return value
  }

  insertStatement(table, fields, values) {
    let field = '('+fields.join(',')+')'
    let value = '('+values.join(',')+')'
    let stmt = `
    BEGIN; 
    LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE; 
    INSERT INTO ${table}
    ${field}
    VALUES 
    ${value}
    ON CONFLICT DO NOTHING
    returning id;
    COMMIT;
    END;
      `;
    return stmt
  }

  async retrieveorderbookheaders(keys=null) {
    let dbh = this.handlePool
    let table = this.table[1]

    let where = ""
    if (keys && keys.exchange)
      where = `where exchange = '${keys.exchange}'`
    if (keys && keys.symbol && keys.symbol.constructor == String)
      where += ` and symbol = '${keys.symbol}'`
    else if (keys && keys.symbol && keys.symbol.constructor == Array)
      where += ` and symbol in ('${keys.symbol.join("','")}')`

    let stmt = `
    select exchange, symbol, datetime from
    (
select distinct on (exchange, symbol)
 b.id, b.exchange, b.symbol, b.datetime
from ${table} b ${where}
order by exchange, symbol, datetime desc
) latest
order by datetime asc, exchange, symbol
`
    var client = await dbh.connect()
    let orderbookid = null
    let books = []
    try {
      let result = await client.query(stmt)
      for (let row of result.rows) {
        let book = row
        book.bids = []
        book.asks = []
        books.push(book)
      }
    } catch(e) {
      throw(e)
    } finally {
      client.release()
    }
    
    return books
  }
  //  null datetime will retrieve latest
  //
  async retrieveorderbooks(keys) {
    let dbh = this.handlePool
    let table = this.table[1]
    let tablebids = this.table[2]
    let tableasks = this.table[3]

    let where = ""
    if (keys && keys.exchange)
      where = `where exchange = '${keys.exchange}'`
    if (keys && keys.symbol && keys.symbol.constructor == String)
      where += ` and symbol = '${keys.symbol}'`
    else if (keys && keys.symbol && keys.symbol.constructor == Array)
      where += ` and symbol in ('${keys.symbol.join("','")}')`

    let stmt = `
select distinct on (exchange, symbol)
 b.id, b.exchange, b.symbol, b.datetime
from ${table} b ${where}
order by exchange, symbol, datetime desc
`

//where exchange = '${exchange}' and symbol = '${symbol}'
    var client = await dbh.connect()
    let orderbookid = null
    let books = []
    try {
      let result = await client.query(stmt)
      for (let row of result.rows) {
        let book = row
        book.bids = []
        book.asks = []
        let orderbookid = book.id
        stmt = `
 select price, amount
from ${tablebids} 
where orderbookid = ${orderbookid}
`
        let r = await client.query(stmt)
        r.rows.map(tuple => book.bids.push([tuple.price, tuple.amount]))

        stmt = `
 select price, amount
from ${tableasks}
where orderbookid = ${orderbookid} `
        r = await client.query(stmt)
        r.rows.map(tuple => book.asks.push([tuple.price, tuple.amount]))
        books.push(book)
      }
    } catch(e) {
      throw(e)
    } finally {
      client.release()
    }
    return books
  }

  async storeOrderBook(obj=null) {
    let dbh = this.handlePool
    let table = [this.table[1], this.table[2], this.table[3]]
    let f = []
    let v = []

    for (let p of ['exchange', 'symbol', 'datetime']) {
      f.push(p)
      v.push(this.dbQuote(obj[p]))
    }
    let stmt = this.insertStatement(table[0], f, v)

    //console.log(stmt)

    var client = await dbh.connect()
    let orderbookid = null
    try {
      let result = await client.query(stmt)
      //begin, lock, insert, commit, commit
      if (result[2].rowCount == 1)
        orderbookid = result[2].rows[0].id

      for (let row of obj.bids) {
        stmt = this.insertStatement(table[1], ['orderbookid','price','amount'],[orderbookid,row[0], row[1]])
        result = await client.query(stmt)
      }

      for (let row of obj.asks) {
        stmt = this.insertStatement(table[2], ['orderbookid','price','amount'],[orderbookid,row[0], row[1]])
        result = await client.query(stmt)
      }

    } catch(e) {
      e.message += "\n" + stmt
      throw(e)
    } finally {
      client.release()
    }
  }

  async retrieveexchangeexceptions(keys=null) {
    let dbh = this.handlePool
    let table = 'exchangeExceptions'
    let where = ''
    let stmt = `select * from ${table} ${where}`
    var client = await dbh.connect()
    try {
      let result = await client.query(stmt)
      return result.rows
//      return result[0].rows[0].exchange
    } catch(e) {
      throw(e)
    } finally {
      client.release()
    }
  }

  async retrievetickers(exchange=null, symbol=null) {
    let dbh = this.handlePool
    let table = 'tickers'

    let where = ''
    if (exchange) {
      exchange=this.dbQuote(exchange)
      where = `where exchange=${exchange}`
      if (symbol) {
        symbol=this.dbQuote(symbol)
        where += ` and symbol=${symbol}`
      }
    }
    let stmt = `select * from ${table} ${where}`
    var client = await dbh.connect()
    try {
      let result = await client.query(stmt)
      return result.rows
//      return result[0].rows[0].exchange
    } catch(e) {
      throw(e)
    } finally {
      client.release()
    }
  }

  async storeTicker(obj=null) {
    let dbh = this.handlePool
    let table = 'tickers'

    let f = []
    let v = []
    for (let p of obj.dbFields()) {
      if (typeof obj[p] === 'undefined' || obj[p] == null)
        continue
      f.push(p)
//      if (IStorable.isImplementedBy(obj)) 
//        console.log("isImplementdBy")
        v.push(this.dbQuote(obj[p]))
    }
    let fields = '('+f.join(',')+')'
    let values = '('+v.join(',')+')'

    let stmt = `
    BEGIN; 
    LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE; 
    INSERT INTO ${table}
    ${fields}
    VALUES 
    ${values}
    ON CONFLICT (exchange, symbol)
      DO UPDATE SET price = EXCLUDED.price, datetime = EXCLUDED.datetime, bid=EXCLUDED.bid, ask=EXCLUDED.ask, baseVolume=EXCLUDED.baseVolume, quoteVolume=EXCLUDED.quoteVolume;
    COMMIT;
    END;
      `;
    var client = await dbh.connect()
    let orderbookid = null
    try {
      let result = await client.query(stmt)
      return result[2].rowCount

    } catch(e) {
      e.message += "\n" + stmt
      throw(e)
    } finally {
      client.release()
    }
  }

  //look for existence, failing check- create both dB and tables
  //
  checkExists(table) {
    // We need to check if the db exists first.
    // This requires connecting to the default
    // postgres database first. Your postgres
    // user will need appropriate rights.
    this.handlePoolPostgres.connect((err, handle, done) => {
        if(err) { throw(err); }

        logger.debug("Check exists: database [" + this.plugin_config.database);
        handle.query("select count(*) from pg_catalog.pg_database where datname = $1", [this.plugin_config.database],
            (err, res) => {
            if(err) { throw(err); }

            if(res.rows[0].count !== '0') {
              // database exists
              logger.debug("Database exists: " + this.plugin_config.database);
              this.initTables();
              //logger.debug("Postgres connection pool is ready, db [" + this.config.PGAdapter.database+"]");
              done();
              return;
            }

            this.createDatabase(handle, done);
          });
    });
  };
}

module.exports = {
  PGAdapter: PGAdapter
}
