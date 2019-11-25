const _ = require('lodash')
  , fs = require('fs')
  , util = require('../../core/util.js')
  , dirs = util.dirs()
  , config = util.getConfig()
  , adapter = config[config.adapter]
  , log = require(dirs.core + 'log')
  , pg = require('pg')
  , pluginHelper = require(dirs.core + 'pluginUtil')
  , Pipeline = require(dirs.core + 'pipelineFactory').Pipeline
  , PGAdapter = require(dirs.gekko + adapter.path + '/PGAdapter').PGAdapter
  , { Query } = require('pg')
;

class PGAreader extends PGAdapter {
  static getInstance() {
    if (_singleton == null)
      try {
        _singleton = PGAdapter.create();
      } catch(e) {
        util.die(e);
      };

    return _singleton;
  };

  constructor (settings) {
    super(settings);
  };
  done() {
    if (typeof this.candleWriterEventCallback === 'function')
      this.candleWriterEventCallback();
  }

  // returns the furthest point (up to `from`) in time we have valid data from
  mostRecentWindow(from, to, next) {
    to = to.unix();
    from = from.unix();

    var maxAmount = to - from + 1;

    this.handlePool.connect((err,client,done) => {
      var query = client.query(new Query(`
    SELECT start from ${this.table}
    WHERE start <= ${to} AND start >= ${from}
    ORDER BY start DESC
    `), function (err, result) {
      if (err) {
        // bail out if the table does not exist
        if (err.message.indexOf(' does not exist') !== -1)
          return next(false);

        log.error(err);
        return util.die('DB error while reading mostRecentWindow');
      }
    });

      var rows = [];
      query.on('row', function(row) {
        rows.push(row);
      });

      // After all data is returned, close connection and return results
      query.on('end', function() {
        done();
        // no candles are available
        if(rows.length === 0) {
          return next(false);
        }

        if(rows.length === maxAmount) {

          // full history is available!

          return next({
            from: from,
            to: to
          });
        }

        // we have at least one gap, figure out where
        var mostRecent = _.first(rows).start;

        var gapIndex = _.findIndex(rows, function(r, i) {
          return r.start !== mostRecent - i * 60;
        });

        // if there was no gap in the records, but
        // there were not enough records.
        if(gapIndex === -1) {
          var leastRecent = _.last(rows).start;
          return next({
            from: leastRecent,
            to: mostRecent
          });
        }

        // else return mostRecent and the
        // the minute before the gap
        return next({
          from: rows[ gapIndex - 1 ].start,
          to: mostRecent
        });
      });
    });  
  }

  tableExists(name, next) {
    this.handlePool.connect((err,client,done) => {
      client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema='${this.schema}'
        AND table_name='${name}';
    `, function(err, result) {
      done();
      if (err) {
        return util.die('DB error at `tableExists`');
      }

      next(null, result.rows.length === 1);
    });
    });  
  }

  get(from, to, what, next) {
    if(what === 'full'){
      what = '*';
    }

    this.handlePool.connect((err,client,done) => {
      var query = client.query(new Query(`
    SELECT ${what} from ${this.table}
    WHERE start <= ${to} AND start >= ${from}
    ORDER BY start ASC
    `));

      var rows = [];
      query.on('row', function(row) {
        rows.push(row);
      });

      query.on('end',function(){
        done();
        next(null, rows);
      });
    });  
  }

  count(from, to, next) {
    this.handlePool.connect((err,client,done) => {
      var query = client.query(new Query(`
    SELECT COUNT(*) as count from ${this.table}
    WHERE start <= ${to} AND start >= ${from}
    `));
      var rows = [];
      query.on('row', function(row) {
        rows.push(row);
      });

      query.on('end',function(){
        done();
        next(null, _.first(rows).count);
      });
    });  
  }

  countTotal(next) {
    this.handlePool.connect((err,client,done) => {
      var query = client.query(new Query(`
    SELECT COUNT(*) as count from ${this.table}
    `));
      var rows = [];
      query.on('row', function(row) {
        rows.push(row);
      });

      query.on('end',function(){
        done();
        next(null, _.first(rows).count);
      });
    });  
  }

  getBoundry(next) {
    this.handlePool.connect((err,client,done) => {
      var query = client.query(new Query(`
    SELECT (
      SELECT start
      FROM ${this.table}
      ORDER BY start LIMIT 1
    ) as first,
    (
      SELECT start
      FROM ${this.table}
      ORDER BY start DESC
      LIMIT 1
    ) as last
    `));
      var rows = [];
      query.on('row', function(row) {
        rows.push(row);
      });

      query.on('end',function(){
        done();
        next(null, _.first(rows));
      });
    });  
  }

  close() {
    //obsolete due to connection pooling
    //this.handlePool.end();
  }

}

var generator = function(done, pluginMeta, pipe_config) {
  if (pipe_config == null)
    pipe_config = config;
//console.log('PGAdapter.generator',done, pluginMeta, pipe_config[config.adapter]);
//    await PGAdapter.createInit(config);
  let adapter = null;
  try {
    adapter = PGAreader.createInit(done, pipe_config[config.adapter]);
  } catch(e) {
    util.die(e);
  };
  return adapter; 
};
module.exports = generator;
