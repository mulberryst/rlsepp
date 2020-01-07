'use strict';
const config = require('config')
  , RLSEPP = require('librlsepp').Rlsepp
  , verbose = process.argv.includes('--verbose')
  , debug = process.argv.includes('--debug')
  , fs = require("fs")
  , path = require('path')
  , util = require('util')
  , ansicolor = require ('ansicolor').nice
  , asTable = require ('as-table').configure ({ title: x => x.bright, delimiter: ' | '.dim.cyan, dash: '-'.bright.cyan })
  , log = require('ololog')
;

var filename = path.basename(__filename);
var logStdout = process.stdout;
var logStderr = process.stderr;
var logFile = fs.createWriteStream("/home/nathaniel/log/"+filename+'.log', { flags: 'w' }); 

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
  await rl.initStorable()

  let exchanges = rl.getExchangesWithAPIKeys()
  await rl.initAsync(exchanges, {verbose, timeout:12500, retry: 5});

  let spreads = rl.deriveSpreads( )

//  console.json(rl.e);

/*
  const apiBalances = await rl.fetchBalances();
  const table = rl.balancesToTable(apiBalances);
  let printNice = asTable(sortBy(table, Object.values(table), 'value'))
  console.log(printNice)
  */
  console.log('Exchange Balances'.green)
  let balances = await rl.showBalances();
//  log(JSON.stringify(balances))
})()
