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
  await rl.initStorable()
//  let ixExchanges = new IxDictionary(["yobit", "livecoin", "gemini", "crex24", "cex"])

  let opt = stdio.getopt({
    'from': {key: 'f', description: "Beginning exchange"},
    'to': {key: 't', description: "Ending exchange"},
    'all': {description: "Attempt brute forcing all transfers possible"},
    'file': {key: 'o', args:1, description: "Specifify output file name"},
    'currency': {key: 'c', args:1},
    'amount': {key: 'a', args:1},
    'exchange': {key: 'e', multiple: true}
  });

  let wallet = new IxDictionary({"USD": {currency:"USD", value: 1000, exchange: opt.from}})
  let originalCoefficient = 1 / wallet['USD'].value

  if (opt.wallet)
    wallet = new IxDictionary(JSON.parse(opt.wallet))

  if (opt.currency && opt.amount) {
    wallet = new IxDictionary()
    wallet.set(opt.currency, {currency:opt.currency, value: Number(opt.amount), exchange: opt.from})
  }

  let exchanges = rl.getCurrentTickerExchanges()
  if (opt.exchange && opt.exchange.constructor == Array) {
    exchanges = opt.exchange
  }

  log(exchanges)

  // initialize exchanges 
  //
  await rl.initAsync(exchanges, {verbose});

  let ixAC = rl.arbitrableCommodities(['USDT'])
  let k = [...ixAC.keys()]


  let level = 1
  let treeModel =  new TreeModel()
  let treeRoot = treeModel.parse({id:'1', wallet: wallet})
  let treeNode = treeRoot

  let we = walletValue(wallet)
  let wq = we.currency

  let spreads = rl.deriveSpreads()

  //  initial buy
  //
  //  brute force all 
  //
  if (opt.all) {
    for (let e of rl.getCurrentTickerExchanges()) {
      for (let symbol of rl.exchangeMarketsHavingQuote(e, wq)) {
        let ticker = rl.getTickerByExchange(e,symbol)
        if (ticker == null) {
//          log("No ticker data from "+e+" for "+symbol)
          continue
        }
        //
        let leafNode = rl.projectBuyTree(wallet.clone(), e, ticker, treeNode)

        if (!leafNode.hasChildren() && leafNode.model.action) { //is a child, projectBuy happened
          let amount = leafNode.model.action.amount
          let we = walletValue(leafNode.model.wallet)
          if (typeof we === 'undefined') {
            leafNode.drop()
            continue
          }

          let spread = spreads[we.currency+"/USD"]
//          log("spread for "+we.currency+"/USD")
//          log(spread)
          if (typeof spread === 'undefined') {
            leafNode.drop()
            continue
          }
          //re-base the amount on a mean average price for one sided amount comparison
          //
          if ( spread && ( (amount * originalCoefficient)
            / spreads[we.currency+"/USD"].meanAmountPerOneUSD
          ) < 0.95 )
            leafNode.drop()
        }
      }
    }
  } else {
    for (let symbol of rl.exchangeMarketsHavingQuote(opt.from, wq)) {
      let ticker = rl.getTickerByExchange(opt.from,symbol)
      rl.projectBuyTree(wallet.clone(), opt.from, ticker, treeNode)
    }
  }

  for (let i = 0; i<=1 ;i++) {
    //          let [base, quote] = symbol.split('/')
    // for each resulting currrency {crypto on from exchange
    level *= 1000
    for (let node of treeRoot.all(function (node) { return node.model.id >= level })) {
      let entry = walletValue(node.model.wallet)
      if (typeof entry === 'undefined')
        continue
      let quote = entry.currency
//      log(quote)

      for (let name of rl.dictExchange.keys()) {
        for (let symbol of rl.exchangeMarketsHavingQuote(name, quote)) {
          if (typeof rl.getTickerByExchange(name,symbol) !== 'undefined') {
//            log(symbol)
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

  level *= 1000
  //  
  for (let node of treeRoot.all(function (node) {
    return node.model.id >= level  
  })) {

    if ( node.model.action.action == 'buy' && node.model.action.exchange == opt.to)
      continue
    let entry = walletValue(node.model.wallet)
    if (typeof entry === 'undefined')
      continue
    try {
    if (opt.to && typeof rl.getTickerByExchange(opt.to,entry.currency+"/USD") !== 'undefined') {
      if (rl.canWithdraw(entry.exchange, entry.currency)) {
        rl.projectSellTree(node.model.wallet.clone(), opt.to, rl.getTickerByExchange(opt.to,entry.currency+"/USD"), node)
      }
    }
    } catch(e) {
      log(e)
    }
  }

  level *= 1000
  let transaction = {}


  let final = []
  for (let node of treeRoot.all(function (node) { 
    return  node.model.wallet.has('USD') && node.model.wallet.USD.value > 0
      && (node.model.wallet.USD.value > (wallet.USD.value - (wallet.USD.value * 0.05)))
      && (node.model.wallet.USD.value < (wallet.USD.value + (wallet.USD.value * 10)))
  }).sort((a,b) => 
    ((a.model.wallet.USD.value < b.model.wallet.USD.value) ? -1 : (a.model.wallet.USD.value > b.model.wallet.USD.value) ? 1 : 0)
  )) {
    final.push(node)
  }
 
 for (let node of final)
  {
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

  if (wallet.has("USD"))
    console.log("original wallet value: "+wallet.USD.value +" -5%:"+(wallet.USD.value - (wallet.USD.value* 0.05) ))

  var fileName = opt.file || 'events.transfer.'+opt.from+'.json'
  var eventFile = fs.createWriteStream(fileName, { flags: 'w' }); 
  eventFile.write(JSON.stringify(transaction, null, 4))

//  wallets.sort((a,b) => ((a.USD.value < b.USD.value) ? -1 : (a.USD.value > b.USD.value) ? 1 : 0))

})()
