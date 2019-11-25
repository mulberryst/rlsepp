'use strict';
const config = require('config')
  , RLSEPP = require('./librlsepp').Rlsepp
  , verbose = process.argv.includes('--verbose')
  , debug = process.argv.includes('--debug')
  , fs = require("fs")
  , path = require('path')
  , util = require('util')
  , asTable = require ('as-table').configure ({ title: x => x.bright, delimiter: ' | '.dim.cyan, dash: '-'.bright.cyan })
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
  var apiCreds = config.get('gekko.multitrader');
  await rl.initAsync(apiCreds, {verbose});
//  console.json(rl.e);

/*
  const apiBalances = await rl.fetchBalances();
  const table = rl.balancesToTable(apiBalances);
  let printNice = asTable(sortBy(table, Object.values(table), 'value'))
  console.log(printNice)
  */
  await rl.showBalances();
  await rl.showDerivedWallet();
})()
