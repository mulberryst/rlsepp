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
    'file': {key: 'f', args: 1, default: "/dev/null", description:"filename containing json events"},
    'eid': {key: 'e', args: 1, description:"event id as reported by events_maker"},
    'dryrun': {args: 1, description:"peform a dry run of event"}
  })

  let rl = Rlsepp.getInstance()
  await rl.initStorable()

  let exchanges = rl.getExchangesWithAPIKeys()
  if (exchanges.length == 0)
    throw(new Error("no exchanges to initialize"))


  let events
  let book
  if (opt.file != '/dev/null') {
    let jsonevents = null
    try {
      const contents = await fs.readFile(opt.file)
      jsonevents = JSON.parse(contents)
    } catch(e) {
      throw e
    };

    //
    //
    events = new Events(jsonevents)
    exchanges = events.exchanges.keys()

  } else if (opt.eid) {
    try {
      let Devent = await rl.retrieve({id:opt.eid}, 'event')
      let event = new Event(Devent)
      events = new Events([event ])
      exchanges = events.exchanges.keys()
    } catch(e) {
      throw new Error(e)
    }
  }

  await rl.initAsync(exchanges, {enableRateLimit: true, timeout:12500, retry: 5});
  let spreads = rl.deriveSpreads( )
  let balances = await rl.showBalances(spreads)

  let transaction = []
  for (let ev of events) {

    // timing of cli script from start to this point was roughly 18.3 s on wifi
    //  init takes up a good portion of this time
    //
//    if (ev.age && ev.age > 20) {
    if (ev.age && ev.age > 60) {
      if (!opt.dryrun) {
        log(ev)
        log("skipping old event, regen? ")

        continue
      }
    }

    //
    //
    if (ev.action == "move") {
//    applyExceptions
//      
//      safeMoveMoneyAsync

      let r 
      try {
        r = await rl.moveMoneyAsync(ev.amountType, ev.fromExchange, ev.exchange, ev.amount)
      } catch(e) {
        log(e)
      }
      log(r)
    }

    let rev
    // gemini does limit orders only according to the child class
    //
    if (ev.action == 'sell' || ev.action == 'buy') {
      let book
      try {
        book = new OrderBook(ev)
      } catch(e) {
        try {
          book = await rl.retrieve({id:ev.orderbookid}, 'orderbook')
        } catch(er) {
          throw new Error(er)
        }
      }

      try {
        if (opt.dryrun) {
          log("DRY RUN")
          rev = new Event(ev)
        } else {
          rev = await rl.stickyOrder(ev, balances, book)
        }
      } catch(e) {
        rev = new Event(ev)
        rev.success = 0
        rev.info = {status:"failed", success:0, remaining: ev.amount, filled:0}
      }

      transaction.push(rev)
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

    log(rev)
    if (rev && rev.tid) {
      try {
        log("storing event transaction")
        const r = await rl.store(rev, 'event')
        log(r)
      } catch(err) {
        log(err)
      }
    }

  }

  if (transaction.length > 0) {
    let fileName = "events.execute."+process.pid+".json"
    var eventFile = fs.createWriteStream(fileName, { flags: 'w' }); 
    eventFile.write(JSON.stringify(transaction, null, 4))

    log("wrote file "+fileName)
  }
})()
