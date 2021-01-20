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
, Events = require('librlsepp').Events
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
          //    'file': {key: 'f', args: 1, description: "[file] input filename containing json flatfile containing an array of events"},
          'write': {key: 'w', args: 1, default:"events_maker.json", description: "[file] also output json flatfile of individual event(action)"},
          'sell': {default:false, description: "[exchange,currency] (USD)"},
          'buy': {default:false, description: "[exchange,currency] --with [currency (default) USD]"},
          'move': {default:false, description: "[fromExchange, exchange, currency]"},
          'exchange': {args:1, default: null, description: ""},
          'fromExchange': {args:1,default: null, description: ""},
          'currency': {args:1, default: null, description: ""},
          'with': {args: 1, default: "USD", description: "fiat / crypto currency to purchase with (default: USD)"},
          'for': {args: 1, default: "USD", 
          description: "[USD|EUR|BTC|DOGECOIN|...] fiat / crypto currency to sell for (default: USD)"},
          'amount': {args: 1, default: -1, description: "[n] amount to move (if balances don't show currency)"},
          'cost': {args: 1, default:-1, description: "[n] amount of currency --with to spend on --buy"},
          'mock': {args: 1, default: false,
          description: "[null] mock (dry run) sell|buy|move operations performing safe guard checks, encapsulating entire transaction (by id or by --transaction #tag)"},
          'transaction': {args: 1, default:"events_maker", descriptions: "transaction String #[tag]"}
          })

      log(opt)

        let rl = Rlsepp.getInstance()
        await rl.initStorable()

        let exchanges = rl.getExchangesWithAPIKeys()
        if (exchanges.length == 0)
          throw(new Error("no exchanges to initialize"));
await rl.initAsync(exchanges, {enableRateLimit: true, timeout:12500, retry: 5});

      let transaction = []
            if (opt.sell || opt.buy) {

              let [exchange,currency, currencyWith, currencyFor, amount] = []

                exchange = opt.exchange
                currency = opt.currency

                if (opt.with) // defaults: "USD"
                  currencyWith = opt.with

                    if (opt.for) // defaults: "USD"
                      currencyFor = opt.for

              let spreads = rl.deriveSpreads( )
                let balances = await rl.showBalances(spreads)

                //    let wallet = new IxDictionary()
                let wallet = balances

                // wallet override amount in projectSell,projectBuy
                let Pamount = null
                let symbol = currency+"/"+currencyFor

                //  use opt.amount scrubbed against balance for sale amount
                //
                if (opt.sell) {
                  if (opt.amount >= 0) {     
                    if (wallet.has(currency, exchange)) 
                      wallet[exchange][currency].value = numberToString(opt.amount)
                    else {
                      log("or not")
                        wallet.add(new WalletEntry({currency:currency, exchange:exchange, value: numberToString(opt.amount)}))
                    }
                  }
                    //`      } else if (opt.mock != null)
                    //        log('
                    //          throw 'must use --amount'
                    //        Pamount = rl.marketsMinimumLimit(symbol, exchange)

                } 
              log(wallet)

                symbol = currency+"/"+currencyWith
                log('symbol '+symbol)
                if (opt.buy) {
                  if (opt.cost > -1) {
                    if (wallet.has(currencyWith, exchange))
                      wallet[exchange][currencyWith].value = numberToString(opt.cost)
                    else
                      wallet.add(new WalletEntry({currency:currencyWith, exchange:exchange, value: numberToString(opt.cost)}))
                  } 
//                  else if (opt.mock != null)
//                    throw 'must use --amount'

                      //        Pamount = rl.marketsMinimumLimit(symbol, exchange)
                }
              //  tickers don't matter at all for prices
              //    only that the symbol is offered (which is also a guess at this point
              //
              let ticker = rl.getTickerByExchange(exchange,symbol)


                let [action, w] = []
                if (opt.sell) {
                  [action, w] = rl.projectSell(wallet, exchange, ticker,Pamount)
                    action.symbol = undefined
                }

              if (opt.buy) {
                [action, w] = rl.projectBuy(wallet, exchange, ticker, Pamount)
                  action.symbol = undefined
              }

              log(action)

                let events = new Events()

                let now = new moment()
                if (opt.transaction)
                  events.add([action], opt.transaction)
                else 
                  events.add([action], action.action + " " +action.exchange + now.toISOString())

                    //  TODO: when re-entrant, this disconnect on time/cache will be an issue
                    //
                    let books = await rl.fetchOrderBooks(events, {store: false})
                    transaction = await rl.adjustActions([action])
                    if (opt.transaction)
                      transaction.map(e => {e.transaction_tag = opt.transaction})

                        log(JSON.stringify(transaction))

            } else if (opt.move) {
              let [fromExchange, exchange, currency] = [opt.fromExchange, opt.exchange, opt.currency]

                let amount = numberToString(0)

              let spreads = rl.deriveSpreads( )
                let balances = await rl.showBalances(spreads)
                log(balances)

                let wallet = balances
                if ((opt.mock != null) && opt.amount >= 0)
                  amount = numberToString(opt.amount)
                    if (wallet.has(currency, fromExchange) && (opt.mock == null))
                      amount = numberToString(wallet[fromExchange][currency].value)

                        if (opt.amount >= 0) {
                          if (wallet.has(currency, exchange))
                            wallet[fromExchange][currency].value = numberToString(amount)
                          else
                            wallet.add(new WalletEntry({currency:currency, exchange:fromExchange, value: numberToString(amount)}))
                        }

              let address = await rl.getDepositAddress(currency, exchange)
              address = address.address
                log("address :" +address)

                let action
                let w
                try {
                  [action, w] = await rl.projectTransfer(wallet, fromExchange, exchange, currency)
                    log(action)
                } catch(e) {
                  throw(e)
                };
              /*
                 let e = new Event({
action:"move",
exchange:exchange,
address:address,
fromExchange:fromExchange,
amountType:currency,
amount: amount,
costType:currency,
cost:1,
transaction_tag:opt.transaction,
tid:null
})
*/
log("minimum limit on "+currency+"/"+opt.with + " at "+fromExchange)
log(JSON.stringify(rl.markets(currency+"/"+opt.with, fromExchange)))

if (opt.transaction)
  action.transaction_tag = opt.transaction
  transaction = [action]
  } else if (opt.file) {

  } else {
    let spreads = rl.deriveSpreads( )
      let balances = await rl.showBalances(spreads)

  }


let eid = process.pid

if (transaction.length > 0) {
  try {
    let ev = transaction[0]
      ev.created_by = 'events_maker'
      ev.tagid = 1

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

if ((opt.sell || opt.buy || opt.move || opt.file ) && opt.write) {
  let fileName = "events.maker."+eid+".json"
    if (opt.write)
      fileName = opt.write
        var eventFile = fs.createWriteStream(fileName, { flags: 'w' }); 
  eventFile.write(JSON.stringify(transaction, null, 4))

    log("wrote file "+fileName)
}

})()
