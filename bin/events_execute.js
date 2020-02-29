'use strict';
//process.env.NODE_ENV='public'
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
  , asTableLog = require ('as-table').configure ({ title: x => x, delimiter: ' ', dash: '-' })
  , Rlsepp = require('librlsepp').Rlsepp
  , Event = require('librlsepp').Event
  , Events = require('librlsepp/js/lib/event').Events
  , Tickers = require('librlsepp').Tickers
  , IxDictionary = require('librlsepp/js/lib/ixdictionary')
  , OrderBook = require('librlsepp/js/lib/orderbook').OrderBook
  , Wallet = require('librlsepp/js/lib/wallet').Wallet
  , WalletEntry = require('librlsepp/js/lib/wallet').WalletEntry
  , Storable = require('librlsepp/js/lib/storable').Storable
  , sprintf = require('sprintf-js').sprintf
  , functions = require('librlsepp/js/lib/functions')
;

const {
  isArray, 
  isObject, 
  isIterable, 
  isAsyncIterable,
  asyncForEach,
  sortBy,
  formatUSD,
  formatBTC,
  formatCrypto
} = functions

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async function main() {

  let opt = stdio.getopt({
    'file': {key: 'f', args: 1}
  })

  let rl = Rlsepp.getInstance()
  await rl.initStorable()
  let exchanges = rl.getExchangesWithAPIKeys()
  if (exchanges.length == 0)
    throw(new Error("no exchanges to initialize"))

  await rl.initAsync(exchanges, {enableRateLimit: true, timeout:12500, retry: 5});

  let spreads = rl.deriveSpreads( )

  let balances = await rl.showBalances(spreads)

//  balances.print()
//      console.log(c+ "|" + rl.ccxt.currencyToPrecision(c, el.eAPI.total[c]))

  /*
  for (let el of balances) {
    try {
    }
    if (el.total >
  }
  */

  let jsonevents = null
  try {
    const contents = await fs.readFile(opt.file)
    jsonevents = JSON.parse(contents)
  } catch(e) {
    console.log(e.message)
  };

  let events = new Events(jsonevents)

  let transaction = []
  for (let ev of events) {
    if (ev.action == "move") {
      let r 
      try {
        r = await rl.moveMoneyAsync(ev.amountType, ev.fromExchange, ev.exchange, ev.amount)
      } catch(e) {
        log(e)
      }
      log(r)
    }

    // gemini does limit orders only according to the child class
    //
    if (ev.action == 'sell' || ev.action == 'buy') {
      let book = new OrderBook(ev)
      log(book)
      let rev = await rl.stickyOrder(ev, balances, book)
      log(rev)

      //  check blockchain?
      //
      //  poll order book ( timeout after  n * 2(c(1s) + 200ms + ratelimit)  )
      //    pause by rate limit
      //    match action.orders against orderbook
      //    if none match, expect complete
      //
      //  tid = cancel order
      //  
      //  loop over balance
      //    match on cancel (=), match on price (<> stddev), re-calculate price
      //  record ev in transactions
      //
    }

    /*
    try {
      const r = await rl.store(rev, 'transaction')
      log(r)
    } catch(err) {
      log(err)
    }
    */
  }

  let fileName = "events.execute."+process.pid+".json"
  var eventFile = fs.createWriteStream(fileName, { flags: 'w' }); 
  eventFile.write(JSON.stringify(transaction, null, 4))

  log("wrote file "+fileName)
})()
