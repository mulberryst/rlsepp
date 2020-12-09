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

  } else {
    getopt.showHelp();
    process.exit()
  }

  if (typeof opt.options.a === 'undefined') {
    /*
    let tf = await rl.transferFee('ETH', 'binance');
    log(tf)
    process.exit();
    */

    t = await rl.correctEvents(t)

    let transCont = []

//    t = t.filter(transaction_tag => !transaction_tag.endsWith('_min'))
    for (let tid in t) {
      if (tid.endsWith('_min'))
        continue  
      let ev = t[tid]

      //            log("  withdrawFee "+c.info.withdrawFee + " min withdraw amt " + c.info.minWithdrawAmount + " min order amount" + c.info.minOrderAmount)

      // skipping wont work, average the deets i need from exchanges that report 
      //    and use those for approx calc
      //
      //  averageWithdrawlFee
      //  minWithdrawAmount
      //  minOrderAmount
      //
      let backwards = []
      for (let eeiT of ev) {
        backwards.unshift(eeiT)
      }
//      log(backwards)
      let pad = 0
      let padType = null

      let trans = []
      let wallets = []
      for (let eeiT of backwards) {
        if (eeiT.action == 'buy') {

        } else if (eeiT.action == 'move') {

          let t = trans[0]
          let w = wallets[0]

          let currency = eeiT.amountType
          let fee
          try {
            let hist = await rl.transferFeeHistogram(currency); 
//            log(JSON.stringify(hist))
            process.exit()
            fee = await rl.transferFee(currency, eeiT.fromExchange); 
          } catch(e) {
            throw(e)
          }
          let needed = fee.minimum + fee.fee
          let wallet = new Wallet()
          if (typeof t !== 'undefined') {
            needed = Number(w[eeiT.exchange][t.costType].value) + fee.fee
            //  treat as buy (this excluded two move's in a row
            //
            let symbol = t.amountType + '/' + t.costType
            let ticker = rl.getTickerByExchange(t.exchange, symbol)
            if (typeof ticker === 'undefined') {
              throw new Error("no ticker for "+symbol+" @ "+t.exchange)
            }
//            log(symbol)
            if ((t.cost * ticker.ask + fee.fee) > needed)
              needed = t.cost * ticker.ask + fee.fee
            log(`cost ${t.cost} price ${ticker.ask} fee ${fee.fee} = amount ${needed} of ${t.costType}`)

//            log(eeiT)
//            log(w)
//            needed = Number(w[eeiT.exchange][t.amountType].value) + fee.fee
          } 
          wallet.add(new WalletEntry({currency: currency, exchange: eeiT.fromExchange, value: needed }))
          wallets.unshift(wallet)

          log(wallet)

          let [event, wa] = await rl.projectTransfer(new Wallet(wallet), eeiT.fromExchange, eeiT.exchange, eeiT.amountType)

          event.fee = fee.fee
          event.minimum = fee.minimum

          log(event)

          trans.unshift(event)
        }
      }
      t.add(trans, tid+"_min")
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

  for (let tid in t) {
    let  trans = t[tid]
    for (let ev of trans) {
      ev.transaction_tag = tid
    }
  }

  let infile = opt.options.f
  if (infile) 
    infile = infile.replace('.json', '')
  let name = opt.options.w || opt.options.t || infile +'_min.json';
  var eventFile= fs.createWriteStream( name, { flags: 'w' });
  eventFile.write(JSON.stringify(t, null, 4));

  log('wrote file '+name+' with '+t.count()+' events');

})()
