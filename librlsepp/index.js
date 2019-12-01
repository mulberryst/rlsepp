'use strict';

const IxDictionary = require('./js/lib/ixdictionary')
  ,Ticker = require('./js/lib/spread').Ticker
  ,Spread = require('./js/lib/spread').Spread
  ,Spreads = require('./js/lib/spread').Spreads
  ,Rlsepp = require('./js/lib/rlsepp').Rlsepp
;

const version = "0.0.1"
const debug = {Spread:1}

module.exports = Object.assign({version, debug, IxDictionary, Ticker, Spread,Spreads, Rlsepp})
