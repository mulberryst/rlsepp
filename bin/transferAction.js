'use strict';
const config = require('config')
  , stdio = require('stdio')
  , Rlsepp = require('librlsepp').Rlsepp
  , IxDictionary = require('librlsepp').IxDictionary
  , Ticker = require('librlsepp').Ticker
  , Spread = require('librlsepp').Spread
  , Spreads = require('librlsepp').Spreads
  , Storable = require('librlsepp').Storable
  , verbose = process.argv.includes('--verbose')
  , debug = process.argv.includes('--debug')
  , fs = require("mz/fs")
  , path = require('path')
  , util = require('util')
  , asTable = require ('as-table').configure ({ title: x => x.bright, delimiter: ' | '.dim.cyan, dash: '-'.bright.cyan })
  , asTableLog = require ('as-table').configure ({ title: x => x, delimiter: ' | ', dash: '-' })
  , TreeModel = require('tree-model')
  , moment = require('moment')
  , JSON = require('JSON')
  , log = require('ololog')
;

var eventFile= fs.createWriteStream('events.transfer.json', { flags: 'w' }); 
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

function walletValue(wallet) {
  let r = []
  for (let symbol of wallet) {
    if (symbol.value > 0)
      r.push(symbol)
  }
  if (r.length > 1)
    throw new Error("wallet should only have one value " + JSON.stringify(wallet))
  return r[0]
}

(async function main() {
  const rl = Rlsepp.getInstance();
//  let ixExchanges = new IxDictionary(["yobit", "livecoin", "gemini", "crex24", "cex"])

  let opt = stdio.getopt({
    'from': {key: 'f', args: 1, mandatory: true, description: "Beginning exchange"},
    'to': {key: 't', args: 1, description: "Ending exchange"},
    'wallet': {key: 'w', args: 1, description: "Beginning wallet (JSON)"},
  });

  let allExchanges = config.get('exchanges')
  await rl.initAsync(allExchanges, {verbose});

  let ixAC = rl.arbitrableCommodities(['USDT'])
  let k = [...ixAC.keys()]

  //let wallet = new IxDictionary({"USD": {currency:"USD", value: 1000, exchange: from}})
  let wallet = new IxDictionary({"USD": {currency:"USD", value: 1000, exchange: opt.from}})

  let level = 1
  let treeModel =  new TreeModel()
  let treeRoot = treeModel.parse({id:'1', wallet: wallet})
  let treeNode = treeRoot


  await rl.retrieve(null, 'tickers')
  for (let fromTicker of rl.getTickerByExchange(opt.from)) {
    rl.projectBuyTree(wallet.clone(), opt.from, fromTicker, treeNode)
  }

  for (let i = 0; i<=1 ;i++) {
    //          let [base, quote] = symbol.split('/')
    // for each resulting currrency {crypto on from exchange
    level *= 100
    for (let node of treeRoot.all(function (node) { return node.model.id >= level })) {
      let entry = walletValue(node.model.wallet)
      if (typeof entry === 'undefined')
        continue
      let quote = entry.currency

      for (let name of rl.dictExchange.keys()) {
        for (let symbol of rl.exchangeMarketsHavingQuote(name, quote)) {
          if (typeof rl.getTickerByExchange(name,symbol) !== 'undefined') {
            if (quote == 'USD' && name != entry.exchange)
              continue
//            console.log(name + " " + symbol + JSON.stringify(node.model.wallet))
            rl.projectBuyTree(node.model.wallet.clone(), name, rl.getTickerByExchange(name,symbol), node)
          }
        }
        if ( node.model.action.action == 'buy' && node.model.action.exchange == name)
          continue
        if (typeof rl.getTickerByExchange(name,entry.currency+"/USD") !== 'undefined') {
          if (rl.canWithdraw(entry.exchange, entry.currency)) {
            rl.projectSellTree(node.model.wallet.clone(), opt.to, rl.getTickerByExchange(name,entry.currency+"/USD"), node)
          }
        }
      }
    }
  }

  level *= 100
  //  
  for (let node of treeRoot.all(function (node) {
    return node.model.id >= level  
  })) {

    if ( node.model.action.action == 'buy' && node.model.action.exchange == opt.to)
      continue
    let entry = walletValue(node.model.wallet)
    if (typeof entry === 'undefined')
      continue
    if (opt.to && typeof rl.getTickerByExchange(opt.to,entry.currency+"/USD") !== 'undefined') {
      if (rl.canWithdraw(entry.exchange, entry.currency)) {
        rl.projectSellTree(node.model.wallet.clone(), opt.to, rl.getTickerByExchange(opt.to,entry.currency+"/USD"), node)
      }
    }
  }

  level *= 100
  let transaction = {}
  for (let node of treeRoot.all(function (node) { 
    return  node.model.wallet.has('USD') && node.model.wallet.USD.value > 0 && 
      (node.model.wallet.USD.value > (wallet.USD.value - (wallet.USD.value * 0.05)))
      && (node.model.wallet.USD.value < (wallet.USD.value + (wallet.USD.value * 4)))
  }).sort((a,b) => 
    ((a.model.wallet.USD.value < b.model.wallet.USD.value) ? -1 : (a.model.wallet.USD.value > b.model.wallet.USD.value) ? 1 : 0)
  )) {
    let tweet = ""
    let path = node.getPath()
    let events = []
    for (let n of path) {
      //let e[n.model.action + "_" + a.amountType + "_" + a.costType] = []
      let a = n.model.action
      if (typeof a !== 'undefined') {
        //e.exchange = a.exchange
        a.id = n.model.id
        events.push(a)
        if (a.action == 'move') {
          tweet = tweet + util.format("%s %s %s %d |", a.action, a.from_exchange, a.to_exchange,a.amount); 
        } else if (a.action == 'buy' || a.action == 'sell') {
          tweet = tweet + util.format("%s %s %s/%s %s %d |", a.action, a.exchange, a.amountType, a.costType, a.priceType, a.price); 
        } else {
          tweet = tweet + "|"
        }
      }
    }
    tweet = tweet + util.format("%d", node.model.wallet.USD.value);
    console.log(node.model.id + " " + tweet)
    transaction[node.model.id] = events

  }

  console.log("original wallet value: "+wallet.USD.value +" -5%:"+(wallet.USD.value - (wallet.USD.value* 0.05) ))
  eventFile.write(JSON.stringify(transaction, null, 4))

//  wallets.sort((a,b) => ((a.USD.value < b.USD.value) ? -1 : (a.USD.value > b.USD.value) ? 1 : 0))

})()
