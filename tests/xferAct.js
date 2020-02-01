'use strict';
const config = require('config')
  , Rlsepp = require('./librlsepp').Rlsepp
  , IxDictionary = require('./librlsepp').IxDictionary
  , Ticker = require('./librlsepp').Ticker
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

  let exchanges
  var myArgs = process.argv.slice(2);
  if (myArgs.length > 1)
    exchanges = myArgs
  else
    exchanges = config.get('exchanges')

  await rl.initAsync(exchanges, {verbose});

  let ixAC = rl.arbitrableCommodities(['USDT'],exchanges)
  let k = [...ixAC.keys()]

  /*
  for (let c of k.sort((a,b) => (a < b)?-1:(a>b)?1:0)) {
    console.log(c+' '+ixAC[c])
  }
  */

  let from = exchanges.shift()

  let table = await rl.fetchArbitrableTickers(ixAC, ['USD', 'BTC', 'ETH', 'LTC'])

  if (rl.tickerByExchange == null)
    throw new Error("no tickers")

//  console.log(JSON.stringify(rl.tickerByExchange, null, 4))
//  throw new Error("wee")

  let wallet = {"USD": {symbol:"USD", value: 1000}}

  let level = 1
  let ledgerTree =  new TreeModel()
  let ledgerRoot = ledgerTree.parse({id:'1', wallet: wallet})
  let ledgerNode = ledgerRoot

  let wallets = []

  for (let fromTicker of rl.tickerByExchange[from]) {
    let toTicker = rl.tickerByExchange[to][fromTicker.symbol]
    if (typeof toTicker === 'undefined')
      continue;

    rl.projectBuyTree(new IxDictionary(wallet), from, fromTicker, ledgerNode)
  }

  // for each resulting currrency {crypto on from exchange
  level *= 100
  for (let node of treeRoot.all(function (node) { return node.model.id > level })) {
    let [base, quote] = fromTicker.symbol.split('/')

    for (let name of exchanges) {
      for (let symbol of rl.exchangeMarketsHavingQuote) {
      }
    }
    for (let fromTicker of rl.tickerByExchange[from]) {
    rl.projectBuyTree(node.model.wallet.clone(), from, fromTicker, ledgerNode)
    try {
      [move, wallet] = rl.projectTransfer(wallet, from, to, base)
      moves.push({...move})
    } catch(e) {
      console.log(e)
      continue
    }
    for (let ticker of rl.tickerByExchange[to]) {
      let [fbase, fquote] = ticker.symbol.split('/')
      if (fbase != base)
        continue
    }

    try {
      [move, wallet] = rl.projectSell(wallet, to, toTicker)
      moves.push({...move})
    } catch(e) {
      console.log(e)
      continue
    }

    wallet.ledger = moves
    wallets.push(wallet)
  }

  wallets.sort((a,b) => ((a.USD.value < b.USD.value) ? -1 : (a.USD.value > b.USD.value) ? 1 : 0))

  console.log(JSON.stringify(wallets.shift(), null, 4))
  console.log(JSON.stringify(wallets.pop(), null, 4))

})()
