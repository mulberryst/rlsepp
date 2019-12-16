'use strict';
process.env.NODE_ENV='public'
const config = require('config')
  , stdio = require('stdio')
  , fs = require("mz/fs")
  , path = require('path')
  , util = require('util')
  , moment = require('moment')
  , JSON = require('JSON')
  , log = require ('ololog')
  , ansi = require('ansicolor').nice
  , asTable = require ('as-table').configure ({ title: x => x.bright, delimiter: ' | '.dim.cyan, dash: '-'.bright.cyan })
  , asTableLog = require ('as-table').configure ({ title: x => x, delimiter: ' | ', dash: '-' })
  , Rlsepp = require('librlsepp').Rlsepp
  , Tickers = require('librlsepp').Tickers
  , IxDictionary = require('librlsepp/js/lib/ixdictionary')
  , Storable = require('librlsepp/js/lib/storable').Storable
;

var outFile= fs.createWriteStream('orderbook_summary.json', { flags: 'w' });

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async function main() {

  let exchanges = []
  let opt = stdio.getopt({
    'file': {key: 'f', args: 1, mandatory:true},
    'tid': {key: 't', args: 1}
  })

  let jsonevents = null
  try {
    const contents = await fs.readFile(opt.file)
    jsonevents = JSON.parse(contents)
  } catch(e) {
    console.log(e.message)
  };

//  log(JSON.stringify(jsonevents, null, 4))


  let cache = {}
  let ex = {}
  let events = [] //make generic TODO
  if (opt.tid && jsonevents[opt.tid]) {
    for (let event of jsonevents[opt.tid]) {
      event.symbol = event.amountType + "/" + event.costType
      ex[event.exchange] = true
    }
    events = new Tickers(jsonevents[opt.tid])
  } else {
    events = new Tickers()
    for (let tid in jsonevents) {
      for (let event of jsonevents[tid]) {
        event.symbol = event.amountType + "/" + event.costType
        ex[event.exchange] = true
      }
      events.merge(new Tickers(jsonevents[tid]))
    }
  }
//  log(JSON.stringify(events, null, 4))


  for (let exchange in ex)
    exchanges.push(exchange)

  const rl = Rlsepp.getInstance();
  await rl.initAsync(exchanges, {enableRateLimit: false})
//  let listAC = rl.arbitrableCommodities(['USDT'])
//  let table = await rl.fetchArbitrableTickers(listAC, ['USD', 'BTC', 'ETH'])           


  let cacheBookTree = new IxDictionary()
  let orderBooks = null

  //log(events)
  let books = await rl.fetchOrderBooks(events, {store:false})
  //log(books)

  let transaction = new IxDictionary()
  for (let tid in jsonevents) {
    let lastAmount = null
    let thisTransaction = []

    if (opt.tid && opt.tid != tid)
      continue
    try {
      for (let action of jsonevents[tid]) {
//        log(action)
        let exchange = action.exchange
        let symbol = action.amountType + "/"+ action.costType

        //next action's cost is the previous actions amount
        //
        //ex. buy BTC/USD, amount 1btc cost 7kusd
        //    buy  ETH/BTC, amount 21eth cost 1btc
        if (lastAmount != null && action.action == 'buy') {
          action.cost = lastAmount
        }
        try {
          let newAction = books[exchange][symbol].project(action)
          lastAmount = newAction.amount 
          thisTransaction.push(newAction)
        } catch(e) {
          throw (new Error("missing order book from "+exchange+ " for "+symbol))
        }
      }
      transaction[tid] = thisTransaction
    } catch(e) {
      log(e)
    }
  }

  log("writing file "+opt.file+".corrected containing "+transaction.keys().length + " transactions")
  var eventFile= fs.createWriteStream(opt.file+".corrected", { flags: 'w' });
  eventFile.write(JSON.stringify(transaction, null, 4))

/*
  let count = 0
  let  out = ""
  let table = []
  for (let exchange in orderBooks) {
    for (let book of orderBooks[exchange]) {
      let asks = book.sum(book.asks)
      let bids = book.sum(book.bids)
      let row = {exchange:exchange,symbol:book.symbol, 
        total_asks:asks, count: book.asks.length, ap1:book.asks[0][0], av1:book.asks[0][1],
        ap2:book.asks[1][0], av2:book.asks[1][1], ap3:book.asks[2][0], av3:book.asks[2][1],
        total_bids:bids, count: book.bids.length, bp1:book.bids[0][0], bv1:book.bids[0][1],
        bp2:book.bids[1][0], bv2:book.bids[1][1], bp3:book.bids[2][0], bv3:book.bids[2][1]
      }

      table.push(row)
    }
    console.log(exchange.cyan)
    console.log(asTable(table))
    outFile.write(asTableLog(table))
  }
*/

})()
