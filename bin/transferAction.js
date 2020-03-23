'use strict';
const config = require('config')
  , stdio = require('stdio')
  , Rlsepp = require('librlsepp').Rlsepp
  , IxDictionary = require('librlsepp').IxDictionary
  , Wallet = require('librlsepp/js/lib/wallet').Wallet
  , WalletEntry = require('librlsepp/js/lib/wallet').WalletEntry
  , Event = require('librlsepp').Event
  , Events = require('librlsepp').Events
  , Ticker = require('librlsepp').Ticker
  , Tickers = require('librlsepp').Tickers
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
console.info = function () { logStdout.write(util.format.apply(null, arguments) + '\n'); };

log("Ensure that Crypto/Crypto quotes from exchanges are actually representing the quote currency!")

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
// let wallet = new IxDictionary({"USD": {currency:"USD", value: 1000, exchange: opt.from}})

function walletFromEvent(event=null) {
  //  if (!event instanceof Event) throw (new Error("walletFromEvent passed invalid object"+event))
  let wallet = new Wallet()
  let currency = null
  let amount = 0
  if (event && event.exchange && event.amountType && event.amount && event.amount > 0) {
    if (event.action == "buy" ) {
      currency = event.amountType
      amount = event.amount
    }
    if (event.action == "sell" ) {
      currency = event.costType
      amount = event.cost
    }
    wallet.add(new WalletEntry({currency:currency, value: amount, exchange: event.exchange}))
  }
  return wallet
}

let opt = stdio.getopt({
  'from': {required:false, args: 1, description: "Beginning exchange"},
  'currency': {key: 'c', args:1,description:"currency to project buy seeding "},
  'symbol': {args:1,description:"symbol to project buy seeding "},
  'to': {key: 't', args: 1,description: "Ending exchange"},
  'all': {description: "Attempt brute forcing all transfers possible"},
  'file': {args:1, description: "examine events file, use from and to from file"},
  'write': {key: 'w', args:1, description: "Specifify output file name"},
  'amount': {key: 'a', args:1},
  'exchange': {key: 'e', multiple: true}
});


let eobj = {currency:"USD", value: 1000}
if (opt.from)
  eobj.exchange = opt.from

let wallet = new Wallet(new WalletEntry(eobj))
let originalCoefficient = 1 / wallet[opt.from]['USD'].value

const treeModel = new TreeModel()
let treeRoot = treeModel.parse({id:'1', wallet:null})
let treeNode = treeRoot
let we = wallet.valueFirst()

//  if (opt.to) {} else throw new Error("--opt.to?")

;(async function main() {
  //  let ixExchanges = new IxDictionary(["yobit", "livecoin", "gemini", "crex24", "cex"])


  const rl = Rlsepp.getInstance();
  await rl.initStorable()

  //  if (opt.currency && opt.amount) {
  //    wallet = new Wallet({currency:opt.currency, value: opt.amount, exchange: opt.from})
  //    wallet = new Wallet(new WalletEntry({currency:opt.currency, value: opt.amount, exchange: opt.from}))
  //}

  let exchanges = rl.getCurrentTickerExchanges()
  if (opt.exchange && opt.exchange.constructor == Array) {
    exchanges = opt.exchange
  }

  log(exchanges.join(" "))

  // initialize exchanges 
  //
  await rl.initAsync(exchanges, {verbose});

  let ixAC = rl.arbitrableCommodities(['USDT'])
  let k = [...ixAC.keys()]

  let level = 1
  let treeModel =  new TreeModel()


  let spreads = rl.deriveSpreads()

  //  log(walletValueMeanUSD(wallet, spreads))
  //
  //  initial buy
  //  brute force all 
  //
  if (opt.all) {
    let wq = 'USD'
    for (let e of rl.getCurrentTickerExchanges()) {
      if (opt.to && e == opt.to)
        continue
      for (let symbol of rl.exchangeMarketsHavingQuote(e, wq)) {
        let ticker = rl.getTickerByExchange(e,symbol)
        if (ticker == null) {
          //remove ticker symbol from cache of exchangeMarketsHavingQuote
          //this one could be expensive
          rl.dictExchange[e].symbolsByQuote[wq].remove(symbol)
          log("No ticker data from "+e+" for "+symbol)
          continue
        }
        //
        //        log("seeding tree with "+symbol+" from "+e)
        let leafNode = rl.projectBuyTree(wallet.clone(), e, ticker, treeNode)
        log(leafNode)
        /*

        if (!leafNode.hasChildren() && leafNode.model.action) { //is a child, projectBuy happened
          let value = 0
          try {
            value = walletValueMeanUSD(leafNode.model.wallet, spreads)
          } catch(e) {
          }
          if (value < (wallet.USD.value + (wallet.USD.value - (wallet.USD.value * 0.05))))
            leafNode.drop()
        }
        */
      }
    }
  } else if (opt.file) {


    /*  used to set from and to */

    let jsonevents = null
    try {
      const contents = await fs.readFile(opt.file)
      jsonevents = JSON.parse(contents)
    } catch(e) {
      log(e.message)
    };

//    let fromEv = new Events()
//    fromEv[Symbol.iterator] = fromEv.__private__.iterator.fromTo()


    let fromTo = []
    for (let tid in jsonevents) {
      let transaction = jsonevents[tid]
      try {
        let first = transaction.shift()
        let last = transaction.pop()
        if (rl.dictExchange[first.exchange] && rl.dictExchange[last.exchange]) {
          fromTo.push([first,last])
        }
      } catch(e) {
        log(e)
      }
    }

    //
    //
    for (let [from,to] of fromTo) {
      let currency = null
      let amount = 0
      try {
        let w = walletFromEvent(from)

        let currency = w.currencyFirst()
        if (rl.canWithdraw(from.exchange, currency)) {
          for (let e of rl.getCurrentTickerExchanges()) {
            if (e != from.exchange) {
              for (let symbol of rl.exchangeMarketsHavingQuote(e, currency)) {
                let ticker = rl.getTickerByExchange(e,symbol)
                let leafNode = rl.projectBuyTree(w.clone(), e, ticker, treeNode, to)
              }
            }
          }
        } else {
          for (let symbol of rl.exchangeMarketsHavingQuote(from.exchange, currency)) {
            let ticker = rl.getTickerByExchange(from.exchange,symbol)
            let leafNode = rl.projectBuyTree(w.clone(), from.exchange, ticker, treeNode, to)
          }
        }
      } catch(e) {
        throw e
        //  log("bad wallet from: "+ev)
      }
    }
  } else {


    if (eobj.exchange) {} else throw new Error("--opt.from?")

    for (let symbol of rl.exchangeMarketsHavingQuote(eobj.exchange, "USD")) {
      //      for (let e of rl.getCurrentTickerExchanges()) {
      let ticker = rl.getTickerByExchange(opt.from,symbol)
      let wallet = new Wallet(new WalletEntry(eobj))

      let leaf = rl.projectBuyTree(wallet, opt.from, ticker, treeNode)
      //       log(leaf)
      //      }
    }
  }


  //////////
  //
  //
  let nodeCount = 0
  for (let i = 0; i<=1 ;i++) {
    //          let [base, quote] = symbol.split('/')
    // for each resulting currrency crypto on from exchange
    level *= 1000
    log("makes it to level "+level)

    for (let node of treeRoot.all(function (node) { return node.model.id >= level })) {
      let currency = node.model.wallet.currencyFirst()
      //of all,
      for (let name of rl.dictExchange.keys()) {
        //repeat buy
        if ( node.model.action.action == 'buy' && node.model.action.exchange == name)
          continue

        for (let symbol of rl.exchangeMarketsHavingQuote(name, currency)) {

          if (typeof rl.getTickerByExchange(name,symbol) !== 'undefined') {

            let leafNode = rl.projectBuyTree(node.model.wallet.clone(), name, rl.getTickerByExchange(name,symbol), node)
                        log(name + " " + symbol + JSON.stringify(node.model.wallet))
            /*
            if (!leafNode.hasChildren() && leafNode.model.action) { //is a child, projectBuy happened
              let value = 0
              try {
                value = walletValueMeanUSD(leafNode.model.wallet, spreads)
              } catch(e) {
              }
              if (value < (wallet.USD.value + (wallet.USD.value - (wallet.USD.value * 0.05)))) {
                try {
                log("dropping "+leafNode.model.action.id)
                } catch(e) {
                }
                leafNode.drop()
              }
            }
            */
          }
        } //buy
      }
    }
  }

  level *= 1000
  log("makes it to level "+level)
  let transaction = new IxDictionary()

  let final = []
  for (let node of treeRoot.all(function (node) { return node })) {
    if (node.model.action) {
      log("****")
      log(node.model.to)

      if (node.model.action.exchange == node.model.to.exchange) {
        let events = new Events()
        let path = node.getPath()
        for (let n of path) {
          log(n)
          let a = n.model.action
          if (typeof a !== 'undefined') {
            a.id = n.model.id
            let event = new Event(a)
            events.add(event)
          }
        }
        final.push(node)
        transaction[node.model.id] = events
      }
    }
  }

//  log("total tree count "+countTotal+", passing "+countPassing)
  final.sort((a,b) => 
    a.model.wallet.valueMeanUSD(spreads) < b.model.wallet.valueMeanUSD(spreads) ? -1 :
    a.model.wallet.valueMeanUSD(spreads) > b.model.wallet.valueMeanUSD(spreads) ? 1 : 0)


      /*
  if (opt.all) {
    for (let node of treeRoot.all(function (node) {
      let value = 0
      countTotal++
      try {
        value = walletValueMeanUSD(node.model.wallet, spreads)
      } catch(e) {
      }
      if (opt.to && node.model.action) 
        return node.model.action.exchange == opt.to
      return value > (wallet.USD.value + (wallet.USD.value - (wallet.USD.value * 0.05)))
    })) {
      countPassing++
      final.push(node)
    }
  } else {
    for (let node of treeRoot.all(function (node) { 
      if (opt.to && node.model.action) 
        final.push(node)
        push

      let entry = node.model.wallet.search('USD')

      if (node.model.wallet.has('USD')) {
      }
    }
  )

  log("makes it to final ")
  for (let node of final)
  {
    //let tweet = ""
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

//tweet = tweet + util.format("%d", walletValueMeanUSD(node.model.wallet, spreads));
//let entry = walletValue(node.model.wallet)
//if (entry && entry.currency != 'USD')
//`  tweet += " actual "+entry.currency
    log(node.model.id + " " + tweet)
    transaction[node.model.id] = events

  }

  if (wallet.has("USD")) {
    let entry = wallet.search("USD").shift()
    log("original wallet value: "+entry.value +" -5%:"+(Number(entry.value) - (Number(entry.value)* 0.05) ))
  }

*/
//if (opt.write) {
let fileName = "events.transfer."+process.pid+".json"
if (opt.write)
  fileName = opt.write
log("writing file "+fileName+" containing "+transaction.keys().length + " transactions")
var eventFile = fs.createWriteStream(fileName, { flags: 'w' }); 
eventFile.write(JSON.stringify(transaction, null, 4))
//}

//  wallets.sort((a,b) => ((a.USD.value < b.USD.value) ? -1 : (a.USD.value > b.USD.value) ? 1 : 0))

})()
