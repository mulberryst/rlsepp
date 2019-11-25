const util = require(__dirname + '/core/util')
  , dirs = util.dirs()
  , _ = require('lodash')
  , events = require('events')
  , moment = require('moment')
  , log = require(dirs.core + 'log')
  , PipelineFactory = require(dirs.core + 'pipelineFactory').PipelineFactory
  , BrokerFactory = require(dirs.broker + 'brokerFactory').BrokerFactory
  , Broker = require(dirs.broker + 'brokerFactory').Broker
  , Checker = require(dirs.broker + 'exchangeChecker')
  , Trader = require(dirs.plugins + 'trader/trader')
  , JSON = require('JSON')
  , async = require('async')
  , ansicolor = require ('ansicolor').nice
  , asTable = require ('as-table').configure ({ delimiter: ' | ' })
  , Promise = require('bluebird')
  , ccxt = require('ccxt')
  , verbose   = process.argv.includes ('--verbose')
  , debug     = process.argv.includes ('--debug')
;

const config = util.getConfig();
const mode = util.gekkoMode();
/*
var current = Promise.resolve();
Promise.map(URLs, function (URL) {
    current = current.then(function () {
        return needle.getAsync(URL, options);
    });
    return current;
}).map(function (responseAndBody) {
    return JSON.parse(responseAndBody[1]);
}).then(function (results) {
    return processAndSaveAllInDB(results);
}).then(function () {
    console.log('All Needle requests saved');
}).catch(function (e) {
    console.log(e);
});
*/
Promise.promisifyAll(ccxt);

var exchange = Promise.resolve();
var balance = Promise.resolve();
Promise.map( Object.keys(config.multitrader), exName => {
  let gc = {...config.multitrader[exName]}
  gc.apiKey = gc.key;
  gc.password = gc.passphrase;
  let exchangeFound = ccxt.exchanges.indexOf (exName) > -1
  if (exchangeFound) {
  //let exchange = new ccxt.gdax (exch)
			exchange = exchange.then( () => {
      let e = new ccxt[exName] ({
				verbose,
        ...gc
			})
      e['name'] = exName
      return e
		});
	}
  return exchange;
}).map(ex => {
  balance = balance.then( () => {
    return ex.fetchBalance()
  });
  return balance;
}).then(balance => {
  console.log(balance);
}).catch( e=> console.log(e))
;
