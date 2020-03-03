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
  , WalletEntry = require('librlsepp/js/lib/wallet').WalletEntry
  , Wallet = require('librlsepp/js/lib/wallet').Wallet
  , OrderBook = require('librlsepp/js/lib/orderbook').OrderBook
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
//    'force': {boolean: 1, description: "bypass safety checks for operations"},
    'file': {key: 'f', args: 1},
    'write': {key: 'w', args: 1},
    'sell': {args: 2, description: "exchange,currency (USD)"},
    'buy': {args: 2, description: "exchange,currency"},
    'with': {args: 1, description: "fiat / crypto currency to purchase with (default: USD)"},
    'for': {args: 1, description: "fiat / crypto currency to sell for (default: USD)"},
    'move': {args: 3, description: "fromExchange, exchange, currency"},
    'amount': {args: 1, description: "amount to move (if balances don't show currency)"},
    'cost': {args: 1, description: "amount of currency --with to spend on --buy"}
  })



  let rl = Rlsepp.getInstance()
  await rl.initStorable()
  let exchanges = rl.getExchangesWithAPIKeys()
  if (exchanges.length == 0)
    throw(new Error("no exchanges to initialize"))

  let transaction = []
  if (opt.sell || opt.buy) {

    let [exchange,currency, currencyWith, currencyFor, amount] = []

    if (opt.sell)
      [exchange,currency] = opt.sell

    if (opt.buy)
      [exchange, currency] = opt.buy

    if (opt.with)
      currencyWith = opt.with
    if (opt.for)
      currencyFor = opt.for

  await rl.initAsync([exchange], {enableRateLimit: true, timeout:12500, retry: 5});
  let spreads = rl.deriveSpreads( )
  let balances = await rl.showBalances(spreads)

//    let wallet = new IxDictionary()
    let wallet = balances

    //  use opt.amount scrubbed against balance for sale amount
    //
    if (opt.amount > 0 && opt.sell) {
      if ( wallet[exchange][currency].value > opt.amount)
        wallet[exchange][currency].value = opt.amount
    }


    let symbol = currency+"/"
    if (currencyWith) {
      symbol += currencyWith
      if (opt.cost > 0)
        wallet[exchange][currencyWith].value = opt.cost
    } else {
      symbol += "USD"
      if (opt.cost > 0)
        wallet[exchange]["USD"].value = opt.cost
    }

    let ticker = rl.getTickerByExchange(exchange,symbol)

    let [action, w] = []

    if (opt.sell) {
      [action, w] = rl.projectSell(wallet, exchange, ticker)
    }

    if (opt.buy)
      [action, w] = rl.projectBuy(wallet, exchange, ticker)

    let events = new IxDictionary()
    events.set(exchange, new IxDictionary())
    events[exchange][symbol] = action

    let books = await rl.fetchOrderBooks(events, {store: false})

    //  transaction is event(action) with orders, total matching amount 
    //
    transaction = rl.adjustActions([action])

    log(JSON.stringify(transaction))
  } else if (opt.move) {
    let [fromExchange, exchange, currency] = opt.move

    let amount = 0

  await rl.initAsync([fromExchange, exchange], {enableRateLimit: true, timeout:12500, retry: 5});
  let spreads = rl.deriveSpreads( )
  let balances = await rl.showBalances(spreads)

    let wallet = balances
    if (wallet.has(currency, fromExchange))
      amount = wallet[fromExchange][currency].value
    else if (opt.amount > amount)
      amount = opt.amount

    let symbol = currency+"/USD"

    let address = await rl.getDepositAddress(currency, exchange)
    log("address :" +address)

    let e = new Event({
      action:"move",
      exchange:exchange,
      address:address,
      fromExchange:fromExchange,
      amountType:currency,
      amount: amount,
      costType:currency,
      cost:1,
      tid:null
    })
    transaction = [e]
  } else {
    await rl.initAsync(exchanges, {enableRateLimit: true, timeout:12500, retry: 5});
    let spreads = rl.deriveSpreads( )
    let balances = await rl.showBalances(spreads)

  }

  let eid = process.pid

  if (transaction.length > 0) {
  try {
    let ev = transaction[0]
    ev.created_by = 'events_maker'

    //  keep order book if one is embedded within
    //
    let oid = null
    if (ev.orders) {
      let book = new OrderBook(ev)
      log('storing order book')
      oid = await rl.store(book, 'orderbook')

      delete ev.orders
      ev.orderbookid = oid
    }
    log('storing event, book id: '+oid)
    eid = await rl.store(ev, 'event')
    log("eid: "+eid)
  } catch(err) {
    log(err)
  }
  }

  if ((opt.sell || opt.buy || opt.move ) && opt.write) {
    let fileName = "events.maker."+eid+".json"
    if (opt.write)
      fileName = opt.write
    var eventFile = fs.createWriteStream(fileName, { flags: 'w' }); 
    eventFile.write(JSON.stringify(transaction, null, 4))

    log("wrote file "+fileName)
  }

})()
