'use strict';
const config = require('config')
  , stdio = require('stdio')
  , Rlsepp = require('./librlsepp').Rlsepp
  , IxDictionary = require('./librlsepp').IxDictionary
  , OrderBook = require('./librlsepp').OrderBook
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
  , log = require ('ololog')
;

async function loadEvents() {
    let table = []
    try {
      const contents = await fs.readFile('events.json')
      table = JSON.parse(contents)
    } catch(e) {
      console.log(e.message)
    };
  return table
}


(async function main() {
  const rl = Rlsepp.getInstance();
//  let ixExchanges = new IxDictionary(["yobit", "livecoin", "gemini", "crex24", "cex"])

  let exchanges = []
  let symbols = []
  let allExchanges = config.get('exchanges')

  let opt = stdio.getopt({
    'tid': {key: 't', args: 1}
  });

  if (opt.args && opt.args.length > 0) {
      exchanges = opt.args.shift()
      symbols = opt.args.shift()
  }
 
  let transactions = await loadEvents()

  let eventPerExchange = {}
  let symbolsByExchange = new IxDictionary()

  if (transactions != null) {
    for (let tid in transactions) {
      if (opt.tid && opt.tid != tid)
        continue
      for (let e of transactions[tid]) {

        let s = e.amountType + "/" + e.costType
        let k = e.exchange+ "_" + e.action + "_" + e.amountType + "_" + e.costType
        if (!symbolsByExchange.has(e.exchange))
          symbolsByExchange[e.exchange] = new IxDictionary()

        if (!symbolsByExchange[e.exchange].has[s])
          symbolsByExchange[e.exchange][s] = 0
        symbolsByExchange[e.exchange][s]++
      }
    }
  }

  
  exchanges = symbolsByExchange.keys()
  await rl.initAsync(exchanges, {verbose})


  let orderBookByExchangeSymbol
  if (opt.tid) {
    let lastEv = null

    let sByE = new IxDictionary()
    for (let e of transactions[opt.tid]) {
      if (!sByE.has(e.exchange)) sByE[e.exchange] = new IxDictionary()
      sByE[e.exchange][e.amountType + "/" + e.costType] = 1
    }
    log(sByE)
    orderBookByExchangeSymbol = await rl.retrieveOrderBooks(sByE)
//    orderBookByExchangeSymbol = await rl.fetchOrderBooks(sByE)
  } else {
//    orderBookByExchangeSymbol = await rl.fetchOrderBooks(symbolsByExchange)
  }
  log(orderBookByExchangeSymbol)
//  log(JSON.stringify(orderBookByExchangeSymbol,null,4))

      //let [cost, amount, orders] = book.project(e)
  //log(new OrderBook(e))
//  console.log(JSON.stringify(E))
  //console.log(JSON.stringify(symbolsByExchange, null, 4))
  //

})()
