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
  , asTableLog = require ('as-table').configure ({ title: x => x, delimiter: ' ', dash: '-' })
  , Rlsepp = require('librlsepp').Rlsepp
  , Tickers = require('librlsepp').Tickers
  , IxDictionary = require('librlsepp/js/lib/ixdictionary')
  , OrderBook = require('librlsepp/js/lib/orderbook').OrderBook
  , Event = require('librlsepp/js/lib/event').Event
  , Events = require('librlsepp/js/lib/event').Events
  , Storable = require('librlsepp/js/lib/storable').Storable
  , sprintf = require('sprintf-js').sprintf
;


let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))
console.trace = console.log

;(async function main() {

  let rl = Rlsepp.getInstance()
  await rl.initStorable()

  let exchanges = []
  let opt = stdio.getopt({
    'file': {key: 'f', args: 1},
    'tid': {key: 't', args: 1},
    'notify': {key: 'n', args: 1},
    'profit': {key: 'p', args: 1}
  })

  let jsonevents = null
  if (opt.file) {
    try {
      const contents = await fs.readFile(opt.file)
      jsonevents = JSON.parse(contents)
    } catch(e) {
      console.trace(e.message)
    };
  }

  let dupCheck = new IxDictionary()
  let out = []
  let count = 0
  let table = []
  //    for (let tid in jsonevents) \
  let t = new Events(jsonevents)
  let t2 = new Events(jsonevents)

  let tids = t.keysByProfit()

  let profit = -50
  if (opt.profit)
    profit = Number(opt.profit)
  tids.filter(tid => t.profit(tid) >= profit).map( tag => t.print(tag) )

  log("transaction count with a profit above "+profit+" "+tids.length)

  tids = t.keysByProfit('desc')
  let top = tids.filter(tid => t.profit(tid) >= Number(opt.notify))

  let promises = []
//  t = rl.correctEvents(t)

  let toss = []

  for (let tid of top) {
    let evs = t[tid]

    for (let aid in evs) {
      let ev = evs[aid]
      promises.push(new Promise(async (resolve, resject) => {
        ev.created_by = 'events_pending'
        ev.transaction_tag = tid
        ev.tagid = aid

        //  keep order book if one is embedded within
        //
        let oid = null
        try {
          if (ev.orders) {
            let book = new OrderBook(ev)
            oid = await rl.store(book, 'orderbook')

            delete ev.orders
            ev.orderbookid = oid
            log('storing event, book id: '+oid)
          }
          let eid = await rl.store(ev, 'event')
          log('stored event eid: '+eid + ' from transaction '+ev.transaction_tag)
          resolve(eid)
        } catch(e) {
          log(e)
          if (!toss.includes(ev.transaction_tag))
            toss.push(ev.transaction_tag)
          resolve(null)
        }
      }))
    }
  }
  let r = await Promise.all(promises).then( ).catch(error => log(error))
//  log(JSON.stringify(r))
//  log(toss)
  for (let ttag of toss) {
    await rl.storable.delete(ttag)
  }
  top = top.filter(t => !toss.includes(t));
  tids = tids.filter(t => !toss.includes(t));

  if (opt.notify) {

    let tweet = []
    let subject = []

    let topN = tids.slice(0,5)
    topN.map(tid => ( subject.push(sprintf("%0.0f ",Math.round( t2.profit(tid) / t2.costBasis(tid) * 1000))) ))

    top.map( tid => tweet.push(t2.asTweet(tid) ))
    //        await rl.notify(tweet.join("\n"),subject.join(","))

    if (tweet.length > 0 ) {
      log("sending notification")
      console.log(subject.join(""))
      console.log(tweet.join("\n"))
      await rl.notify(opt.file+"\n"+tweet.join("\n"),subject.join(","))
    }

  }

})()
