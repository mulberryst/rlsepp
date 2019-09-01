'use strict';
const config = require('config')
  , RLSEPP = require('./librlsepp/js/lib/rlsepp').Rlsepp
  , verbose = process.argv.includes('--verbose')
  , debug = process.argv.includes('--debug')
  , fs = require("fs")
  , path = require('path')
  , util = require('util')
  , asTable = require ('as-table').configure ({ title: x => x.bright, delimiter: ' | '.dim.cyan, dash: '-'.bright.cyan })
  , asTableLog = require ('as-table').configure ({ title: x => x, delimiter: ' | ', dash: '-' })
;

var filename = path.basename(__filename);
var logStdout = process.stdout;
var logStderr = process.stderr;
var logFile = fs.createWriteStream(filename+'.log', { flags: 'w' }); 

console.debug = function () { logStderr.write(util.format.apply(null, arguments) + '\n'); };
console.error = function () { logStderr.write(util.format.apply(null, arguments) + '\n'); };
console.log = function () { logStdout.write(util.format.apply(null, arguments) + '\n'); };
console.json = function () { logFile.write(util.format.apply(null, arguments) + '\n'); };
console.info = function () { logStdout.write(util.format.apply(null, arguments) + '\n'); };

/*
Map.prototype.toJSON = function () {
    var obj = {}
    for(let [key, value] of this)
        obj[key] = (value instanceof Map) ? Map.toJSON(value) : value;

    return obj
}
*/

(async function main() {
  const rl = new RLSEPP();
  var apiCreds = config.get('gekko.pathingtest');
  await rl.initAsync(apiCreds, {verbose});
//  console.json(rl.e);

/*
  const apiBalances = await rl.fetchBalances();
  let printNice = asTable(sortBy(table, Object.values(table), 'value'))
  console.log(printNice)
  */
  //let printNice = asTable(sortBy(symbolHistogram.keys()
//    , Object.values(table), 'value'))
//  let table = rl.arbitrableCommodities().asTable()
//  console.log( asTable( table ) )

  table = await rl.fetchArbitrableTickers(rl.arbitrableCommodities())
  //console.log( table )
  let spreads = await rl.deriveSpreads( table )
  for (let spread of spreads) {
    if (spread.tickers.size() > 1) {
      console.log( spread.strip() )
    }
  }
//  console.log(asTableLog( spreads.asTable() ))
//  asTable.configure ({ print: x => (typeof x === 'boolean') ? (x ? 'yes' : 'no') : String (x) }) (data)

  /*
  for (let r of ixDict) {
    console.log(r.name)
    let tickerTable = r.tickers
    rl.showTickers(tickerTable)
  }
  */
//  await rl.showDerivedWallet();
})()
