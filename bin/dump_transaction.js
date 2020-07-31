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

//getopt.showHelp();

// process.argv needs slice(2) for it starts with 'node' and 'script name'
// parseSystem is alias  of parse(process.argv.slice(2))
// opt = getopt.parseSystem();

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))
console.trace = console.log

;(async function main() {

  let opt = getopt.parse(process.argv.slice(2));
//  console.info({argv: opt.argv, options: opt.options});
  log(opt.options)


  let rl = Rlsepp.getInstance()
  await rl.initStorable()

  let t = await rl.storable.retrieve({transaction_tag: opt.options.t}, 'transaction');
  /*
  let newT = new Events(t);
  let tag = opt.options.t
  let [id, endex, subid] = tag.split('_');
  if (typeof subid === undefined)
    subid = 0
  else
    subid = Number(subid) + 1
  tag = id+"_"+endex+"_"+subid

  for (let ev of t) {
    ev.transaction_tag = tag
    newT.add(ev, tag)
  }
*/
  let name = opt.options.w || 'dump_transaction.'+tag+'.json';
  var eventFile= fs.createWriteStream( name, { flags: 'w' });
  eventFile.write(JSON.stringify(t, null, 4));

  log('wrote file '+name+' with '+t.count()+' events');

})()
