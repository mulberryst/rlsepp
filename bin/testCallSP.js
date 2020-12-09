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
  ['f', 'file=ARG', 'transaction file to draw from'],
  ['h' , 'help'                , 'display this help'],
  ['v' , 'version'             , 'show version']
])              // create Getopt instance
.bindHelp();     // bind option 'help' to default action

let opt = getopt.parse(process.argv.slice(2)).options;
//  console.info({argv: opt.argv, options: opt.options});
log(opt)

;(async function main() {
  //  let ixExchanges = new IxDictionary(["yobit", "livecoin", "gemini", "crex24", "cex"])


  if (!opt.file) {
    getopt.showHelp()
    process.exit()
  }

  const rl = Rlsepp.getInstance();
  await rl.initStorable()

  //  if (opt.currency && opt.amount) {
  //    wallet = new Wallet({currency:opt.currency, value: opt.amount, exchange: opt.from})
  //    wallet = new Wallet(new WalletEntry({currency:opt.currency, value: opt.amount, exchange: opt.from}))
  //}

  /*
  let exchanges = rl.getCurrentTickerExchanges()
  if (opt.exchange && opt.exchange.constructor == Array) {
    exchanges = opt.exchange
  }

//  log(exchanges.join(" "))

  // initialize exchanges 
  //
  await rl.initAsync(exchanges, {verbose});
*/

    let json = null
    try {
      const contents = await fs.readFile(opt.file)
      json = JSON.parse(contents)
    } catch(e) {
      log(e.message)
    };

    try {
//      let r = await rl.storable.call('event_pending', null, '2171463002_bitfinex2_min',0);
      let r = await rl.storable.call('event_pending', null, '2171463002_bitfinex2_min',1);
    } catch(e) {
      log(e)
    }
  //CREATE OR REPLACE PROCEDURE public.event_began(ptransaction_tag character varying, ptagid integer, pstatus varchar = 'open', ptid integer = null, ptxid varchar = null, pcreated timestamptz=null, presult json=null)
    try {
//      let r = await rl.storable.call('event_began', null, '2171463002_bitfinex2_min',0, 'closed', 1500012999323405, null, null, json);
    let r = await rl.storable.call('event_began', null, '2171463002_bitfinex2_min',1, 'closed', null, '794561a90ec8f5fb5bfb5802a97c07d149e8c358c87376383ce1612d005dedcc', null, json);
    } catch(e) {
      log(e)
    }

  //CREATE OR REPLACE PROCEDURE public.event_complete(ptransaction_tag character varying, ptagid integer, status, premaining float8, pfullfilled float8, pfullfilled_datetime timestamptz = null)
    try {
//      let r = await rl.storable.call('event_complete', null, '2171463002_bitfinex2_min',0, 'closed', 0, 0.00174056, null);
      let r = await rl.storable.call('event_complete', null, '2171463002_bitfinex2_min',1, 'closed', 0, 0.00054056,null);
    } catch(e) {
      log(e)
    }
/*
  if (json && json.tid) {
    try {
      log("storing event transaction")
      const r = await rl.store(rev, 'event')
      log(r)
    } catch(err) {
      log(err)
    }
  }
  */

})()
