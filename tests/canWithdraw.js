'use strict';
const config = require('config')
  , Rlsepp = require('./librlsepp').Rlsepp
  , IxDictionary = require('./librlsepp').IxDictionary
  , Spread = require('./librlsepp').Spread
  , Spreads = require('./librlsepp').Spreads
  , verbose = process.argv.includes('--verbose')
  , debug = process.argv.includes('--debug')
  , fs = require("fs")
  , path = require('path')
  , util = require('util')
  , asTable = require ('as-table').configure ({ title: x => x.bright, delimiter: ' | '.dim.cyan, dash: '-'.bright.cyan })
  , asTableLog = require ('as-table').configure ({ title: x => x, delimiter: ' | ', dash: '-' })
  , TreeModel = require('tree-model')
  , LTT = require('list-to-tree')
  , moment = require('moment')
  , log4js = require('log4js')
;

const logger = log4js.getLogger('dual');
var filename = path.basename(__filename);
var logStdout = process.stdout;
var logStderr = process.stderr;
var now = moment()
var logFile = fs.createWriteStream('/home/nathaniel/log/' + filename+'.'+now.format('YYYYMMDD.HHmm')+'.log', { flags: 'w' }); 
var logFile2 = fs.createWriteStream('/home/nathaniel/log/synopsis.'+now.format('YYYYMMDD.HHmm')+'.log', { flags: 'w' }); 
var logFile3 = fs.createWriteStream('/home/nathaniel/log/notice.log', { flags: 'w' }); 

console.debug = function () { logStderr.write(util.format.apply(null, arguments) + '\n'); };
console.error = function () { logStderr.write(util.format.apply(null, arguments) + '\n'); };
console.log = function () {
  logStdout.write(util.format.apply(null, arguments) + '\n');
};
console.spread = function () { logFile.write(util.format.apply(null, arguments) + '\n'); };
console.paths = function () {
  logFile2.write(util.format.apply(null, arguments) + '\n');
};
console.fiveAndOver = function () {
  logFile3.write(util.format.apply(null, arguments) + '\n');
};
console.info = function () { logStdout.write(util.format.apply(null, arguments) + '\n'); };

console.log("Ensure that Crypto/Crypto quotes from exchanges are actually representing the quote currency!")

/*
Map.prototype.toJSON = function () {
    var obj = {}
    for(let [key, value] of this)
        obj[key] = (value instanceof Map) ? Map.toJSON(value) : value;

    return obj
}
*/

const sortBy = (array, key, descending = false) => {
     descending = descending ? -1 : 1
     return array.sort ((a, b) => ((a[key] < b[key]) ? -descending : ((a[key] > b[key]) ? descending : 0)))
}

let smallAmount = {
};

(async function main() {
  const rl = Rlsepp.getInstance();
  let ixExchanges = new IxDictionary(["yobit", "cex"])
//  await rl.initAsync(config.get("exchanges"), {verbose});
  await rl.initAsync(ixExchanges, {verbose});

//  let ixAC = rl.arbitrableCommodities(['USDT'])
//  console.log(JSON.stringify(ixAC, null ,4))
//  throw('yey')

//  console.log(JSON.stringify(rl.dictExchange, null, 4))
//  throw('exit')

  let ixC = new IxDictionary()
  for (let e of ixExchanges) {
    for (let c of rl.dictExchange[e].commodities) {
      ixC.set(c.name, [e, e])
    }
  }

  let table = await rl.fetchArbitrableTickers(ixC, ['USD','BTC'])
//  console.log( asTableLog( table ) )


  try {
    await rl.showBalances()
  } catch(e) {
    logger.error(e)
  };

  /*
  let spreads = rl.deriveSpreads( table )

//  const r = await rl.safeMoveMoneyAsync('ZEC', 'gemini', 'livecoin', table, 29.511683)

  let baseForExchange = new IxDictionary()
  for (let spread of spreads) {
    for (let exchange in spread.tickers) {
      if (!baseForExchange.has(spread.commodity.symbol))
        baseForExchange.set(spread.commodity.symbol,new IxDictionary())
      baseForExchange[spread.commodity.symbol].set(exchange,exchange)
    }
  }
  */

  /* 
   * Market data
 "UNRC/USD": {
        "limits": {
            "amount": {
                "min": 10500,
                "max": 100000000
            },
            "price": {
                "min": 0.00001,
                "max": 100000
            }
        },
        "precision": {
            "price": 5,
            "amount": 8,
*/

//  for (let base in baseForExchange) {
  for (let [from,to] of ixExchanges.Iterable('fromTo')) {
    for (let c of rl.dictExchange[from].commodities) {
      //    for (let from of baseForExchange[base]) {
      console.log(c.name + ' ' +from+' -> '+to)
      //      let ixSupporting = 
      //make a list of exchanges supporting the currency
      //use iteratorFromTo to validate the withdraw/deposit addresses

      try {
        const r = await rl.safeMoveMoneyAsync(c.name, from, to, table, 0.0001)
      } catch(e) {
        logger.error(e)
      };
    }
  }
//  }

  var cacheFile = fs.createWriteStream('.addresses.json', { flags: 'w' });
  cacheFile.write( JSON.stringify(rl.addresses, null, 4) )


})()
