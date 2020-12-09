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
  let exchanges = rl.exchanges()

  await rl.initStorable()

  if (!opt.options.a) {
    exchanges = rl.getCurrentTickerExchanges()
  }
  //
  await rl.initAsync(exchanges);

  let t = null
  let out = new Events()

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
    //
    //  query apis of all exchanges having keys,
    //    look for withdraw info
    //

    let exchangesInitialized = rl.dictExchange.keys();

    let p = []
    for (let ex of exchangesInitialized) {
      let mkts = rl.dictExchange[ex].ccxt.markets

      log("exchange " + ex)
      let once = 1
      let oonce = 1
      for (let sym in mkts) {
        let c = sym.split('/')[0]

        let ct = rl.dictExchange[ex].ccxt.currencies[c]

        let m = rl.dictExchange[ex].ccxt.markets[sym]
        //            log("exchange "+ ex + " " + sym + " " + ' minimum ' + rl.marketsMinimumLimit(sym, ex))
        //            log("  maker fee "+m.maker + " taker fee "+ m.taker + "is percentage " + m.percentage)

        let o = { exchange: ex, currency: c, description:' '}
        if (typeof ct !== 'undefined') {
          if (ct.limits && ct.limits.withdraw && ct.limits.withdraw.min)
            o.minimum = ct.limits.withdraw.min
          if (typeof ct.info !== 'undefined') {
            for (let f in ct.info) {
                if (f == 'disabled')
                  o['withdrawEnabled'] = !ct.info[f]
                if (f == 'enabled' || f == 'withdrawAlowed' || f == 'is_withdrawal_active')
                  o['withdrawEnabled'] = ct.info[f]
              if (f.match('isable')) {
                if (f.match('eposit')) {
                  o['depositEnabled'] = !ct.info[f]
                } else if (f.match('ithdraw')) {
                  o['withdrawEnabled'] = !ct.info[f]
                }
              }
              if (f == 'withdrawalsAllowed')
                o['withdrawEnabled'] = ct.info[f]
              if (f == 'depositsAllowed' || f == 'is_deposit_active')
                o['depositEnabled'] = ct.info[f]
              if (f.match('nable')) {
                if (f.match('eposit') || f.match('payin')) {
                  o['depositEnabled'] = ct.info[f]
                } else if (f.match('ithdraw') || f.match('payout')) {
                  o['withdrawEnabled'] = ct.info[f]
                }
//                log('interesting field: '+f+' val:'+ct.info[f])
//                oonce = 0
              }
            }
            let sub = null
            for (let f in ct.info) {
              if (typeof ct.info[f] === 'Object') {
                sub = f
                log(`sub ${sub}`)
              }
            }
            let fields = ['txWithdrawalFee','WithdrawTxFee', 'drawFee','withdraw_fee', 'txFee', 'withdrawFee', 'withdrawalFee', 'withdrawalMinFee', 'withdrawal_fee_const', 'payoutFee', 'drawFee', 'withdrawal_fee']
            for (let f of fields) {
              if (ct.info[f])
                o.fee = ct.info[f]
              if (sub && ct.info[sub] && ct.info[sub][f])
                o.fee = ct.info[sub][f]
            }
            if (ct.info['limits']) {
              if (ct.info['limits']['withdraw']) {
                o.minimum = ct.info.limits.withdraw.min
              }
            }
            //            log( ex + " " + c + " withdrawFee "+ct.info.withdrawFee + " min withdraw amt " + ct.info.minWithdrawAmount + " min order amount" + ct.info.minOrderAmount)

            fields = ['MinWithdrawal','min','minimalWithdrawalAmount', 'min_withdrawal_amount','withdraw-min-amount', 'withdrawalMinAmount', 'minWithdrawAmount', 'minimum_withdrawal', 'withdrawalMinSize', 'minimum_withdrawal_amount','minWithdrawal']
            for (let f of fields) {
              if (ct.info[f])
                o.minimum = ct.info[f]
              if (sub && ct.info[sub] && ct.info[sub][f])
                o.minimum = ct.info[sub][f]
            }

            if ((!o.minimum || !o.fee) && once) {
              log(`captured min:${o.minimum} fee: ${o.fee} withdrawEnabled: ${o.withdrawEnabled} depositEnabled: ${o.depositEnabled}`)
              log(ct.info)
              once = 0
            }
          }
        }
        if (Number(o.minimum) > 0 || Number(o.fee) > 0) {
          p.push(new Promise(async (resolve, reject) => {
            try {
              await rl.storable.store(o, 'transferfee')
            } catch(e) {
              log(o)
              log(e)
            }
            resolve(o)
          }))
        } //o.fee || o.minimum
      }
    }

    setInterval(()=>{
      let count = 0
      let total = 0
      for (let promise of p) {
        if (util.inspect(promise).includes("pending"))
          count++
        total++;
      }
      log(`promises pending: ${count} of ${total}`);
    },1000)
    let r = await Promise.all(p).then( ).catch(error => log(error))
    log('done waiting for promises');

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
      out.add(ev, tid)

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

      log('*********')
      log()
      for (let eeiT of backwards) {
        if (eeiT.action == 'buy') {
          let t = trans[0]
          let w = wallets[0]
          let symbol = eeiT.amountType + '/' + eeiT.costType
          let ticker = rl.getTickerByExchange(eeiT.exchange, symbol)

          log(symbol + ' ' + eeiT.exchange)
          log(ticker)

          let wallet = new Wallet()

          let limits = rl.marketsLimit(symbol, eeiT.exchange)
//          * ticker.ask
          log("market minimum for "+symbol+' = '+limits)

          let value
          if (limits.cost.min)
            value = limits.cost.min
          //  calculate wallet for projectBuy based on amount needed for next transaction
          //
          if (typeof t !== 'undefined') {
            let needed = Number(w[eeiT.exchange][t.costType].value)

            //    let ticker = rl.getTickerByExchange(t.exchange,t.costAmount + '/' + eeiT.amountType)

            //              let ticker = rl.getTickerByExchange(t.exchange,t.costAmount + '/' + eeiT.amountType)
            let fee = 0
            let Exchange = rl.dictExchange[eeiT.exchange]
            try {
              let f = Exchange.ccxt.calculateFee(ticker.symbol, 'type', 'buy', needed, ticker.ask, 'maker', {})
              fee = f.cost
            } catch(e) {
              throw new Error(eeiT.exchange + " has no market for "+ticker.symbol)
            }

            //amount = (wallet[quote].value - fee) / ticker.ask
            //
            //needed * ticker.ask = wallet[quote].value - fee
            //needed * ticker.ask + fee = wallet[quote].value
            value = needed * ticker.ask + fee
            if (limits.cost.min && limits.cost.min > value)
              value = limits.cost.min
              

            log(`needed ${needed} t cost ${t.cost} price ${ticker.ask} fee ${fee} = amount ${value} of ${t.costType}`)
          }
          wallet.add(new WalletEntry({currency: eeiT.costType, exchange: eeiT.exchange, value: value }))
          wallets.unshift(wallet)
          log(wallet)

          let [event, wa] = rl.projectBuy(new Wallet(wallet), eeiT.exchange, ticker)
          event.limits = rl.marketsLimit(symbol, eeiT.exchange)

          log(event)
          trans.unshift(event)

        } else if (eeiT.action == 'move') {

          let t = trans[0]
          let w = wallets[0]

          let currency = eeiT.amountType
          let fee
          try {
            fee = await rl.transferFee(currency, eeiT.fromExchange); 
            log(fee)
          } catch(e) {
            fee = {fee:0, minimum:0}
          }
          let needed = fee.minimum + fee.fee
          let wallet = new Wallet()
          if (typeof t !== 'undefined') {
            let prevWallet = Number(w[eeiT.exchange][t.costType].value) + fee.fee
            if (prevWallet > needed)
              needed = prevWallet
            //  treat as buy (this excluded two move's in a row
            //
            let symbol = t.amountType + '/' + t.costType
            let ticker = rl.getTickerByExchange(t.exchange, symbol)
            //            log(symbol)
            if ((t.cost + fee.fee) > needed)
              needed = t.cost + fee.fee
//            log(`cost ${t.cost} price ${ticker.ask} fee ${fee.fee} = amount ${needed} of ${t.costType}`)

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
      out.add(trans, tid+"_min")
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

  if (out != null) {
    for (let tid in out) {
      let  trans = out[tid]
      for (let ev of trans) {
        ev.transaction_tag = tid
      }
    }

    let infile = opt.options.f
    if (infile) 
      infile = infile.replace('.json', '')
    let name = opt.options.t || infile;
    if (name.indexOf('_min') == -1)
      name += '_min';
    if (name.indexOf('.json') == -1)
      name += '.json';
    if (opt.options.w)
      name = opt.options.w
    var eventFile= fs.createWriteStream( name, { flags: 'w' });
    eventFile.write(JSON.stringify(out, null, 4));

    log('wrote file '+name+' with '+out.count()+' events');
  }

})()
