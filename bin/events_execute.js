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
    'eid': {key: 'e', args: 1, default: false, description:"event id as reported by events_maker"},
    'dryrun': {args: 1, default:false, description:"peform a dry run of event"},
    'transaction': {key: 't', args: 1, default: false, description:"execute series of events marked by transaction tag"}
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

    // if any event fails, fail the whole transaction
    //
    try {
      for (let eeiT of ev) {
        fs.writeFileSync(`/home/nathaniel/log/${eid}_${eeiT.tagid}_${eeiT.action}_event.log`,JSON.stringify(eeiT))
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


        try {
          await rl.storable.call('event_pending', null, eid, eeiT.tagid);
        } catch(e) {
          log(e)
        }

        let fulfilled
        let result
        //
        //
        if (eeiT.action == 'move') {
          log("here")
          //    applyExceptions
          //      
          //      safeMoveMoneyAsync

          let r 
          try {

            result = await rl.moveMoneyAsync(
              eeiT.amountType, eeiT.fromExchange, eeiT.exchange, eeiT.amount - eeiT.cost
            )
            log("was the call made?")
            log(result)
            try {
              //in result?
              let txid = null
              await rl.storable.call('event_began', null, eid, eeiT.tagid, 'open', null, txid,null, result);
            } catch(e) {
              log(e)
            }
            let fileName = `/home/nathaniel/log/${eid}_${eeiT.tagid}_${eeiT.action}_response.log`
            fs.writeFileSync(fileName,result)

            let done = false
            let stime = 1000

            //  let's see if they are uniform and keep the json {info:data, id:id} object
            //
            try {
              if (result.id) {
//                order = await rl.fetchOrder(result.id)
//                let fileName = `/home/nathaniel/log/${eid}_${eeiT.tagid}_${eeiT.action}_move_status.log`
//                fs.writeFileSync(fileName,order)
              }

            } catch(e) {
              log(e)
            }

            do {
              await sleep(stime)
              let verify = await rl.showBalances(spreads,null, false);
              log(verify)
              let orig = balances.has(eeiT.amountType, eeiT.exchange)
              let search = verify.has(eeiT.amountType, eeiT.exchange)
              if (search) {
                if (orig) {
                  if (parseFloat(numberToString(verify[eeiT.exchange][field].value)) > (parseFloat(balances[eeiT.exchange][field].value)))
                    done = true
                  fulfilled = eeiT.amount
                } else {
                  done = true
                }
                stime = 5000
              }
            } while (!done)
          } catch(e) {
            //[ExchangeNotAvailable] yobit POST https://yobit.net/tapi 500 Internal Server Error
            throw e
          }

        }

        let rev
        // gemini does limit orders only according to the child class
        //
        if (eeiT.action == 'sell' || eeiT.action == 'buy') {
          let book
          if (typeof eeiT.orderbookid !== 'undefined') {
            try {
              book = new OrderBook(eeiT)
            } catch(e) {
              try {
                book = await rl.retrieve({id:eeiT.orderbookid}, 'orderbook')
              } catch(er) {
                throw new Error(er)
              }
            }
          }

          try {
            if (opt.dryrun) {
              log("DRY RUN")
              rev = new Event(eeiT)
            } else {
              rev = await rl.stickyOrder(eeiT, balances, book)
              result = rev.response
        try {
          await rl.storable.call('event_began', null, eid, eeiT.tagid, rev.status, rev.tid, null,null, result);
        } catch(e) {
          log(e)
        }
              let done = false
              let stime = 1000
              let order = null
              let lastOrder = null
              do {
                await sleep(stime)

                //  check fetchOrder for status != 'open'
                //
                //  failing this, check showBalances for exchange.currency >= original.value + amount
                //
                try {
/*
                  690             'info': order,
 691             'id': order['id'].toString (),
 692             'timestamp': timestamp,
 693             'datetime': this.iso8601 (timestamp),
 694             'lastTradeTimestamp': undefined,
 695             'symbol': symbol,
 696             'type': orderType,
 697             'side': side,
 698             'price': this.safeFloat (order, 'price'),
 699             'average': this.safeFloat (order, 'avg_execution_price'),
 700             'amount': this.safeFloat (order, 'original_amount'),
 701             'remaining': this.safeFloat (order, 'remaining_amount'),
 702             'filled': this.safeFloat (order, 'executed_amount'),
 703             'status': status,
 704             'fee': undefined,
*/
                  if (rev.tid) {
                    lastOrder = order
                    log('attempting fetch order '+rev.tid)
                    order = await rl.fetchOrder(eeiT.exchange, rev.tid)
                    let fileName = `/home/nathaniel/log/${eid}_${eeiT.tagid}_${eeiT.action}_order_status.log`
                    fs.appendFileSync(fileName,JSON.stringify(order))
                    if (lastOrder == null || lastOrder.status != order.status || 
                      lastOrder.remaining != order.remaining || lastOrder.filled != order.filled)
                    if (order.status != 'open' || Number(order.remaining) == 0) {
                      fulfilled = Number(order.fulfilled)
                      done = true
                    } else
                      stime = 2000
                  }

                } catch(e) {
                  log(e)

                  //  fallback to using balances as verification

                  let verify = await rl.showBalances(spreads,null, false);
                  log(verify)
                  let field
                  let value
                  if (eeiT.action == "buy")
                    [field, value] = [eeiT.amountType, eeiT.amount]
                  if (eeiT.action == "sell")
                    [field, value] = [eeiT.costType, eeiT.cost]

                  let orig = balances.has(field, eeiT.exchange)
                  let search = verify.has(field, eeiT.exchange)

                  if (search) {
                    if (orig) { 
//                    if (parseFloat(numberToString(verify[eeiT.exchange][field].value)) > (parseFloat(balances[eeiT.exchange][field].value) + parseFloat(numberToString(eeiT.amount))))
                    //   failing fetchOrder, if the balance went up that's enough
                      if (parseFloat(numberToString(verify[eeiT.exchange][field].value)) >= ((parseFloat(balances[eeiT.exchange][field].value) + Number(value)) ))
                        done = true
                    }
                  } else
                    stime = 1250
                }
              } while (!done)
            }
          } catch(e) {
            throw e
            rev = new Event(eeiT)
            rev.success = 0
            rev.info = {status:"failed", success:0, remaining: eeiT.amount, filled:0}
          }

          log(rev)
          fs.writeFileSync(`/home/nathaniel/log/${eid}_${eeiT.tagid}_${eeiT.action}_response.log`,JSON.stringify(rev))
          /*
           *
           replaced with stored proc event_complete
          if (rev && rev.tid) {
            try {
              log("storing event transaction")
              const r = await rl.store(rev, 'event')
              log(r)
            } catch(err) {
              log(err)
            }
          }
          */
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

        try {
          await rl.storable.call('event_complete', null, eid, eeiT.tagid, 'closed', 0, fulfilled, null);
        } catch(e) {
          log(e)
        }
      }// for
    } catch(e) {
      log(e)
    }
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
