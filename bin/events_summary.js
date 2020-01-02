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
  , Storable = require('librlsepp/js/lib/storable').Storable
  , sprintf = require('sprintf-js').sprintf
;


let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async function main() {

  let rl = Rlsepp.getInstance()

  let exchanges = []
  let opt = stdio.getopt({
    'file': {key: 'f', args: 1},
    'tid': {key: 't', args: 1},
    'notify': {key: 'n', args: 1}
  })

  let jsonevents = null
  try {
    const contents = await fs.readFile(opt.file)
    jsonevents = JSON.parse(contents)
  } catch(e) {
    console.log(e.message)
  };


  let dupCheck = new IxDictionary()
  if (opt.tid) {
      for (let aid in jsonevents[opt.tid]) {
        let a = jsonevents[opt.tid][aid]
          console.log(util.format("%s %s %s %s %d %d", opt.tid, a.action, a.exchange, a.amountType, a.price,a.amount))
        if (a.orders)
          console.log(asTable(a.orders))
      }
  } else {
    let out = []
    let count = 0
    let table = []
    for (let tid in jsonevents) {
      count++
      let tweet = ""
      try {
        let lastExchange = null
        let rows = [[tid,"","","","amount","","","orders","cost"]]
        let costBasis = jsonevents[tid][0].action.cost
        for (let aid in jsonevents[tid]) {
          let a = jsonevents[tid][aid]
          if (lastExchange && a.exchange != lastExchange) {
            if (a.action == 'buy')
              if (!rl.canWithdraw(lastExchange, a.costType))
                throw(new Error("cannot move "+a.costType+" from "+lastExchange))
            if (a.action == 'sell')
              if (!rl.canWithdraw(lastExchange, a.amountType))
                throw(new Error("cannot move "+a.amountType+" from "+lastExchange))
//              tweet = tweet + util.format("%s %s %s %d %s|", "move",lastExchange, a.costType, a.amount, a.exchange); 
          }
          lastExchange = a.exchange

          if (a.action == 'buy' || a.action == 'sell') {
            tweet = tweet + util.format("%s %s %s/%s %s %d", a.action, a.exchange, a.amountType, a.costType, a.priceType, a.price);
          } 
          if (a.orders) {
            rows.push(["", a.action, a.exchange, a.amountType + "/" + a.costType, a.amount,a.priceType, a.price, a.orders.length,a.cost])
            tweet += " orders " + a.orders.length + "|"
          } else 
            tweet = tweet + "|"

          if (a.action == 'sell' && aid == (jsonevents[tid].length - 1)) {
            tweet += sprintf("$%0.2f",a.cost)
            if (!dupCheck.has(tweet)) {
              dupCheck.set(tweet, 1)
              //all sales
              out.push([tid+ " " + tweet,a.cost])
              if (opt.notify && a.cost >= opt.notify)
                table.push(rows)
            }
          }
        }
      } catch(e) {
        log(e)
      }
    }
    out.sort((a,b) => ((a[1] < b[1]) ? -1 : (a[1] > b[1]) ? 1 : 0))
    out.map(el => console.log(el[0]))
    if (opt.notify) {
      let tweet = []
      let subject = []
      let topN = 5
      table.sort((a,b) => ((a[a.length-1][8] < b[b.length-1][8]) ? 1 : (a[a.length-1][8] > b[b.length-1][8]) ? -1 : 0))
        .map(el => {
          tweet.push(asTableLog(el)+"\n")
          let costBasis = el[1][8]
          let finalAct = el[el.length-1]
//          log(costBasis + " " + finalAct)
          if (finalAct[1] == 'sell' && topN > 0) {
            topN -= 1
            let profitBasis = ((finalAct[8] - costBasis)/costBasis)*1000
            subject.push(sprintf("%0.0f ",Math.round(profitBasis)))
//            subject += profitPercent
          }
        })
      log(subject)

//      console.log(JSON.stringify(table,null,4))
//      console.log(asTable(table))
//      let tweet = out.filter(el => el[1] > opt.notify).map(el => el[0])
      if (tweet.length > 0) {
        log("sending notification")
        await rl.notify(tweet.join("\n"),subject.join(","))
      }
    }
    log(count + " transactions in file")
  }

})()
