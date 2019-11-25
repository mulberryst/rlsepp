'use strict';
const chai = require('chai')
  , log4js = require('log4js')
  , fs = require("mz/fs")
  , path = require('path')
  , config = require('config')
  , ccxt = require('./ccxt')
, { ExchangeError, ArgumentsRequired, BadRequest, OrderNotFound, InvalidOrder, InvalidNonce, DDoSProtection, InsufficientFunds, AuthenticationError, ExchangeNotAvailable, PermissionDenied, NotSupported } = require ('./ccxt/js/base/errors')
  , filterA = require('awaity/filter').default
  , _ = require('lodash')
  , ansicolor = require ('ansicolor').nice
  , asTable = require ('as-table').configure ({ title: x => x.bright, delimiter: ' | '.dim.cyan, dash: '-'.bright.cyan })
  , numeral = require('numeral')
  , moment = require('moment')
  , util = require('util')
  , functions = require('./functions')
  , IxDictionary = require('./ixdictionary')
  , Ticker = require('./spread').Ticker
  , Spread = require('./spread').Spread
  , Spreads = require('./spread').Spreads
  , Iterable = require('./iterator').Iterable
  , nodemailer = require('nodemailer')
  , JSON = require('JSON')
;

const {
  isArray, 
  isObject, 
  isIterable, 
  isAsyncIterable,
  asyncForEach,
  sortBy,
  formatUSD,
  formatBTC,
  formatCrypto
} = functions

// create a mathjs instance with everything included
const { create, all } = require('mathjs')
  // Available options: 'number' (default), 'BigNumber', or 'Fraction'
const math = create(all)
//const logdir = process.env.LOGDIR || '/tmp/'
//asTable.configure ({ print: obj => (typeof obj === 'boolean') ? (obj ? 'yes' : 'no') : String (obj) }) (data)

const logger = log4js.getLogger('dual');
var expect = chai.expect;
var should = chai.should;
var assert = chai.assert;

const _type = ['fiat', 'crypto']
class Commodity {
  constructor(args) {
    this.symbol = (args['symbol'] != null) ? args['symbol'] :null
    this.value = (args['value'] != null) ? args['value'] :null
    this.name = (args['name'] != null) ? args['name'] : args['symbol']
    this.api = (args['api'] != null) ? args['api'] :null
    this.type = (args['type'] != null) ? args['type'] :null
    this.apitype = (args['apitype'] != null) ? args['apitype'] :null
    this.withdraw = null
    this.deposit = null
    this.ledger = []
    assert.isNotNull(this.symbol, "Commodity:constructor called with no symbol")
  }
  exchange() {
  }
}

class Exchange  {
  constructor() {
    //hashing ?  
    this.name = null
    this.ccxt = null
    this.marketData = null
    this.commodities = null //new Dictionary() <...|
  }
  init(args) {
    for (let prop in args) {
      this[prop] = args[prop]
    }
  }
  isActive() {
    let active = false
    for (let market of Object.values(this.marketData)) {
      if (market.active == true)
        return true
    }
  }
}

class Address {
  constructor() {
    this.exchange = null; //?
    return new Proxy(this, {
      set: function( target, name, value ) {
        target.hash[name] = value;
      },
      get: function(target, name) {
        /*
        if (name == 'length')
          return Infinity;
          */
        if (name in target)
          return target[name];
        if (name in target.hash)
          return target.hash[name];
      }
    })
  }
}

class Pair {
  constructor() {
    this.array = []
    return new Proxy(this, {
      set: function( target, name, value ) {
        target.hash[name] = value;
      },
      get: function(target, name) {
        /*
        if (name == 'length')
          return Infinity;
          */
        if (name in target)
          return target[name];
        if (target.hash.has(name))
          return target.hash[name];
      }
    })
  }
}

/*
 *  dictExchange:  Dictionary of Exchange objects
 *    each Exchange has the API within it
 */
var _singleton = null;
class  Rlsepp {
  constructor () {
    this.dictExchange = new IxDictionary()
    //see arbitrage_pairs for proxy retry
    this.proxies = [
      '', // no proxy by default
      'https://crossorigin.me/',
      'https://cors-anywhere.herokuapp.com/',
    ]

    this.basisUSD = {symbol: 'USD', value:1000}
    this.basis = new IxDictionary({'USD': this.basisUSD})
    this.basisHigh = new IxDictionary({'USD': this.basisUSD})
  }

  // input: wallet, spreads, 
  //
  //
  projectMoves(basis, spreads, direction) {
    let wallet = basis.clone()
    for (let s of spreads) {
      this.projectMove(basis.clone(), s, direction)
    }
    return spreads
  }

  interpolate(wallet, time) {
  }

  //  TODO: refactor with bid/ask
  //    implement actual movement fees
  //    *could attempt to implement a time expectation
  //
  //
  //  given a wallet and two exchanges,
  //    determine the way to move wallet's contents
  //    resulting in either a profit or the smallest loss
  //
//[ { symbol: 'ABT/BTC', price: 0.0000162, exchange: 'okex' },
//  { symbol: 'ABT/BTC', price: 0.00001796, exchange: 'bittrex' },
//    
  //
  transferAction(wallet, fromExchange, toExchange, arbitrableTickers) {
    let fromEx = this.dictExchange[fromExchange]
    let toEx = this.dictExchange[toExchange]
    assert.isNotNull(fromEx, "no exchange ["+fromExchange+"]")
    assert.isNotNull(toEx, "no exchange ["+toExchange+"]")

    let move = []
    let from = new IxDictionary()
    let to = new IxDictionary()

    console.log(config.get('addresses'))

    //  can move?
    //
    for (let spe of arbitrableTickers.values()) {
      let [base, quote] = spe.symbol.split('/')
      console.log(base + '/' + quote)
      //
      if (spe.exchange == fromExchange) {
        if (wallet.has(base) && wallet[base].value > 0) {
          let scope = {cost: wallet[base].value, price: spe.price}
          from[base] = scope;
        }
      }
      if (spe.exchange == toExchange) {
        //  we have a deposit address at toExchange for currency res idingin wallet
        if (wallet.has(quote) && wallet[quote].value > 0 &&
          config.has('addresses.'+toExchange+'.deposit.'+quote)) {
          move.push( {action:'move', from_exchange: fromExchange, to_exchange: toExchange, symbol: quote, amount: wallet[base].value, amountType: base, fee: 12.3456789} )
        }
      }
    }

    //fill in to[base]
    for (let spe of arbitrableTickers.values()) {
      if (spe.exchange == toExchange) {
        let [base, quote] = spe.symbol.split('/')
        //  we have a deposit address at toExchange for currency
        if ((wallet.has(quote) && wallet[quote].value > 0) &&
          config.has('addresses.'+toExchange+'.deposit.'+base)) {
          to[base] = {price: spe.ask}
          let fee = fromEx.ccxt.calculateFee(spe.symbol, 'type', 'buy', from[base].amount, from[base].price, 'maker', {}).cost || 0

          let scope = from[base]
          from[base].cost -= fee
          from[base].amount = math.evaluate('amount =  cost / price', scope)

          move.push( {action:'buy', exchange: fromExchange, amount: from[base].amount, symbol: base, amountType: base, fee: fee, bid:spe.bid, ask:spe.ask, price: spe.ask} )

//          wallet[quote].value = 0
          wallet[base] = {symbol:base, value: from[base].amount }

//          move.push( {action:'move', from_exchange: fromExchange, to_exchange: toExchange, symbol: base, amount: wallet[base].value, amountType: base, fee: 12.3456789} )

          /*
          fee = toEx.ccxt.calculateFee(spe.symbol, 'type', 'sell', wallet[base].value, to[base].price, 'maker', {}).cost || 0
          to[base].cost = wallet[quote].value - fee
          to[base].amount = math.evaluate('amount = cost / price', to[base])

          move.push( {action:'sell', exchange: toExchange, symbol: base, amount: to[base].amount, amountType: base, fee: fee, costType: quote, price: to[base].price} )
          */
        }
        if (wallet.has(base) && wallet[base].value > 0 &&
          config.has('addresses.'+toExchange+'.deposit.'+base)) {

          move.push( {action:'move', from_exchange: fromExchange, to_exchange: toExchange, symbol: base, amount: wallet[base].value, amountType: base, USD: wallet[base].value * spe.price} )

        }
      }
    }

    //return move.sort ((a,b) => ((a.USD < b.USD) ? -1 : (a.USD > b.USD) ? 1 : 0)).splice(0,2)
    return move
  }

  //  given a wallet and a spread,
  //    enumerate all possible buys and sells from commodity in wallet 
  //    to respective min & max exchange based on last ticker quote
  //
  projectMove(wallet, r, direction) {

//    console.log(this.dictExchange

//    console.log((maxEx instanceof Exchange)?"Exchange name:" + maxEx.name:"womp womp" )
//    console.log(maxEx.ccxt.markets)

    let scope = null

    let [base, quote] = r.symbol.split('/')

    let minEx = this.dictExchange[r.minExchange]
    let maxEx = this.dictExchange[r.minExchange]


    scope = r.strip(['median', 'mode', 'stdev','variance', 'commodity', 'tickers'])
    if (wallet.has(base) && wallet[base].value > 0 && typeof maxEx !== 'undefined') {
      if (direction != 'buy' && (r.ledger.length ==0  || r.ledger[r.ledger.length - 1].action != 'sell') && quote == 'USD') {
        let maxEx = this.dictExchange[r.maxExchange]

        scope.amount = wallet[base].value

        //some mathjs issue with scope.amount precision?
        //
        math.evaluate('cost = amount * max', scope)
        //scope.cost = scope.amount * scope.max
        try {
          scope.fee = maxEx.ccxt.calculateFee(r.symbol, 'type', 'sell', scope.amount, r.max, 'maker', {}).cost
        } catch(e) {
          console.log(r.maxExchange + " has no market for "+r.symbol, e)
          scope.fee = 0
        }
        //      math.evaluate('cost -= fee', scope)
        scope.amountType = base

        r.commodity.value = 0

        r.ledger.push( {action:'sell', exchange: r.maxExchange, symbol: base, amount: scope.amount, amountType: base, cost: scope.cost, fee: scope.fee, costType: quote, price: scope.max, priceType: 'bid'} )

        scope.amount = 0
      }
    } else if (wallet.has(quote) && wallet[quote].value >= this.basis[quote].value && this.dictExchange.has(r.minExchange)) {
      if (direction != 'sell' ) {
      //if (direction != 'sell' && ( r.ledger.length == 0 ||  r.ledger[r.ledger.length - 1].action != 'buy' )) {
        scope.cost = wallet[quote].value
        math.evaluate('amount = cost / min', scope)
        //scope.amount  = scope.cost / scope.min
        scope.fee = 0
        try {
          //could move minEx to next one up until a fee is calculatable
          //
          //         const result = exchange.calculateFee (market['symbol'], 'limit', 'sell', amount, price, takerOrMaker, {})
          let fee = minEx.ccxt.calculateFee(r.symbol, 'type', 'buy', scope.amount, scope.min, 'maker', {})
          scope.fee = fee.cost || 0
          scope.cost -= scope.fee
          math.evaluate('amount = cost / min', scope)
          scope.amountType = base
          r.commodity.value = scope.amount

          r.ledger.push( {action:'buy', exchange: r.minExchange, amount: scope.amount, amountType: base, symbol: base, cost: scope.cost, fee: scope.fee, costType: quote, price: scope.min, priceType: 'ask'} )
        } catch(e) {
          console.log(r.minExchange +" has no market for "+r.symbol, e)
        }
      }
    } else {
      scope.amount = 0
    }
    //    data.profitBasis = JSON.parse(JSON.stringify(scope.pb), math.json.reviver) 
    for (let prop in scope) {
      if (typeof scope[prop] !== 'undefined') {
        r[prop] = scope[prop]
      }
    }

    return r
  }
  static getInstance() {
    if (_singleton != null)
      return _singleton;
    try {
      _singleton = new Rlsepp();
    } catch (e) {
      throw(e);
    }
    return _singleton;
  }
  /*
   *  TODO: implement retry
   *
   *
  const pairs = await Promise.all(files.map(async (file) => {
    const stats = await fs.stat(file);
    return [stats.isDirectory(), file, stats.size];
  }));
  return pairs
     .filter(([isDirectory, file, size]) => isDirectory)
     .map(([isDirectory, file, size]) => size);

  return filterA(promise, async (file) => {
    const stats = await fs.stat(file);
    return stats.isDirectory();
  });
  */ 
  async initAsync(exchanges, opts = {}) {
    //this.exchanges = new Dictionary();

    let list = [...exchanges]
    //ccxt.timeout
    let timeoutInc = 2500
//    throw new ccxt.RequestTimeout; 
    let retry  = {}
    for (let n of list) {
      retry[n] = opts.retry || 1;
    }

    let apiAuth = config.get("credentials")
//    for (let n of retry) {
      await Promise.all(list.map( async (name) => {
        let creds = apiAuth[name];
        logger.debug("initializing ccxt exchange ",name);
        try {
          let E = new Exchange();
          let e = await Rlsepp.initExchangeAsync( name, {...opts, ...creds} );

          let m = []
          let commodities = null
//          if (Object.hasOwnProperty("load_markets")) {
            //TODO
            //retry / proxy logic from arbitrage-pairs
            m = await e.loadMarkets();
            e['name'] = name;
            commodities = new IxDictionary();
            let count = 0;
            Object.values(m).forEach ( (market) => {
              count++;
              if (typeof market.precision === 'undefined') {
                logger.debug('warning, exchange '+name+' missing precision info for '+market.symbol+' using {amount: 8, price: 3}')
                market.precision = {amount:8, price:3}
              } 

              commodities.set(market.base, new Commodity({symbol: market.base, api: 'ccxt', type: 'crypto', apitype: 'base'}));

              //we dont need multiple currencies just for type such as BTC is typically listed as both
              //
              if (!commodities.has(market.quote))
                commodities.set(market.quote,new Commodity({symbol: market.quote, api: 'ccxt',type: 'fiat', apitype: 'quote'}));
            })
            logger.info('initialized exchange '+name+' with '+count+" markets");
//          }
          E.init({ 'name': name, 'ccxt': e, 'marketData': m, 'commodities': commodities});
          this.dictExchange.set(name, E)
          if (E.isActive()) {
            this.dictExchange.set(name, E)
          } else {
            logger.warn('exchange '+name+' currently Inactive!')
          }
          list.splice(list.indexOf(name), 1)

        } catch(e) {
          if (e instanceof ccxt.RequestTimeout) {
            retry[name]--
            e.message = "initAsync: "+e.message;
            logger.error(e)

          } else {
            e.message = "initAsync: "+e.message;
            logger.error(e)
          }
          //throw(new Error(e));
        };
      }
    ))
  }
  //  initExchangeAsync: ccxt only at this time
  //
  //  returns API object flowthrough
  //
  static async initExchangeAsync (exName, opts = {}) {
    return new Promise((resolve, reject) => {

      if (opts.key != null)
        opts.apiKey = opts.key;
      if (opts.passphrase != null)
        opts.password = opts.passphrase;

      let exchangeFound = ccxt.exchanges.indexOf (exName) > -1
      if (exchangeFound) {
        let eAPI = new ccxt[exName] ({
          ...opts
        })

        if (!eAPI.has['fetchBalance'])
          throw ( new Error(exName + ' has no fetchBalance'));

        logger.debug('exchanges '+exName+' has fetchBalance');
        eAPI['name'] = exName

        resolve(eAPI);
      } else {
        let e = new Error('CCXT does not support exchange [' + exName + "]\n" + 
          "CCXT Supports "+ccxt.exchanges.join(",")
        );
        reject(e);
      }
    })
  }

  //  send notification via text or email to user specified in conf
  //  with said user's credentials
  //
  async notify(body, subject = "") {
    /*
    //one line on my phone is N chars:
    //  "Sent from your Twilio trial account"
    client.messages.create({
      "body": body,
      "from": "+16194314849",
      "to": "+16464507917"
    }).then(message => logger.info(message.sid + " text message sent"))
    .catch(err => logger.info(err));
    */

    // Create a SMTP transporter object
    let transporter = nodemailer.createTransport(
        {
            host: 'smtp.gmail.com',
            port: 465,
            secure: 'true',
            auth: {
                user: config.get('gmail.user'),
                pass: config.get('gmail.pass')
            },
            logger: true,
            debug: false // include SMTP traffic in the logs
        }
    );
    // Message object
    let message = {
        // Comma separated list of recipients
        to: config.get('gmail.user'),
        // Subject of the message
        subject: '✔ RLSEPP ' + subject + " " + moment().format('dddd h:mma, L'),
        text: body
    };
    transporter.sendMail(message, (error, info) => {
        if (error) {
            logger.error('Error occurred');
            logger.error(error.message);
            return process.exit(1);
        }

        logger.info('Message sent successfully!, '+subject);
//        console.log(nodemailer.getTestMessageUrl(info));

        // only needed when using pooled connections
        transporter.close();
    });

  }

  /* TODO: correct fees
   *
   * in: currency, exname1, exName2, table of tickers from fetchArbitrableTickers, optional amount
   *
   * first, test a micro transaction (below nominal amount)
   *    ensure the exchange will error on amount
   *  second, test micro transaction of purchase fee amount
   *    ensure the exchange errors out
   *  third, attempt withdraw
   *    wait for tx to settle, show balance on deposit side
   *    calculate fee and record
   */

  async safeMoveMoneyAsync(currency, withdrawExchange, depositExchange, tickers, amount = null) {
    assert.isNotNull(this.dictExchange[withdrawExchange], "no exchange withdrawExchange")
    assert.isNotNull(this.dictExchange[depositExchange], "no exchange depositExchange")

    let price = 0
    let ticker = null;
    for (let spe of tickers.values()) {
      let [base, quote] = spe.symbol.split('/')
      if (spe.exchange == depositExchange && currency == base) {
        ticker = spe
      }
    }

    if (ticker == null) { 
      return
    }

    let wEx = this.dictExchange[withdrawExchange]
    let dEx = this.dictExchange[depositExchange]

    let fee = null
    try {
      fee = wEx.ccxt.calculateFee(ticker.symbol, 'type', 'buy', amount, ticker.price, 'maker', {}).cost || 0
    } catch(e) {
      return
    }

    try { 
      await this.moveMoneyAsync(currency, withdrawExchange, depositExchange, fee/2)
      logger.info("maker fee for "+amount+ ": "+ticker.symbol+ " : "+withdrawExchange+ ":"+fee)
    } catch(e) {
      if (e instanceof ExchangeError) {
        //  constructor hack for markets from 3rd party API
        //
        let message = new ExchangeError(e)
        //let configObject = { exchange: withdrawExchange, ExchangeError: { InsufficientFunds: wEx.ccxt.last_http_response } } 
        let configObject = { exchange: withdrawExchange, ExchangeError: { InsufficientFunds: message } } 
        console.log(util.inspect(configObject,false, null, true))
      }
    };

    try {
      fee = dEx.ccxt.calculateFee(ticker.symbol, 'type', 'buy', amount, ticker.price, 'maker', {}).cost || 0
    } catch(e) {
      return
    }
    try {
      await this.moveMoneyAsync(currency, depositExchange, withdrawExchange, fee/2)
      logger.info("maker fee for "+amount+ ": "+ticker.symbol+ " : "+depositExchange+ ":"+fee)
    } catch(e) {
      if (e instanceof ExchangeError) {
        let message = new ExchangeError(e)
        let configObject = { exchange: depositExchange, ExchangeError: { InsufficientFunds: message } }
        console.log(util.inspect(configObject,false, null, true))
      }
    }
  }

  /*
   *  TODO:  test support of ephemeral addresses [yobit]
   *     update config file for old or missing addresses dynamically
   *
   *  async withdraw (code, amount, address, tag = undefined, params = {})
   * ...
   *    } else if ('coinbase_account_id' in params) {
   *          method += 'CoinbaseAccount';
   */
  async moveMoneyAsync(currency, withdrawExchange, depositExchange, amount) {
    assert.isNotNull(this.dictExchange[withdrawExchange], "no exhcnage withdrawExchange")
    assert.isNotNull(this.dictExchange[depositExchange], "no exchange depositExchange")

    let destAddr = null

    let configObject = { addresses: { } }
    try {
      const contents = await fs.readFile('.addresses.json')
      configObject = JSON.parse(contents)
    } catch(e) {
      console.log(e.message)
    };
    if (!Object(configObject.addresses).hasOwnProperty(depositExchange))
      configObject.addresses[depositExchange] = {}
    if (!Object(configObject.addresses[depositExchange]).hasOwnProperty('deposit'))
      configObject.addresses[depositExchange].deposit = {}

    let configKey = 'addresses.'+depositExchange+".deposit."+currency
    if (config.has(configKey))
      destAddr = config.get(configKey)
    else {
      logger.info("no deposit address for exchange "+depositExchange+", fetching...")
      try {
        var data = await this.fetch_create_deposit_address(this.dictExchange[depositExchange],currency)
        destAddr = data.address

        configObject.addresses[depositExchange].deposit[currency] = destAddr
        var cacheFile = fs.createWriteStream('.addresses.json', { flags: 'w' });
        cacheFile.write( JSON.stringify(configObject, null, 4) )

        console.log(util.inspect(configObject,false, null, true))
      } catch(e) {
        logger.error("fetch_create failed for "+depositExchange+ " " + e)
        return
      }
    }

    logger.info(currency+":"+amount+":"+withdrawExchange+":"+depositExchange+":"+destAddr)

    let wEx = this.dictExchange[withdrawExchange]

    try {
      let r = await wEx.ccxt.withdraw(currency, amount, destAddr)
    } catch(e) {
      throw(e); 
    };
    logger.info(r)
  }

  // array of symbols
  //  derived USD value as 'fiat USD' based on ticker.last
  //
  async apiFetchTicker(exchange,array, whitelist=['datetime', 'high', 'low', 'bid', 'ask', 'close', 'last', 'baseVolume', 'quoteVolume' ,'vwap']) {
    var symbolForPrice = {}
    let table = []
    //    let table = Object.assign({}, portfolio[id])
    //    for (var i = 0, len = table.length; i < len; i++) {
    var i = 0

    await asyncForEach(array, async (el, i, a) => {
      //        let coin = table[id][i]\

      try {
        var t = await exchange.ccxt.fetchTicker (el.symbol)

//        for (let prop of ['high', 'low', 'bid', 'ask', 'baseVolume', 'quoteVolume', 'datetime', 'close', 'last') {
        let blacklist = ['info'] //for program performance
        for (let prop in t) {
          if (blacklist.indexOf(prop) == -1 && typeof t[prop] !== 'undefined' && whitelist.indexOf(prop) != -1) {
            el[prop] = t[prop]
          }
        }
        el.price = t.last

        let cur = el.symbol.split('/')
        //        console.log("currency "+cur[0].red+" against "+cur[1].red);
        symbolForPrice[cur[0]] = el.price
        el['fiat USD'] = el.amount * t.bid
        if (cur[1] == 'USD' || cur[1] == 'USDT') {
          //          el.value += ' USD'
        } else {
          if (typeof symbolForPrice[cur[1]] !== 'undefined') {
            el['fiat USD'] *= symbolForPrice[cur[1]]
            //            el.value += ' USD'
          }
        }
        if (el.price > 0) {
        //  table[i++] = el
          table.push(el)
//          console.log(util.inspect(el, false, false))
        }
      } catch(e) {
      };
    })
    return table
  }

  // in: table of tickers as output by fetchArbitrableTickers
  //
  //
  deriveSpreads(table) {
    assert.isNotNull(table, "deriveMinMaxSpreads passed nothing, requires ticker snapshot" )

    let spreads = new Spreads()
    for (let row of table) {

      let [base, quote] = row.symbol.split('/')

      let ticker = new Ticker(row)
      let spread = new Spread(ticker)

      //
      //
      spreads.merge(row.symbol, spread)

    }
    for (let spread of spreads) {
      spread.calculate()
    }

    return spreads
  }

  //  TODO timestamps > (insert age)
  //
  //  apply heuristics to cache of tickers 
  //  input: collection:cache, collection:exchanges
  //  returns
  //
  checkTickerCache(cache=[])
  {
    let tcount = new IxDictionary
    let k = this.dictExchange.keys()
    for (let t of cache) {
      tcount.set(t.exchange,tcount.get(t.exchange)+1)
    }
    for (let e of k) {
      if (!tcount.has(e)) {
        console.error('ticker cache missing exchange '+e)
        return false
      }
    }
    return true
  }

  //  in: ixDict of symbols by exchange
  //      list of base currencies for spread calculations to quote against
  //     {
  //      "exchange name": ["BTC", "LTC", "ETH", "BCH", "ZEC", "XEM", "XRP", "DOGE"]
  //     },
  //     ['USD']
  //
  //  out: array of ticker objects
  //
  async fetchArbitrableTickers(exchangeForSymbol = null, baseWhiteList = ['USD']) {
    if (exchangeForSymbol == null) {
      exchangeForSymbol = this.arbitrableCommodities()
    }


    /*
     *  use file cache if possible
     *  could also reference the white list on check cache
     */
    let table = []
    try {
      const contents = await fs.readFile('.tickers.json')
      table = JSON.parse(contents)
    } catch(e) {
      console.log(e.message)
    };

    if (this.checkTickerCache(table,this.dictExchanges)) {
      return table
    }


    let promises = []

    //  take each base commodity, check against fetchTicker capability of each exchange
    //
    let exchangeTickers = new IxDictionary()
    for (let [cName, exchanges] of exchangeForSymbol.entries()) {
      for (let name of exchanges) {
        if (!exchangeTickers.has(name)) {
          exchangeTickers[name] = []
        }

        for (let quote of baseWhiteList) {

          let ticker = cName+"/"+quote
          if (this.dictExchange[name].ccxt.symbols.indexOf(ticker) >= 0) {
            exchangeTickers[name].push({symbol: ticker})
          }
        }
      }
    }
    let count = {exchanges:0, tickers:0}

    for (let [name, tickers] of exchangeTickers.entries()) {
      let e = this.dictExchange[name]
      let p = new Promise((resolve, reject) => {
        this.apiFetchTicker(e, tickers).then( result => {
          let out = this.deriveFields(result)
          for (let row of out) {
            row['exchange'] = name
          }
          resolve( out )
        }).catch( e=> reject(e) )
      })
      promises.push(p);
    }

    logger.info("looking up "+exchangeForSymbol.size()+" symbols across "+exchangeTickers.size()+" exchanges")
    try {
      let results = await filterA(promises, async (tuple) => {
        const el = await tuple;
        return el;
      });
      //collapse nested tables
      //
      let r = []
      for (let row of results) {
        for (let inner of row) {
          r.push(inner)
        }
      }
      table = r.sort ((a,b) => ((a.symbol < b.symbol) ? -1 : (a.symbol > b.symbol) ? 1 : 0))

      var tickerFile = fs.createWriteStream('.tickers.json', { flags: 'w' });
      tickerFile.write( JSON.stringify(table, null, 4) )

      return table
    } catch(e) {
      console.log(e)
    }
  }

  // in: blacklist of symbols (many exchanges may list symbols as base currency simply for 
  //     a statisticians appreciation - bitmex i think might have been one
  //    (USDT, USD, Fiat)
  // out: IxDictionary map of symbols per exchange (unique)
  //
  arbitrableCommodities(blacklist = []) {
		// get all unique symbols
		let symbolHist = new IxDictionary()
		let exSymbol = new IxDictionary()
//    ccxt.unique (ccxt.flatten (ids.map (id => exchanges[id].symbols)))
    for (let [name, Exchange] of this.dictExchange.entries()) {
      assert.isNotNull(Exchange.ccxt, "no exchange "+name)
      for (let c of Exchange.commodities.values()) {
        if (c.apitype == 'base' && blacklist.indexOf(c.name) == -1) {
          let prev = 0
          if (symbolHist.has(c.name)) {
            prev = symbolHist[c.name]
          }
          if (exSymbol.has(c.name)) {
            exSymbol[c.name].push(name)
          } else {
            exSymbol[c.name] = [name]
          }
          symbolHist[c.name] = prev + 1

        }
      }
    }
    for (let [symbol, count] of symbolHist.entries()) {
      if (count < 2) {
        symbolHist.remove(symbol)
        exSymbol.remove(symbol)
      }
    }

    return exSymbol
  }
  arbitrableSymbols() {
    /*
        // filter out symbols that are not present on at least two exchanges
        let arbitrableSymbols = uniqueSymbols
            .filter (symbol =>
                ids.filter (id =>
                    (exchanges[id].symbols.indexOf (symbol) >= 0)).length > 1)
            .sort ((id1, id2) => (id1 > id2) ? 1 : ((id2 > id1) ? -1 : 0))

        // print a table of arbitrable symbols
        let table = arbitrableSymbols.map (symbol => {
            let row = { symbol }
            for (let id of ids)
                if (exchanges[id].symbols.indexOf (symbol) >= 0)
                    row[id] = id
            return row
        })

        log (asTable.configure ({ delimiter: ' | ' }) (table))
*/
		// get all unique symbols
		let symbolHist = new Dictionary()
		let exSymbol = new Dictionary()
//    ccxt.unique (ccxt.flatten (ids.map (id => exchanges[id].symbols)))
    for (let [name, Exchange] of this.dictExchange.entries()) {
      assert.isNotNull(Exchange.ccxt, "no exchange "+name)
      Object.values(Exchange.ccxt.symbols).forEach ( (s) => { 
        let cur = s.split('/')
        let base = cur[0]

        //TODO: for direct way of determining if currency can be bought,sold,and moved
        //
        //  solved, not yet implemented.
        //  use gekko's market fetcher for static filers and exchange markets wrappers
        //    for dynamic list of purchasable commodities 
        //
        //  for now, for this- ignore quote only currencies on exchanges, they wont be traded
        //
        if (Exchange.commodities.has(base) && Exchange.commodities[base].apitype == 'base') {
          let prev = 0
          if (symbolHist.has(s)) {
            prev = symbolHist[s]
          }
          if (exSymbol.has(s)) {
            exSymbol[s].push(name)
          } else {
            exSymbol[s] = [name]
          }
          symbolHist[s] = prev + 1
        }
      } )
    }
    for (let [symbol, count] of symbolHist.entries()) {
      if (count < 2) {
        symbolHist.remove(symbol)
        exSymbol.remove(symbol)
      }
    }

    /*
    let balance = []
    let ex = new Dictionary()
    for (let [symbol, exchanges] of exSymbol.entries()) {
      let cur = symbol.split('/')
      for (let name in exchanges) {
        cur[0]
      }
    }
*/
    return exSymbol
  }

  //  TODO: split formatting and derivation from api call wrappers
  //
  //  for now, cleanup
  //
  //  calculate custom fields
  //
  //  we want to see all against USD [can use USDT to USD]
  //  want to see all against BTC?
  //
  deriveFields(table) {
    let result = []
    for (let row of table) {
      let newRow = {}
      for (let key of Object.keys(row)) {
        if (key.startsWith('fiat')) {
          //nada
        } else {
          newRow[key] = row[key]
        }
      }
      result.push(newRow)
      

      if (Object(row).hasOwnProperty('amount')) {

      }
    }
    return result
  }

  async showDerivedWallet(balances = null, whitelist=['datetime', 'high', 'low', 'bid', 'ask', 'close', 'last', 'baseVolume', 'quoteVolume' ,'vwap']) {
    if (balances == null) {
      balances = await this.fetchBalances();
    }
    let total = {USD:0}
    for (let oResult of balances) {
      let name = oResult.name;
      let eAPI = oResult.eAPI;

      let tickers = []
      let cludge = []
      console.log(name.magenta)
      for (let prop in eAPI) {
        //check for existence
        let fiats = ['USD', 'USDT', 'CAD']
        for (let el of fiats) {
          if (el == prop && eAPI[prop].total > 0) {
            let k = 'fiat '+el;
            let v = {symbol: el, price: 1};
            v[k] = eAPI[prop].total;
            total[el] += eAPI[prop].total;
            cludge.push(v);
          }

          let ticker = prop+"/"+el
          //            console.log(Object(this.dictExchange[name].marketData).hasOwnProperty(ticker))
          if (Object(this.dictExchange[name].marketData).hasOwnProperty(ticker)
            && eAPI[prop].total > 0)
            tickers.push({symbol: ticker, amount: eAPI[prop].total})
        }
      }

      let table = await this.apiFetchTicker(this.dictExchange[name], tickers, whitelist)
      //, ['datetime', 'bid','ask', 'price'])

      table= table.filter(el => { if (el != null) return el })
      table = table.concat(cludge)

      //  compute total sums
      //
      let formattedTable = [];
      for (let row of table) {
        total['USD'] += row['fiat USD']
      }

      for (let row of table) {
        let foo = row
        for (let key of Object.keys(row)) {
          //keyumn header matches with 'value', thus far it's derived as a curency
          if (key != 'datetime') {
            if (key.startsWith('fiat') && foo[key] > 0 ) {
              foo[key] = numeral(foo[key]).format('$0,0.0')
              //          /[A-Z]/g;
            } else if ( String(foo[key]).match('[0-9]') ) {
              foo[key] = formatCrypto(foo[key])
            }
          }
        }
        formattedTable.push(foo)
      }

      // TODO, dynamize property
      //
      //    let printNice = asTable(sortBy(table, Object.values(table), 'fiat USD'))
      let printNice = asTable(sortBy(formattedTable, Object.values(formattedTable), 'fiat USD'))
      console.log(printNice)
    }


    //  also format & print totals
    //
    console.log(util.inspect(total,true,true))

    console.log('total'.magenta)
    let tbl = []
    for (let p in total) {
      tbl.push({symbol: p, amount: total[p]})
    }
    console.log(asTable(tbl))
  }

  showTickers(table)  {
    table= table.filter(el => { if (el != null) return el })

    let formattedTable = [];
    for (let row of table) {
      let foo = row
      for (let key of Object.keys(row)) {
        //keyumn header matches with 'value', thus far it's derived as a curency
        if (key.startsWith('fiat') && foo[key] > 0 ) {
          foo[key] = numeral(foo[key]).format('$0,0.0')
//          /[A-Z]/g;
        } else if ( String(foo[key]).match('[0-9]') ) {
          foo[key] = formatCrypto(foo[key])
        }
      }
      formattedTable.push(foo)
    }

    // TODO, dynamize property
    //
    let printNice = asTable(sortBy(formattedTable, Object.values(formattedTable), 'fiat USD'))
//    let printNice = asTable(sortBy(table, Object.values(table), 'fiat USD'))
    console.log(printNice)
  }
  async showBalances() {
    let balances = await this.fetchBalances();
    for (let oResult of balances) {
      let name = oResult.name;
      let eAPI = oResult.eAPI;
      let table = []

      console.log(name.magenta)
      for (let prop in eAPI) {
        /* info,free,used,total,COIN{free,used,total}...
        let headers = ['free', 'used', 'total']
        if (headers.indexOf(prop))
        */
        //  if not commodity, info will be prop
        //
        if (this.dictExchange[name].commodities.has(prop) ) {
          //  trim 0 value coins from table 
          //
          let anyOf = 0
          Object.values(eAPI[prop]).forEach(el => anyOf+= el)
          if (anyOf > 0) {
            for (let coin in eAPI[prop]) {
              if (this.dictExchange[name].commodities[prop].type == 'crypto')
                eAPI[prop][coin] = formatCrypto(eAPI[prop][coin])
              else
                eAPI[prop][coin] = numeral(eAPI[prop][coin]).format('$0,0.0')
            }

            table.push( { symbol: prop, ...eAPI[prop] } )
          }
        }
      }
      let printNice = asTable(sortBy(table, Object.values(table), 'total'))
      console.log(printNice)
    }
    return balances
  }

  async fetchBalances() {
    let promises = []

    for (let [name, Exchange] of this.dictExchange.entries()) {
      assert.isNotNull(Exchange.ccxt, "no exchange "+name)

      let p = new Promise((resolve, reject) => {
        Exchange.ccxt.fetchBalance().then(result => {
          resolve({name:name,eAPI:result})
        }).catch(e=>{
      if (e instanceof ccxt.DDoSProtection || e.message.includes ('ECONNRESET')) {
        logger.debug ('[DDoS Protection] ' + e.message)
      } else if (e instanceof ccxt.RequestTimeout) {
        logger.debug ('[Request Timeout] ' + e.message)
      } else if (e instanceof ccxt.AuthenticationError) {
        logger.debug ('[Authentication Error] ' + e.message)
      } else if (e instanceof ccxt.ExchangeNotAvailable) {
        logger.debug ('[Exchange Not Available Error] ' + e.message)
      } else if (e instanceof ccxt.ExchangeError) {
        logger.debug ('[Exchange Error] ' + e.message)
      } else if (e instanceof ccxt.NetworkError) {
        logger.debug ('[Network Error] ' + e.message)
      } else {
        reject(e);
      }
          resolve({name:name,eAPI:null})
        })
      });
      promises.push(p);
    }
    try {
      let results = await filterA(promises, async (tuple) => {
        const el = await tuple;
//        if (isObject(el.eApi))
          return el
      });
//      results = results.filter( el => isObject(el.eApi) )
      return results;
      /*  [ [ "exchange", {info:  [], "BTC": { free: #, used: #, total: #}
      */
    } catch(e) {
      console.log(e)
    }
  }

  // fetchDepositAddress
  static async fetch_withdraw_address(exchange, symbol) {
  }

  async fetch_create_deposit_address(exchange, currencyCode) {
      let exchangeId = exchange.name
      try {
        console.log ('Trying to fetch deposit address for ' + currencyCode + ' from ' + exchangeId + '...')

        let fetchResult = await exchange.ccxt.fetchDepositAddress (currencyCode)
        console.log ('Successfully fetched deposit address for ' + currencyCode)
        return(fetchResult)
      } catch (e) {
        // never skip proper error handling, whatever it is you're buildingsd   
        // actually, with crypto error handling should be the largest part of your code
//        if (e instanceof exchange.ccxt.InvalidAddress) {
          console.log ('The address for ' + currencyCode + ' does not exist yet')
          if (exchange.ccxt.has['createDepositAddress']) {
            console.log ('Attempting to create a deposit address for ' + currencyCode + '...')
            try {
              const createResult = await exchange.ccxt.createDepositAddress (currencyCode)
              // console.log (createResult) // for debugging
              console.log ('Successfully created a deposit address for ' + currencyCode + ', fetching the deposit address now...')

              try {
                let fetchResult = await exchange.ccxt.fetchDepositAddress (currencyCode)
                console.log ('Successfully fetched deposit address for ' + currencyCode)
                return(fetchResult);
              } catch (e) {
                throw('Failed to fetch deposit address for ' + currencyCode + e.constructor.name + e.message)
              }
            } catch (e) {
              throw('Failed to create deposit address for ' + currencyCode + e.constructor.name + e.message)
            }

          } else {
            throw('The exchange does not support createDepositAddress()')
          }
          /*
        } else {
          console.log ('There was an error while fetching deposit address for ' + currencyCode, e.constructor.name, e.message)
          throw("unknown error"+e)
        }
        */
      }
    }
}
module.exports = {
  Rlsepp: Rlsepp,
}
