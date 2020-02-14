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
    'file': {key: 'f', args: 1},
    'write': {key: 'w', args: 1},
    'sell': {args: 2, description: "exchange,currency (USD)"},
    'buy': {args: 3, description: "exchange,currency,currencyWith"},
    'move': {args: 3, description: "fromExchange, exchange, currency"}
  })

  //
  if (opt.sell) {
    log(opt.sell)
  }
  if (opt.buy) {
    log(opt.sell)
  }
  if (opt.move) {
    log(opt.move)
  }

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

  let transaction = null
  if (opt.sell || opt.buy) {

    let [exchange,currency, currencyWith] = []

    if (opt.sell)
      [exchange,currency] = opt.sell

    if (opt.buy)
      [exchange, currency, currencyWith] = opt.buy

    let wallet = new IxDictionary()


    log(JSON.stringify(balances))

    try {
      wallet.set(currency, balances[exchange][currency])
    } catch(e) {
      log("Missing DATA")
    }

    let symbol = currency+"/USD"

//IMPLEMENT ME

    let ticker = rl.getTickerByExchange(exchange,symbol)

    log(wallet)
    log(ticker)

    let [action, w] = []
    if (opt.sell)
      [action, w] = rl.projectSell(wallet,exchange, ticker)

    //  ;;
    //
    if (opt.buy)
      [action, w] = rl.projectBuy(wallet,exchange, ticker)

    let events = new IxDictionary()
    events.set(exchange, new IxDictionary())
    events[exchange][symbol] = action

    let books = await rl.fetchOrderBooks(events, {store: false})

    transaction = rl.adjustActions([action])

    log(JSON.stringify(transaction))

  }
  if (opt.move) {
    let [fromExchange, exchange, currency] = opt.move

    let wallet = new IxDictionary()
//    log(JSON.stringify(balances))
    try {
      wallet.set(currency, balances[fromExchange][currency])
    } catch(e) {
      log("Missing DATA")
    }
//    log(wallet)

    let symbol = currency+"/USD"

    let address = await rl.getDepositAddress(currency, exchange)
    log("address :" +address)

    let e = new Event({
      action:"move",
      exchange:exchange,
      address:address,
      fromExchange:fromExchange,
      amountType:currency,
      amount:wallet[currency].value,
      costType:currency,
      cost:1,
      tid:null
    })
    transaction = [e]
  }

  let fileName = "events.maker."+process.pid+".json"
  if (opt.write)
    fileName = opt.write
  var eventFile = fs.createWriteStream(fileName, { flags: 'w' }); 
  eventFile.write(JSON.stringify(transaction, null, 4))

  log("wrote file "+fileName)

})()
