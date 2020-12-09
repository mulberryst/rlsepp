'use strict';
process.env.NODE_ENV='public'
const config = require('config')
  , Getopt = require('node-getopt')
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


  let getopt = new Getopt([
    ['', 'file=ARG', 'file'],
    ['', 'notify=ARG', 'send an email if profit above X'],
    ['' , 'profit=ARG', 'display of X'],
    ['', 'subject=ARG', 'set custom email subject'], 
    ['' , 'skipDB'             , 'do not insert into dB']
  ]).bindHelp();              // create Getopt instance

  let opt = getopt.parse(process.argv.slice(2)).options
  log(opt)

  let rl = Rlsepp.getInstance()
  await rl.initStorable()

  let exchanges = []

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

  t = await rl.correctEvents(t)
//  t = rl.fetchDepositAddresses(t)

  let t2 = new Events()
  for (let tid in t) {
    t2.add(t[tid], tid)
  }

  let tids = t.keysByProfit()

  let profit = -50
  let notify = -50
  if (opt.profit)
    profit = Number(opt.profit)
  if (opt.notify)
    notify = Number(opt.notify)
  tids.filter(tid => t.profit(tid) >= profit).map( tag => t.print(tag) )

  tids = t.keysByProfit('desc')
//  log(tids)
//  process.exit()
  let top = tids.filter(tid => t.profit(tid) >= notify)
  top.map( tid => log(tid + " " + t.profit(tid)) )
  let storedTids = []

  let promises = []
  let toss = []

  let storedEV = 0
  let storedOB = 0
  if (!opt.skipDB) {

    for (let tid of top) {
      let evs = t[tid]

      let tranEV = 0;
      promises.push(new Promise(async (resolve, reject) => {
        let dbh = null
        do {
          try {
            while (rl.storable.getPGA().handlePool.idleCount == 0) {
              await sleep(500);
            }
            dbh = await rl.storable.getPGA().handlePool.connect();
          } catch(e) {
            if (e.message.includes('timeout')) {
              log('connect timeout, waiting for idle -'+rl.storable.getPGA().handlePool.idleCount )
          } else
              throw(e);
          }
        } while (dbh == null);

        await dbh.query('BEGIN');
        for (let aid in evs) {
          let ev = evs[aid]
          ev.created_by = 'events_pending'
          ev.transaction_tag = tid
          ev.tagid = aid

          //  keep order book if one is embedded within
          //
          let oid = null

          try {
            if (ev.orders) {
              let book = new OrderBook(ev)
              let retry = 5;
              do {
                try {
                  oid = await rl.store(book, 'orderbook', dbh)
                  storedOB++;
                  retry = 0
                } catch (e) {
                  if (e.message.includes('timeout exceeded')) {
                    log(e)
                    log('insert timeout, retry ')
                    await sleep(1500);
                    retry--;
                  }
                  else
                    throw(e)
                }
              } while (retry > 0);

              delete ev.orders
              ev.orderbookid = oid
              log('storing event, book id: '+oid)
            }

            let retry = 5;
            let eid = null
            do {
              try {
                eid = await rl.store(ev, 'event', dbh);
                tranEV++;
                retry = 0;
              } catch(e) {
                if (e.message.includes('timeout exceeded')) {
                  log(e)
                  log('insert timeout, retry ')
                  await sleep(1500);
                  retry--;
                }
                else
                  throw(e)
              }
            } while (retry > 0);
            /*
            if (eid) {
              log('stored event eid: '+eid + ' from transaction '+ev.transaction_tag)
              await dbh.query('COMMIT');
            } else {
              log('no eid for '+ev.transaction_tag+', rolling back'); 
              await dbh.query('ROLLBACK');
              resolve(tid);
            }
            */
          } catch(e) {
            log(e)
            await dbh.query('ROLLBACK');
            dbh.release();
            resolve(null);
            return;
            /*
          if (!toss.includes(ev.transaction_tag))
            toss.push(ev.transaction_tag)
            */
          }
        }
        await dbh.query('COMMIT');
        dbh.release();
        storedEV += tranEV;
        storedTids.push(tid)
        resolve(tid);
      }))
    }
    let r = await Promise.all(promises).then( ).catch(error => log(error))
    //  log(JSON.stringify(r))
    //  log(toss)
    for (let ttag of toss) {
      log("delete "+ttag);
      await rl.storable.delete(ttag)
    }
    top = top.filter(t => !toss.includes(t));
    tids = tids.filter(t => !toss.includes(t));
  }
  if (opt.notify) {

    let tweet = []
    let subject = []

    let topN = t2.keysByProfit('desc').filter(tid => storedTids.includes(tid)).slice(0,5)
//    topN.map(tid => ( subject.push(sprintf("%0.0f ",Math.round( t2.profit(tid) / t2.costBasis(tid) * 1000))) ))
    topN.map(tid => ( subject.push(sprintf("%0.0f ",Math.round( t2.profit(tid)))) ))

    t2.keysByProfit('desc').filter(tid => storedTids.includes(tid)).map( tid => tweet.push(t2.asTweet(tid,rl) ))
    //        await rl.notify(tweet.join("\n"),subject.join(","))

    if (tweet.length > 0 ) {
      log("sending notification")
      console.log(subject.join(""))
      console.log(tweet.join("\n"))
      if (opt.subject)
        subject = [opt.subject]
      await rl.notify(opt.file+"\n"+tweet.join("\n"),subject.join(","))
    }

  }

  log("transaction count with a profit above "+profit+": "+top.length+" ,"+tids.length+" in file")

  let devC = 0
  let dtC = 0
  for (let ttag of toss) {
    dtC ++;
    devC += t[ttag].length;
  }
  let evC = 0;
  let tC = 0;
  for (let tid of top) {
    tC++;
    evC += t[tid].length;
  }
  log("stored "+storedEV+" events from "+tC+" transactions containing "+evC+" events")
  log("deleted "+dtC+" transaction containing "+devC+" events")
  log("stored "+storedOB+" order books")

})()
