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
  formatCrypto,
  numberToString
} = functions

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async function main() {

  let opt = stdio.getopt({
    'file': {key: 'f', args: 1, default: "/dev/null", description:"filename containing json events"},
    'eid': {key: 'e', args: 1, description:"event id as reported by events_maker"},
    'dryrun': {args: 1, description:"peform a dry run of event"},
    'transaction': {args: 1, description:"execute series of events marked by transaction tag"}
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
    exchanges = events.exchanges()

  } else if (opt.eid) {
    try {
      let Devent = await rl.retrieve({id:opt.eid}, 'event')
      let event = new Event(Devent)
      events = new Events([event])
      exchanges = events.exchanges.keys()
      events = events[0]
    } catch(e) {
      throw new Error(e)
    }
  } else if (opt.transaction) {
    //TODO: put into events_test.js
    try {
      events = await rl.retrieve({transaction_tag: opt.transaction}, 'transaction')
    } catch(e) {
      throw new Error(e)
    }

    exchanges = events.exchanges()
  }


  await rl.initAsync(exchanges, {enableRateLimit: true, timeout:12500, retry: 5});
  let spreads = rl.deriveSpreads( )
  let balances = await rl.showBalances(spreads)

  log(events)
  //  let transaction = []
  for (let eid in events) {
    let ev = events[eid]
    for (let eeiT of ev) {

      // timing of cli script from start to this point was roughly 18.3 s on wifi
      //  init takes up a good portion of this time
      //
      //    if (ev.age && ev.age > 20)
      if (eeiT.age && eeiT.age > 1000000) {
        if (!opt.dryrun) {
          log(eeiT)
          log("skipping old event, regen? ")

          continue
        }
      }

      log("here")
      //
      //
      if (eeiT.action == 'move') {
        log("here")
        //    applyExceptions
        //      
        //      safeMoveMoneyAsync

        let r 
        try {
          r = await rl.moveMoneyAsync(
            eeiT.amountType, eeiT.fromExchange, eeiT.exchange, eeiT.amount
          )
          log("was the call made?")
          log(r)

          let done = false
          let stime = 1000
          do {
            await sleep(stime)
            let verify = await rl.fetchBalances();
            let search = verify.has(eeiT.amountType, eeiT.exchange)
            log(search)
            if (numberToString(search[eeiT.amountType].value) == numberToString(eeiT.amount))
              done = true
            else
              stime = 5000
          } while (!done)
        } catch(e) {
          log(e)
        }

        //TODO: store, tid?
        log(r)
      }

      let rev
      // gemini does limit orders only according to the child class
      //
      if (eeiT.action == 'sell' || eeiT.action == 'buy') {
        let book
        try {
          book = new OrderBook(eeiT)
        } catch(e) {
          try {
            book = await rl.retrieve({id:eeiT.orderbookid}, 'orderbook')
          } catch(er) {
            throw new Error(er)
          }
        }

        try {
          if (opt.dryrun) {
            log("DRY RUN")
            rev = new Event(eeiT)
          } else {
            rev = await rl.stickyOrder(eeiT, balances, book)
            let done = false
            let stime = 1000
            do {
              await sleep(stime)
              let verify = await rl.fetchBalances([eeiT.exchange]);
              let field
              let value
              if (eeiT.action == "buy")
                [field, value] = [eeiT.amountType, eeiT.amount]
              if (eeiT.action == "sell")
                [field, value] = [eeiT.costType, eeiT.cost]

              let orig = balances.has(field, eeiT.exchange)
              let search = verify.has(field, eeiT.exchange)
              log(orig)
              log(search)
              if (parseFloat(numberToString(search[field].value)) >= (parseFloat(orig[field].value) + parseFloat(numberToString(eeiT.amount))))
                done = true
              else
                stime = 1250
            } while (!done)
          }
        } catch(e) {
          rev = new Event(eeiT)
          rev.success = 0
          rev.info = {status:"failed", success:0, remaining: eeiT.amount, filled:0}
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
        //      transaction.push(rev)
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
    }// for
  }//for

    /*
  if (transaction.length > 0) {
    let fileName = "events.execute."+process.pid+".json"
    var eventFile = fs.createWriteStream(fileName, { flags: 'w' }); 
    eventFile.write(JSON.stringify(transaction, null, 4))

    log("wrote file "+fileName)
  }
  */
})()
