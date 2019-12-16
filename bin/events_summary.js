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


let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async function main() {

  let rl = Rlsepp.getInstance()

  let exchanges = []
  let opt = stdio.getopt({
    'file': {key: 'f', args: 1},
    'tid': {key: 't', args: 1}
  })

  let jsonevents = null
  try {
    const contents = await fs.readFile(opt.file)
    jsonevents = JSON.parse(contents)
  } catch(e) {
    console.log(e.message)
  };


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
    for (let tid in jsonevents) {
      count++
      let tweet = tid + " "
      try {
        let lastExchange = null
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
          if (a.orders)
            tweet += " orders " + a.orders.length + "|"
          else 
            tweet = tweet + "|"
          if (a.action == 'sell') {
            tweet += a.cost
            out.push([tweet,a.cost])
          }
        }
      } catch(e) {
        log(e)
      }
    }
    out.sort((a,b) => ((a[1] < b[1]) ? -1 : (a[1] > b[1]) ? 1 : 0))
    out.map(el => console.log(el[0]))
    log(count + " transactions in file")
  }

})()
