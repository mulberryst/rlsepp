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
  , log4js = require('log4js')
;


let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async function main() {

  let exchanges = []
  let opt = stdio.getopt({
    'file': {key: 'f', mandatory:true, multiple: true},
    'write': {key: 'w', args: 1},
    'tid': {key: 't', args: 1}
  })

  let jsonevents = []
  let files = null
  if (opt.file.constructor == Array)
    files = opt.file
  else
    files = [opt.file]
  try {
    for (let file of files) {
      const contents = await fs.readFile(file)
      let parsed = JSON.parse(contents)
      jsonevents.push(parsed)
    }
  } catch(e) {
  };

//  throw ("asd")


  let cache = {}
  let ex = {}
  let events = [] //make generic TODO

  //  determine which exchanges to init
  //
  if (opt.tid && jsonevents[0][opt.tid]) {
  //  mainly for testings
    for (let event of jsonevents[0][opt.tid]) {
      event.symbol = event.amountType + "/" + event.costType
      ex[event.exchange] = true
    }
    events = new Tickers(jsonevents[0][opt.tid])

  } else {
    for (let fileno in jsonevents) {
      for (let tid in jsonevents[fileno]) {
        for (let event of jsonevents[fileno][tid]) {
          event.symbol = event.amountType + "/" + event.costType
          ex[event.exchange] = true
        }
      }
    }
  }

  for (let exchange in ex)
    exchanges.push(exchange)

  const rl = Rlsepp.getInstance();
  await rl.initStorable()
  await rl.initAsync(exchanges, {enableRateLimit: true})

  const logger = log4js.getLogger('file');
  

    //  apply exceptions before seeking order books
    //
    events = new Tickers()
    for (let fileno in jsonevents) {
      for (let tid in jsonevents[fileno]) {
        if (opt.tid && tid != opt.tid)
          continue 

        try {
          let lastAction = null
          for (let event of jsonevents[fileno][tid]) {

            rl.applyExceptions(event)
            if (lastAction != null) {
              if (lastAction.exchange != event.exchange) {
                if (event.event == 'buy')
                  if (!rl.canWithdraw(lastAction.exchange, event.costType))
                    throw(new Error("cannot move "+event.costType+" from "+lastAction.exchange))
                if (event.event == 'sell')
                  if (!rl.canWithdraw(lastAction.exchange, event.amountType))
                    throw(new Error("cannot move "+event.amountType+" from "+lastAction.exchange))
              }
            }
            lastAction = event
          }
          events.merge(new Tickers(jsonevents[fileno][tid]))
        } catch(e) {
          delete jsonevents[fileno][tid]
        }
      }
    }


//  let listAC = rl.arbitrableCommodities(['USDT'])
//  let table = await rl.fetchArbitrableTickers(listAC, ['USD', 'BTC', 'ETH'])           


  let cacheBookTree = new IxDictionary()
  let orderBooks = null

  let books = await rl.fetchOrderBooks(events, {store:false})
  logger.info("num books in memory returned from API: "+books.size())

  let transaction = new IxDictionary()
  for (let fileno in jsonevents) {
    for (let tid in jsonevents[fileno]) {
      let lastAmount = null


      if (opt.tid && opt.tid != tid)
        continue

      try {
        let thisTransaction = rl.adjustActions(jsonevents[fileno][tid])
        transaction[fileno + tid] = thisTransaction
      } catch(e) {
      }
    }
  }


  let fileName = "events."+process.pid+".corrected.json"
  if (opt.write)
    fileName = opt.write
  logger.info("writing file "+fileName+" containing "+transaction.keys().length + " transactions")
  var eventFile= fs.createWriteStream(fileName, { flags: 'w' });
  eventFile.write(JSON.stringify(transaction, null, 4))

/*
  let count = 0
  let  out = ""
  let table = []
var outFile= fs.createWriteStream('orderbook_summary.json', { flags: 'w' });
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
    outFile.write(asTableLog(table))
  }
*/

})()
