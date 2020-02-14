'use strict';
const config = require('config')
  , stdio = require('stdio')
  , Rlsepp = require('librlsepp').Rlsepp
  , IxDictionary = require('librlsepp').IxDictionary
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
class Wallet extends IxDictionary {
  constructor(obj) {
  }
}

function walletFromEvent(event=null) {
  //  if (!event instanceof Event) throw (new Error("walletFromEvent passed invalid object"+event))
  let wallet = new IxDictionary()
  let currency = null
  let amount = 0
  if (event && event.exchange && event.amountType && event.amount && event.amount > 0) {
    if (ev.action == "buy" ) {
      currency = event.amountType
      amount = event.amount
    }
    if (ev.action == "sell" ) {
      currency = event.costType
      amount = event.cost
    }
    wallet.set(amount, {currency:currency, value: Number(amount), exchange: event.exchange})
  }
  return wallet
}

function walletValue(wallet) {
  let r = []
  for (let symbol of wallet) {
    if (symbol.value > 0)
      r.push(symbol)
  }
  if (r.length > 1)
    throw new Error("wallet should only have one value " + JSON.stringify(wallet))
  if (r.lengh == 0 || typeof r[0] === 'undefined')
    r.push({USD:{currency:"USD", value:0}})
  return r[0]
}

function walletValueMeanUSD(wallet, spreads) {
  let spread = null
  let we = walletValue(wallet)
  if (we) {
    if (we.currency == "USD")
      return we.value
    spread = spreads[we.currency+"/USD"]
  }
  if (typeof spread === 'undefined') {
    return 0
    // throw(new Error("No spread for "+we.currency+" in USD"))
  }

  //re-base the amount on a mean average price for one sided amount comparison
  return we.value / spreads[we.currency+"/USD"].meanAmountPerOneUSD 
}

(async function main() {
  //  let ixExchanges = new IxDictionary(["yobit", "livecoin", "gemini", "crex24", "cex"])

  let opt = stdio.getopt({
    'from': {required:false, args: 1, description: "Beginning exchange"},
    'to': {key: 't', args: 1,description: "Ending exchange"},
    'all': {description: "Attempt brute forcing all transfers possible"},
    'file': {args:1, description: "examine events file, use from and to from file"},
    'write': {key: 'w', args:1, description: "Specifify output file name"},
    'currency': {key: 'c', args:1},
    'amount': {key: 'a', args:1},
    'exchange': {key: 'e', multiple: true}
  });


  const rl = Rlsepp.getInstance();
  await rl.initStorable()

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

  log(exchanges.join(" "))

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

  //  log(walletValueMeanUSD(wallet, spreads))

  //  initial buy
  //
  //  brute force all 
  //
  if (opt.all) {
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
    let fromEv = new Events()
    let toEv = new Events()
    for (let tid in jsonevents) {
      let transaction = jsonevents[tid]
      try {
        let last = transaction[transaction.length - 1]
        fromEv.merge(new Events([last]))
        toEv.merge(new Events([transaction[0]]))
      } catch(e) {
        log(e)
      }
    }
    for (let name in fromEv) {
      for (let ev of fromEv[name]) {
        let currency = null
        let amount = 0
        try {
          let w = walletFromEvent(ev)
          let v = walletValue(w)

          if (rl.canWithdraw(ev.exchange, v.currency)) {
            for (let e of rl.getCurrentTickerExchanges()) {
              if (e != ev.exchange) {
                for (let symbol of rl.exchangeMarketsHavingQuote(e, v.currency)) {
                  let ticker = rl.getTickerByExchange(e,symbol)
                  log("seeding tree with "+e+":"+v.currency)
                  let leafNode = rl.projectBuyTree(w.clone(), e, ticker, treeNode)
                }
              }
            }
          } else {
            for (let symbol of rl.exchangeMarketsHavingQuote(ev.exchange, v.currency)) {
              let ticker = rl.getTickerByExchange(ev.exchange,symbol)
              log("seeding tree with "+ev.exchange+":"+v.currency)
              let leafNode = rl.projectBuyTree(w.clone(), ev.exchange, ticker, treeNode)
            }
          }
        } catch(e) {
          log("bad wallet from: "+ev)
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
  log("makes it to level "+level)
    for (let node of treeRoot.all(function (node) { return node.model.id >= level })) {
      let entry = walletValue(node.model.wallet)
      if (typeof entry === 'undefined')
        continue
      let quote = entry.currency
      //      log(quote)

      for (let name of rl.dictExchange.keys()) {
        if ( node.model.action.action == 'buy' && node.model.action.exchange == name)
          continue
        for (let symbol of rl.exchangeMarketsHavingQuote(name, quote)) {
          if (typeof rl.getTickerByExchange(name,symbol) !== 'undefined') {
            if (quote == 'USD' && name != entry.exchange)
              continue
            let leafNode=   rl.projectBuyTree(node.model.wallet.clone(), name, rl.getTickerByExchange(name,symbol), node)
            //            log(name + " " + symbol + JSON.stringify(node.model.wallet))
            //            
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
        if (typeof rl.getTickerByExchange(name,entry.currency+"/USD") !== 'undefined') {
          if (rl.canWithdraw(entry.exchange, entry.currency)) {
            rl.projectSellTree(node.model.wallet.clone(), name, rl.getTickerByExchange(name,entry.currency+"/USD"), node)
          }
        }
      }
    }
  }

  level *= 1000
  log("wee makes it to level "+level)
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
  log("makes it to level "+level)
  let transaction = new IxDictionary()


  let final = []
  let countTotal = 0
  let countPassing = 0
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
        return node.model.action.exchange == opt.to
      return  node.model.wallet.has('USD') && node.model.wallet.USD.value > 0
        && (node.model.wallet.USD.value > (wallet.USD.value - (wallet.USD.value * 0.05)))
        && (node.model.wallet.USD.value < (wallet.USD.value + (wallet.USD.value * 10)))
    })) {
      final.push(node)
    }
  }
  log("total tree count "+countTotal+", passing "+countPassing)
  final.sort((a,b) => 
    ((walletValueMeanUSD(a.model.wallet, spreads) < walletValueMeanUSD(b.model.wallet, spreads)) ? -1 :
      (walletValueMeanUSD(a.model.wallet, spreads) > walletValueMeanUSD(b.model.wallet, spreads)) ? 1 : 0)
  )

  log("makes it to final ")
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
    tweet = tweet + util.format("%d", walletValueMeanUSD(node.model.wallet, spreads));
    let entry = walletValue(node.model.wallet)
    if (entry && entry.currency != 'USD')
      tweet += " actual "+entry.currency
    log(node.model.id + " " + tweet)
    transaction[node.model.id] = events

  }

  if (wallet.has("USD"))
    log("original wallet value: "+wallet.USD.value +" -5%:"+(wallet.USD.value - (wallet.USD.value* 0.05) ))

  let fileName = "events.transfer."+process.pid+".json"
  if (opt.write)
    fileName = opt.write
  log("writing file "+fileName+" containing "+transaction.keys().length + " transactions")
  var eventFile = fs.createWriteStream(fileName, { flags: 'w' }); 
  eventFile.write(JSON.stringify(transaction, null, 4))

  //  wallets.sort((a,b) => ((a.USD.value < b.USD.value) ? -1 : (a.USD.value > b.USD.value) ? 1 : 0))

})()
