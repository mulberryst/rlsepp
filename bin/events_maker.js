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
    'file': {key: 'f', args: 1},
    'write': {key: 'w', args: 1},
    'sell': {args: 2},
    'buy': {args: 2},
    'move': {args: 3}
  })

  if (opt.sell) {
    log(opt.sell)
  }
  if (opt.buy) {
  }
  if (opt.move) {
  }

  let rl = Rlsepp.getInstance()
  await rl.initStorable()
  let exchanges = rl.getExchangesWithAPIKeys()
  if (exchanges.length == 0)
    throw(new Error("no exchanges to initialize"))

  await rl.initAsync(exchanges, {enableRateLimit: true, timeout:12500, retry: 5});

  let spreads = rl.deriveSpreads( )

  await rl.showBalances(spreads)

//  balances.print()
//      console.log(c+ "|" + rl.ccxt.currencyToPrecision(c, el.eAPI.total[c]))

  /*
  for (let el of balances) {
    try {
    }
    if (el.total >
  }
  */

  if (opt.sell) {
    let [exchange,currency] = opt.sell
    let wallet = balances[exchange][currency]
    wallet.symbol = currency+"/USD"
//    rl.fetchOrderBooks(
    console.log(JSON.stringify(amount))
    let w = {}
    w[currency]
//    let w = 
//    let ev = 
  }

})()
