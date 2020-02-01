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
  , Tickers = require('librlsepp').Tickers
  , IxDictionary = require('librlsepp/js/lib/ixdictionary')
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

  let transaction = []
  for (let ev of jsonevents) {
    if (ev.action == "move") {
      let r 
      try {
        r = await rl.moveMoneyAsync(ev.amountType, ev.fromExchange, ev.exchange, ev.amount)
      } catch(e) {
        log(e)
      }
      log(r)
    }
    if (ev.action == 'sell') {
    }
    if (ev.action == 'buy') {
    }

    log(ev)
    try {
      const r = await rl.store(ev, 'transaction')
      log(r)
    } catch(err) {
      log(err)
    }
  }

  let fileName = "events.execute."+process.pid+".json"
  var eventFile = fs.createWriteStream(fileName, { flags: 'w' }); 
  eventFile.write(JSON.stringify(transaction, null, 4))

  log("wrote file "+fileName)
})()
