'use strict';
const config = require('config')
  , Getopt = require('node-getopt')
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
/*
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
*/
let getopt = new Getopt([
  ['b', 'balance', 'seed buys with all available with current balnces'],
  ['f', 'file=ARG', 'transaction file to draw from'],
  ['w', 'write=ARG', 'file name to write output'],
  ['h' , 'help'                , 'display this help'],
  ['v' , 'version'             , 'show version']
])              // create Getopt instance
.bindHelp();     // bind option 'help' to default action

let opt = getopt.parse(process.argv.slice(2)).options;
//  console.info({argv: opt.argv, options: opt.options});
log(opt)


let eobj = {currency:"USD", value: 1000}
if (opt.from)
  eobj.exchange = opt.from

let beginsOn = []
let endsOn = []
if (opt.to)
  endsOn.push(opt.to)


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

//  log(exchanges.join(" "))

  // initialize exchanges 
  //
  await rl.initAsync(exchanges, {verbose});

  let ixAC = rl.arbitrableCommodities(['USDT'])
  let k = [...ixAC.keys()]

  let level = 1

  let spreads = rl.deriveSpreads()

let balance = await rl.showBalances(spreads)

let wallet = balance;
//log(wallet);
  //let wallet = new Wallet(new WalletEntry(eobj));

//let originalCoefficient = 1 / wallet[opt.from]['USD'].value

const treeModel = new TreeModel()
let treeRoot = treeModel.parse({id:'1', wallet:null})
let treeNode = treeRoot
let we = wallet.valueFirst()
  let transactions = null
  let nodeCount = 0
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

    let jsonevents = null
    try {
      const contents = await fs.readFile(opt.file)
      jsonevents = JSON.parse(contents)
    } catch(e) {
      log(e.message)
    };

    transactions = new Events(jsonevents)
    transactions.trimLoss(2)
    let tids = transactions.keysByProfit()

    for (let exchange of transactions.exchangeBeginsOn()) {
      beginsOn.push(exchange)
    }
    for (let exchange of transactions.exchangeEndsOn()) {
      endsOn.push(exchange)
    }
    log("transaction count in file with profits of 2 USD or greater: "+transactions.count())

    //  for all currency in wallet
    //
    for (let exchange of wallet.exchanges()) {
      for (let currency of wallet.currency(exchange)) {

        //  check each transaction from min/max
        //  project a transfer, or a buy from something the begining exchange has a market for
        //  (order books will be checked in subsequent process
        //
        for (let t of tids) {
          transactions.print(t)

          let ev = transactions.first(t)
          let beginexchange = ev.exchange

          let eobj = {currency:currency, value: wallet.valueOf(currency, exchange), exchange:exchange}; 
          let w = new Wallet(new WalletEntry(eobj))

          if (beginsOn.indexof(exchange) > -1) {
            let eobj = {currency:currency, value: wallet.valueOf(currency, exchange), exchange:exchange}; 
            let w = new Wallet(new WalletEntry(eobj))
//            let leaf = rl.projectTransferTree(w, exchange, currency, treeNode, t)
            try {
              let ticker = rl.getTickerByExchange(name,symbol)
              let leafNode  //either node or child 
              if (ticker) {
                let w = new Wallet(new WalletEntry(eobj))
                leafNode = rl.projectSellTree(w, name, ticker, treeNode)
                nodeCount++;
              }
            } catch (e) {
              //          log(e)
            }
          }

          for (let symbol of rl.exchangeMarketsHavingQuote(beginexchange, currency)) {
            let eobj = {currency:currency, value: wallet.valueOf(currency, exchange), exchange:exchange}; 
            let w = new Wallet(new WalletEntry(eobj))

            let ticker = rl.getTickerByExchange(exchange,symbol)
            let leaf = rl.projectBuyTree(w, exchange, ticker, treeNode, t)
            nodeCount++;
          }
        }
      }
    }

  } else {

    transactions = new Events();

    for (let exchange of wallet.exchanges()) {
      for (let currency of wallet.currency(exchange)) {

        for (let symbol of rl.exchangeMarketsHavingQuote(exchange, currency)) {
          //      for (let e of rl.getCurrentTickerExchanges()) {
          let ticker = rl.getTickerByExchange(exchange,symbol)
          let eobj = {currency:currency, value: wallet.valueOf(currency, exchange), exchange:exchange}; 
          let w = new Wallet(new WalletEntry(eobj))

          let leaf = rl.projectBuyTree(w, exchange, ticker, treeNode)
          nodeCount++;
        }
      }
    }
  }

  //////////
  //
  //
  for (let i = 0; i<2 ;i++) {
    //          let [base, quote] = symbol.split('/')
    // for each resulting currrency crypto on from exchange
    level *= 1000
    log("makes it to level "+level+ " nodeCount "+nodeCount)

    for (let node of treeRoot.all(function (node) { return node.model.id >= level })) {
      let currency = node.model.wallet.currencyFirst()
      let value = node.model.wallet.valueOf(currency)
      let exchange = node.model.wallet.exchangeOf(currency)

//      log(currency + " " + value)

      //from --file
      for (let name of endsOn) {
        let leaf = await rl.projectTransferTree(node.model.wallet.clone(), name, currency, node)
        nodeCount++;
      }

      //      }
      //of all,
      for (let name of rl.dictExchange.keys()) {

            if ( node.model.action.action != 'sell' && node.model.action.exchange != name && rl.canWithdraw(exchange,currency)) {
//              log('hi')
              let symbol = currency+"/USD"
              try {
                let t = rl.getTickerByExchange(name,symbol)
                let leafNode  //either node or child 
                if (t) {
                  let w = new Wallet(new WalletEntry({currency:currency, value:value, exchange: name}))
                  leafNode = rl.projectSellTree(w, name, t, node)
                  nodeCount++;
//                  log(name + " " + currency + " sell")
//        log(leafNode)
                }
              } catch (e) {
                //          log(e)
              }
            }

        for (let symbol of rl.exchangeMarketsHavingQuote(name, currency)) {

          //heuristics
          //
          //  rule out bad transactions
          //
          //
          //  if last transaction was sell, we now have USD
          //  possible reasons  this is valid?
          //    -to end on this exchange and valuate (this is last step, not needed here)
          //    -exchange doesn't have market for different crypto to purchase with this one (this shouldn't exist)
          //
          if (node.model.action.action == 'sell')
            continue;

          //cant withdraw, purchase with currency on a different exchange
          if (name != exchange && !rl.canWithdraw(exchange, currency))
            continue;

          if (typeof rl.getTickerByExchange(name,symbol) !== 'undefined') {

            let w = new Wallet(new WalletEntry({currency:currency, value:value, exchange: name}))
            let leafNode = rl.projectBuyTree(w, name, rl.getTickerByExchange(name,symbol), node)
            nodeCount++;
//                  log(name + " " + currency + " buy "+symbol)
            /*
            if (!leafNode.hasChildren() && leafNode.model.action) { //is a child, projectBuy happened
              let value = 0
              try {
                alue = walletValueMeanUSD(leafNode.model.wallet, spreads)
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
  log("makes it to level "+level+", sell (nodeCount "+nodeCount+")")

  for (let node of treeRoot.all(function (node) { return node.model.id >= level })) {
    let currency = node.model.wallet.currencyFirst()
    let value = node.model.wallet.valueOf(currency)

    if ( node.model.action.action == 'sell')
      continue

    let exchange = node.model.action.exchange
    //      for (let name of endsOn) {
    let w = new Wallet(new WalletEntry({currency:currency, value:value, exchange: exchange}))

    let symbol = currency+"/USD"
    try {
      let t = rl.getTickerByExchange(exchange,symbol)
      let leafNode  //either node or child 
      if (t) {
        leafNode = rl.projectSellTree(w, exchange, t, node)
        nodeCount++;
//        log(leafNode)
      }
    } catch (e) {
      //          log(e)
    }
    //      }

  } //buy

  /*
  for (let node of treeRoot.all(function (node) { 
    return node.model.id >= level 
  })) {
    let path = node.getPath()
    let eobj = []
    for (let e of path) {
      if (e.model.action)
        eobj.push(e.model.action)
    }
    log(eobj)
    let transaction = new Events(eobj)
    if (transaction.exchangeEndsOn(opt.to))
      transaction.print()
  }
  */

 log("nodeCount "+nodeCount);
 log("ends on one of: ")
 log(endsOn) 


  log("walking tree");
  let ft = new Events()
    for (let node of treeRoot.all(function (node) { 
//    return node.model.id >= level && node.model.action.action == "sell"
//    return !node.hasChildren() && node.model.action && node.model.action.action == "sell"
    return !node.hasChildren() && node.model.action && node.model.action.action == "sell"
  })) {
      let fkey = node.model.id + "_" + node.model.action.exchange
      let costTicker = null

      let path = node.getPath()

      let costBasis = 0  //in USD

      //  first action must be "buy"
      //
      if (path[1].model.action.costType == "USD")
        costBasis = path[1].model.action.cost
      else {
        let f = walletFromEvent(path[1].model.action)

        try {
          costTicker =  rl.getTickerByExchange(path[1].model.action.exchange, path[1].model.action.costType + "/USD");
          costBasis = costTicker.ask * Number(path[1].model.action.cost)
        } catch(e) {
          log(e);
          continue;
        }
      }

      if (Number(node.model.wallet.valueOf("USD", node.model.action.exchange)) > Number(costBasis)) {
        let transaction = new Events();

        for (let n of path) {
          if (n.model.action) {
            n.model.action.transaction_tag = fkey
            let a = n.model.action
            if (a) {
              let event = new Event(a)
//              event.valueUSD = n.model.wallet.valueUSD(event.exchange,rl.tickerByExchange)
//              event.w = f
//              event.costBasis = costBasis
              transaction.add([event], fkey)
            }
          }
        }
        ft.merge(transaction)
      }
  }

//  delete treeRoot;
//  delete treeNode;

  log('event count with USD value > (costBasis + 2)' + ft.count());
  log('correcting events');
  //  have correct events check against walletstatus and canTransfer
  ft = await rl.correctEvents(ft);

  // look for walletStatus of BCH on yobit
  ft = rl.applyExceptionsEvents(ft)

  ft = await rl.fetchDepositAddresses(ft);

  ft = await rl.checkMoves(ft);

  log('applyExceptions');
  /*
  for (let n of final.keys()) {
      if (endsOn.indexOf(node.model.action.exchange) > -1) {
        let events = []
        let tid = null
        for (let n of path) {
          if (n.model.tid)
            tid = n.model.tid
          let a = n.model.action
          n.model.tid = tid
          if (a) {
            a.id = n.model.id
            let event = new Event(a)
            events.push(event)
          }
        }
        final.add(events,tid)
      }
    }
  }
  */


//  log("total tree count "+countTotal+", passing "+countPassing)

//  let tids = transaction.keysByProfit()
//  tids.filter(tid => transaction.profit(tid) >= -50


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
  log("writing file "+fileName+" containing "+ft.keys().length + " transactions")
  var eventFile = fs.createWriteStream(fileName, { flags: 'w' }); 
  eventFile.write(JSON.stringify(ft, null, 4))
  //}

//  wallets.sort((a,b) => ((a.USD.value < b.USD.value) ? -1 : (a.USD.value > b.USD.value) ? 1 : 0))

})()
