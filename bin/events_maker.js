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
  formatCrypto,
  numberToString
} = functions

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async function main() {

  let opt = stdio.getopt({
//    'force': {boolean: 1, description: "bypass safety checks for operations"},
    'file': {key: 'f', args: 1, 
      description: "[file] input filename containing json flatfile containing an array of events"},
    'write': {key: 'w', args: 1, description: "[file] also output json flatfile of individual event(action)"},
    'sell': {args: 2, description: "[exchange,currency] (USD)"},
    'buy': {args: 2, description: "[exchange,currency] --with [currency (default) USD]"},
    'with': {args: 1, default: "USD", description: "fiat / crypto currency to purchase with (default: USD)"},
    'for': {args: 1, default: "USD", 
        description: "[USD|EUR|BTC|DOGECOIN|...] fiat / crypto currency to sell for (default: USD)"},
    'move': {args: 3, description: "[fromExchange, exchange, currency]"},
    'amount': {args: 1, description: "[n] amount to move (if balances don't show currency)"},
    'cost': {args: 1, description: "[n] amount of currency --with to spend on --buy"},
    'mock': {args: 1, default: 1,
      description: "[1] mock (dry run) sell|buy|move operations performing safe guard checks, encapsulating entire transaction (by id or by --transaction #tag)"},
    'transaction': {args: 1, descriptions: "transaction String #[tag]"}
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

    if (opt.with) // defaults: "USD"
      currencyWith = opt.with

    if (opt.for) // defaults: "USD"
      currencyFor = opt.for

  await rl.initAsync([exchange], {enableRateLimit: true, timeout:12500, retry: 5});
  let spreads = rl.deriveSpreads( )
  let balances = await rl.showBalances(spreads)

//    let wallet = new IxDictionary()
    let wallet = balances

    //  use opt.amount scrubbed against balance for sale amount
    //
    if (opt.amount && opt.sell && opt.mock)
      if (wallet.has(currency, exchange))
        wallet[exchange][currency].value = numberToString(opt.amount)
      else
        wallet.add(new WalletEntry({currency:currency, exchange:exchange, value: numberToString(opt.amount)}))

    let symbol = currency+"/"
    symbol += currencyWith
    if (opt.cost && opt.mock)
      if (wallet.has(currency, exchange))
        wallet[exchange][currencyWith].value = numberToString(opt.cost)
      else
        wallet.add(new WalletEntry({currency:currency, exchange:exchange, value: numberToString(opt.cost)}))

    //  tickers don't matter at all for prices
    //    only that the symbol is offered (which is also a guess at this point
    //
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

    //  TODO: when re-entrant, this disconnect on time/cache will be an issue
    //
    let books = await rl.fetchOrderBooks(events, {store: false})
    transaction = rl.adjustActions([action])
    if (opt.transaction)
      transaction.map(e => {e.transaction_tag = opt.transaction})

    log(JSON.stringify(transaction))

  } else if (opt.move) {
    let [fromExchange, exchange, currency] = opt.move

    let amount = numberToString(0)

  await rl.initAsync([fromExchange, exchange], {enableRateLimit: true, timeout:12500, retry: 5});
  let spreads = rl.deriveSpreads( )
  let balances = await rl.showBalances(spreads)

    let wallet = balances
    if (opt.mock && opt.amount)
      amount = numberToString(opt.amount)
    if (wallet.has(currency, fromExchange) && !opt.mock)
      amount = numberToString(wallet[fromExchange][currency].value)

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

    log(e)
    if (opt.transaction)
      e.transaction_tag = opt.transaction
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
