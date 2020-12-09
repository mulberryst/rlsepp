'use strict';
const config = require('config')
  , Getopt = require('node-getopt')
  , Rlsepp = require('librlsepp').Rlsepp
  , IxDictionary = require('librlsepp').IxDictionary
  , Wallet = require('librlsepp/js/lib/wallet').Wallet
  , WalletEntry = require('librlsepp/js/lib/wallet').WalletEntry
  , Event = require('librlsepp').Event
  , Events = require('librlsepp').Events
  , Ticker = require('librlsepp').Ticker
  , Tickers = require('librlsepp').Tickers
  , Spread = require('librlsepp').Spread
  , Spreads = require('librlsepp').Spreads
  , Storable = require('librlsepp').Storable
  , verbose = process.argv.includes('--verbose')
  , debug = process.argv.includes('--debug')
  , fs = require("mz/fs")
  , path = require('path')
  , util = require('util')
  , asTable = require ('as-table').configure ({ title: x => x.bright, delimiter: ' | '.dim.cyan, dash: '-'.bright.cyan })
  , asTableLog = require ('as-table').configure ({ title: x => x, delimiter: ' | ', dash: '-' })
  , TreeModel = require('tree-model')
  , moment = require('moment')
  , JSON = require('JSON')
  , log = require('ololog')
;

var filename = path.basename(__filename);
var logStdout = process.stdout;
var logStderr = process.stderr;
var now = moment()

let getopt = new Getopt([
  ['e', 'exchange=ARG', 'exchange'],
  ['s', 'symbol=ARG', 'symbol'],
  ['c' , 'currency=ARG', 'currency']
])              // create Getopt instance
.bindHelp();     // bind option 'help' to default action

let opt = getopt.parse(process.argv.slice(2)).options;
//  console.info({argv: opt.argv, options: opt.options});
log(opt)

;(async function main() {
  //  let ixExchanges = new IxDictionary(["yobit", "livecoin", "gemini", "crex24", "cex"])

  if (!(opt.symbol || opt.currency)) {
    getopt.showHelp()
    process.exit()
  }


  const rl = Rlsepp.getInstance();
  await rl.initStorable()

  //  if (opt.currency && opt.amount) {
  //    wallet = new Wallet({currency:opt.currency, value: opt.amount, exchange: opt.from})
  //    wallet = new Wallet(new WalletEntry({currency:opt.currency, value: opt.amount, exchange: opt.from}))
  //}

  let exchanges = rl.getCurrentTickerExchanges()
  if (opt.exchange) {
    exchanges = [opt.exchange]
  }

//  log(exchanges.join(" "))

  // initialize exchanges 
  //
  await rl.initAsync(exchanges, {verbose});

  let symbol = null
  let currency = null
  if (opt.symbol)
    symbol = opt.symbol
  let out = await rl.fetchOrders(opt.exchange, symbol, currency) 
  log(out)

})()
