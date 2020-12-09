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
  , IxDictionary = require('librlsepp/js/lib/ixdictionary')
  , OrderBook = require('librlsepp/js/lib/orderbook').OrderBook
  , Wallet = require('librlsepp/js/lib/wallet').Wallet
  , WalletEntry = require('librlsepp/js/lib/wallet').WalletEntry
  , Ticker = require('librlsepp').Ticker
  , Tickers = require('librlsepp').Tickers
  , Event = require('librlsepp/js/lib/event').Event
  , Events = require('librlsepp/js/lib/event').Events
  , Storable = require('librlsepp/js/lib/storable').Storable
  , sprintf = require('sprintf-js').sprintf
  , clone = require('clone')
;

// node-getopt oneline example.
/*
  ['s' , ''                    , 'short option.'],
  [''  , 'long'                , 'long option.'],
  ['S' , 'short-with-arg=ARG'  , 'option with argument', 'S'],
  ['L' , 'long-with-arg=ARG'   , 'long option with argument'],
  [''  , 'color[=COLOR]'       , 'COLOR is optional'],
  ['m' , 'multi-with-arg=ARG+' , 'multiple option with argument'],
  [''  , 'no-comment'],
  */
let getopt = new Getopt([
  ['a', 'all', 'all'],
  ['f', 'file=ARG', 'file'],
  ['t', 'transaction-tag=ARG', 'transaction tag'],
  ['w', 'write=ARG', 'file name to write output'],
  ['h' , 'help'                , 'display this help'],
  ['v' , 'version'             , 'show version']
]);              // create Getopt instance
//.bindHelp()     // bind option 'help' to default action

// Use custom help template instead of default help
// [[OPTIONS]] is the placeholder for options list
getopt.setHelp(
  "Usage: node help.js [OPTION]\n" +
  "node-getopt help demo.\n" +
  "\n" +
  "[[OPTIONS]]\n" +
  "\n" +
  "Installation: npm install node-getopt\n" +
  "Respository:  https://github.com/jiangmiao/node-getopt"
);


// process.argv needs slice(2) for it starts with 'node' and 'script name'
// parseSystem is alias  of parse(process.argv.slice(2))
// opt = getopt.parseSystem();


//
////
function walletFromEvent(event=null) {
  //  if (!event instanceof Event) throw (new Error("walletFromEvent passed invalid object"+event))
  let wallet = new Wallet()
  let currency = null
  let amount = 0
  let exchange = event.exchange
  if (event && event.exchange && event.amountType && event.amount && event.amount > 0) {
    if (event.action == "buy" || event.action == "move") {
      currency = event.amountType
      amount = event.amount
    }
    if (event.action == "sell" ) {
      currency = event.costType
      amount = event.cost
    }
    wallet.add(new WalletEntry({currency:currency, value: amount, exchange: exchange}))
  }
  return wallet
}

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))
console.trace = console.log

;(async function main() {

  let opt = getopt.parse(process.argv.slice(2));
  //  console.info({argv: opt.argv, options: opt.options});
  log(opt.options)
  if (typeof opt.options.t === 'undefined' && typeof opt.options.f === 'undefined' && typeof opt.options.a === 'undefined') {
    getopt.showHelp();
    process.exit()
  }


  let rl = Rlsepp.getInstance()
  await rl.initStorable()
  let exchanges = rl.getCurrentTickerExchanges()
  //
  await rl.initAsync(exchanges);

  let t


  if (opt.options.file) {
    let jsonevents = null
    try {
      const contents = await fs.readFile(opt.options.file)
      jsonevents = JSON.parse(contents)
    } catch(e) {
      log(e.message)
    };

    t = new Events(jsonevents)
  } else if (opt.options.t) {

    t = await rl.storable.retrieve({transaction_tag: opt.options.t}, 'transaction');


  } else if (opt.options.a) {


  }
    /*
    let tf = await rl.transferFee('ETH', 'binance');
    log(tf)
    process.exit();
    */

  t = await rl.correctEvents(t)

  let transCont = []
  let spreads = rl.deriveSpreads( )
  let balances = await rl.showBalances(spreads)


  let exchangesPerCurrency = t.exchangesPerCurrency()

  for (let c of exchangesPerCurrency.keys()) {
    let tuple = exchangesPerCurrency[c].keys();

    for (let e of exchangesPerCurrency[c].keys()) {
      log(exchangesPerCurrency[c][e] + ' -> '+e)

      let currency = c
      let wallet = new Wallet()

      let fee
      try {
        fee = await rl.transferFee(currency, fromExchange); 
        log(fee)
      } catch(e) {
        fee = {fee:1, minimum:1}
      }

      let amount = Number(fee.fee) + Number(fee.minimum)

      let fromExchange = exchangesPerCurrency[c][e]
      let exchange = e

      // check move from exchange -> to exchange
      //
      //make sure exchange wont actually make a withdraw
      if ( balances.has(c, fromExchange) )
        amount = Number(balances[fromExchange][currency].value) + 1

      wallet.add(new WalletEntry({currency: currency, exchange: fromExchange, value: amount }))

      let [event, wa] = await rl.projectTransfer(wallet, fromExchange, exchange, currency)

      log(event)

      let result = null
      try {
        result = await rl.moveMoneyAsync(
          event.amountType, event.fromExchange, event.exchange, Number(event.amount) + Number(event.cost)
        )
        log(result)
      } catch(e) {
        log(JSON.stringify(e))
        log(e.message)
        let s = e.message || e
        if (s.indexOf(event.fromExchange) > -1) { 
          try {
            let o = {exchange: event.fromExchange, currency: event.amountType, withdrawminnobalance: s}
            await rl.store(o, 'transfercheck');
          } catch(e) {
            log(e)
          }
        } else if (s.indexOf(event.exchange) > -1) {
          try {
            let o = {exchange: event.exchange, currency: event.amountType, fetchdepositaddress: s}
            await rl.store(o, 'transfercheck');
          } catch(e) {
            log(e)
          }
        }
      }

      //store result
      //
      //  certainty threshold
      //  withdrawals can check if deposit address
      //
      //  table apiErrorCode
      //    exchange,currency
      //
      //    withdrawMinNoBalance
      //    fetchDepositAddress
      //    
      //
      //  one idea is movecheck table
      //    pk (exchange, currency)
      //    deposit address
      //      50-75% -> certainty
      //    withdraw minimum no balance error code
      //      if error mentions balance, no indicator
      //      ir error mentions withdraw capabilities
      //    withdraw minimum (with balance) error code
      //      100% -> certainty
      //    fk transferfees *isenabled*
      //    event (pending, succeeded)
      //
      //  another is walletstatus (stemming solely from yobit's wallet status report)
      //
      //  however, i like added fields to transferfees
      //    (ccxt's exchange->marketdata->currency stores withdraw enabled, deposit enabled)
      //
      //

      // check move from exchange -> to exchange
      //
      //make sure exchange wont actually make a withdraw
      //
      //
      fee
      try {
        fee = await rl.transferFee(currency, exchange); 
        log(fee)
      } catch(e) {
        fee = {fee:1, minimum:1}
      }

      amount = Number(fee.fee) + Number(fee.minimum)

      if ( balances.has(currency, exchange) )
        amount = Number(balances[exchange][currency].value) + 1

      wallet = new Wallet()
      wallet.add(new WalletEntry({currency: currency, exchange: exchange, value: amount }))

      try {
        [event, wa] = await rl.projectTransfer(wallet, exchange, fromExchange, currency)
      } catch(e) {
        log(e)
        throw new Error(e)
      }

      log(event)

      try {
        result = await rl.moveMoneyAsync(
          event.amountType, event.fromExchange, event.exchange, Number(event.amount) + Number(event.cost)
        )
        log(result)
      } catch(e) {
        log(e)
        let s = e.message || e
        log(s)
        if (s.indexOf(event.fromExchange) > -1) { 
          try {
            let o = {exchange: event.fromExchange, currency: event.amountType, withdrawminnobalance: s}
            await rl.store(o, 'transfercheck');
          } catch(e) {
            log(e)
          }
        } else if (s.indexOf(event.exchange) > -1) {
          try {
            let o = {exchange: event.exchange, currency: event.amountType, fetchdepositaddress: s}
            await rl.store(o, 'transfercheck');
          } catch(e) {
            log(e)
          }
        }
      }
    }
  }
/*
  let newT = new Events(t);
  let tag = opt.options.t
  let [id, endex, subid] = tag.split('_');
  if (typeof subid === undefined)
    subid = 0
  else
    subid = Number(subid) + 1
  tag = id+"_"+endex+"_"+subid

*/

})()
