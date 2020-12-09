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
  , Tickers = require('librlsepp').Tickers
  , IxDictionary = require('librlsepp/js/lib/ixdictionary')
  , OrderBook = require('librlsepp/js/lib/orderbook').OrderBook
  , Event = require('librlsepp/js/lib/event').Event
  , Events = require('librlsepp/js/lib/event').Events
  , Storable = require('librlsepp/js/lib/storable').Storable
  , sprintf = require('sprintf-js').sprintf
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
  ['d', 'delete', 'delete from dB'],
  ['t', 'transaction-tag=ARG', 'transaction tag'],
  ['l', 'latest from profit view', 'latest'],
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

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))
console.trace = console.log

;(async function main() {

  let opt = getopt.parse(process.argv.slice(2));
//  console.info({argv: opt.argv, options: opt.options});
  log(opt.options)
  if (typeof opt.options.t === 'undefined' && typeof opt.options.l === 'undefined') {
    getopt.showHelp();
    process.exit()
  }


  let rl = Rlsepp.getInstance()
  await rl.initStorable()

  let t
  if (opt.options.l) {
    //let ev = await rl.storable.retrieve("select * from latest_moves_by_profit where latest > now() - interval '2 day' order by profit desc limit 10", 'stmt')
    let ev = await rl.storable.retrieve("select * from latest_moves_by_profit where latest > now() - interval '2 day' order by profit desc", 'stmt')
    let tags = []
    for (let i in ev) {
      let e = ev[i]
      if (typeof e.transaction_tag !== 'undefined') 
        tags.push(e.transaction_tag)
    }
//    log(tags)
    t = await rl.storable.retrieve({transaction_tag: tags}, 'transaction');
    /*
    for (let i in t) {
      let e = ev[i]
      if (typeof e.transaction_tag !== 'undefined') 
        tags.push(e.transaction_tag)
    }
*/
  } else {
    t = await rl.storable.retrieve({transaction_tag: opt.options.t}, 'transaction');
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

  for (let tid in t) {
    let tran = t[tid]
    for (let ev of tran) {
      ev.transaction_tag = tid
    }
  }
  log(t)
*/

  let name = opt.options.w || opt.options.t + '.json'|| 'latest_by_profit' +'.json';
  var eventFile= fs.createWriteStream( name, { flags: 'w' });
  eventFile.write(JSON.stringify(t, null, 4));

  log('wrote file '+name+' with '+t.count()+' events');
})()
