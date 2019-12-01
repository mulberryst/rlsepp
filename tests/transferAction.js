'use strict';
const config = require('config')
  , Rlsepp = require('./librlsepp').Rlsepp
  , IxDictionary = require('./librlsepp').IxDictionary
  , Spread = require('./librlsepp').Spread
  , Spreads = require('./librlsepp').Spreads
  , verbose = process.argv.includes('--verbose')
  , debug = process.argv.includes('--debug')
  , fs = require("mz/fs")
  , path = require('path')
  , util = require('util')
  , asTable = require ('as-table').configure ({ title: x => x.bright, delimiter: ' | '.dim.cyan, dash: '-'.bright.cyan })
  , asTableLog = require ('as-table').configure ({ title: x => x, delimiter: ' | ', dash: '-' })
  , TreeModel = require('tree-model')
  , LTT = require('list-to-tree')
  , moment = require('moment')
  , JSON = require('JSON')
;

var filename = path.basename(__filename);
var logStdout = process.stdout;
var logStderr = process.stderr;
var now = moment()

console.debug = function () { logStderr.write(util.format.apply(null, arguments) + '\n'); };
console.error = function () { logStderr.write(util.format.apply(null, arguments) + '\n'); };
console.log = function () {
  logStdout.write(util.format.apply(null, arguments) + '\n');
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

(async function main() {
  const rl = Rlsepp.getInstance();
//  let ixExchanges = new IxDictionary(["yobit", "livecoin", "gemini", "crex24", "cex"])

//  await rl.initAsync(config.get("exchanges"), {verbose});
  await rl.initAsync(['yobit', 'gemini'], {verbose});

  let ixAC = rl.arbitrableCommodities(['USDT'])
  let k = [...ixAC.keys()]

  /*
  for (let c of k.sort((a,b) => (a < b)?-1:(a>b)?1:0)) {
    console.log(c+' '+ixAC[c])
  }
  */

  let table = await rl.fetchArbitrableTickers(ixAC, ['USD', 'BTC', 'ZEC'])
  console.log(JSON.stringify(table, null ,4))

//  let wt = rl.basis.clone()
  let w = new IxDictionary( {
    "LSK": {symbol: "LSK", value:1248.43636513, exchange: "yobit"},
    "ZEC": {symbol: "ZEC", value:29.51168300, exchange: "livecoin"},
    "USD": {symbol: "USD", value:1000, exchange: "yobit"},
  })

  let [from,to] = ["yobit","gemini"]
  try {
//    for await (let [from, to] of ixExchanges) {
      console.log(from+' '+to)
      let move = rl.transferAction(w, from, to, table)
      console.log(move)
      console.log(w)
//    }

  } catch(e) {
    throw e
//    console.log('Caught:', e.message);
  }

})()
