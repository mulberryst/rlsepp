'use strict';

const IxDictionary = require('./js/lib/ixdictionary')
  ,Ticker = require('./js/lib/spread').Ticker
  ,Spread = require('./js/lib/spread').Spread
  ,Spreads = require('./js/lib/spread').Spreads
  ,Rlsepp = require('./js/lib/rlsepp').Rlsepp
  ,Iterable = require('./js/lib/rlsepp').Iterable
  , log4js = require('log4js')
;

const version = "0.0.1"
const debug = {Spread:1}

log4js.configure({
  appenders: { 
    file: { type: 'file', filename: 'log/librlsepp.log' },
    screen: { type: 'console' },
  },
  categories: { default: { appenders: ['screen', 'file'], level: 'info' } }
});

module.exports = Object.assign({version, debug, IxDictionary, Ticker, Spread,Spreads, Rlsepp, Iterable})
