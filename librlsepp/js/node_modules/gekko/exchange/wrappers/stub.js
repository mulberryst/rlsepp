const Gdax = require('gdax');
const _ = require('lodash');
const moment = require('moment');

const errors = require('../exchangeErrors');
const retry = require('../exchangeUtils').retry;

const BATCH_SIZE = 100;
const QUERY_DELAY = 350;

const marketData = require('./gemini-markets.json');

const Trader = function(config) {
  this.post_only = true;
  this.use_sandbox = false;
  this.name = 'Gemini';
  this.scanback = false;
  this.scanbackTid = 0;
  this.scanbackResults = [];
  this.asset = config.asset;
  this.currency = config.currency;

  this.api_url = 'https://api.gemini.com';
  this.api_sandbox_url = 'https://api-sandbox.gemini.com';

  if (_.isObject(config)) {
    this.key = config.key;
    this.secret = config.secret;
    this.passphrase = config.passphrase;

    this.pair = [config.asset, config.currency].join('-').toUpperCase();
    this.post_only =
      typeof config.post_only !== 'undefined' ? config.post_only : true;
    
    if (config.sandbox) {
      this.use_sandbox = config.sandbox;
    }

  }

};

const recoverableErrors = [
  'SOCKETTIMEDOUT',
  'TIMEDOUT',
  'CONNRESET',
  'CONNREFUSED',
  'NOTFOUND',
  'Rate limit exceeded',
  'Response code 5',
  'GDAX is currently under maintenance.',
  'HTTP 408 Error',
  'HTTP 504 Error',
  'HTTP 503 Error',
  'socket hang up',
  'EHOSTUNREACH',
  'EAI_AGAIN',
  'ENETUNREACH'
];

const includes = (str, list) => {
  if(!_.isString(str))
    return false;

  return _.some(list, item => str.includes(item));
}

Trader.prototype.processResponse = function(method, next) {
  return (error, response, body) => {
    if(!error && body && !_.isEmpty(body.message)) {
      error = new Error(body.message);
    }

    if(
      response &&
      response.statusCode < 200 &&
      response.statusCode >= 300
    ) {
      error = new Error(`Response code ${response.statusCode}`);
    }

    if(error) {
      if(includes(error.message, recoverableErrors)) {
        error.notFatal = true;
        error.backoffDelay = 1000;
      }

      if(
        ['buy', 'sell'].includes(method) &&
        error.message.includes('Insufficient funds')
      ) {
        error.retry = 10;
      }

      return next(error);
    }

    return next(undefined, body);
  }
}

Trader.prototype.getPortfolio = function(callback) {
};

Trader.prototype.getTicker = function(callback) {
};

Trader.prototype.getFee = function(callback) {
  // const fee = this.asset == 'BTC' ? 0.0025 : 0.003;
  const fee = 0;

  //There is no maker fee, not sure if we need taker fee here
  //If post only is enabled, gdax only does maker trades which are free
  callback(undefined, this.post_only ? 0 : fee);
};

Trader.prototype.roundPrice = function(price) {
  return this.getMaxDecimalsNumber(price, this.currency == 'BTC' ? 5 : 2);
}

Trader.prototype.roundAmount = function(amount) {
  return this.getMaxDecimalsNumber(amount);
}

Trader.prototype.buy = function(amount, price, callback) {
};

Trader.prototype.sell = function(amount, price, callback) {
};

Trader.prototype.checkOrder = function(order, callback) {
};

Trader.prototype.getOrder = function(order, callback) {
};

Trader.prototype.cancelOrder = function(order, callback) {
};

Trader.prototype.getTrades = function(since, callback, descending) {
};

Trader.prototype.getMaxDecimalsNumber = function(number, decimalLimit = 8) {
  var decimalNumber = parseFloat(number);

  // The ^-?\d*\. strips off any sign, integer portion, and decimal point
  // leaving only the decimal fraction.
  // The 0+$ strips off any trailing zeroes.
  var decimalCount = (+decimalNumber).toString().replace(/^-?\d*\.?|0+$/g, '')
    .length;

  var decimalMultiplier = 1;
  for (i = 0; i < decimalLimit; i++) {
    decimalMultiplier *= 10;
  }

  return decimalCount <= decimalLimit
    ? decimalNumber.toString()
    : (
        Math.floor(decimalNumber * decimalMultiplier) / decimalMultiplier
      ).toFixed(decimalLimit);
};

Trader.getCapabilities = function() {
  return {
    name: 'GEMINI',
    slug: 'gemini',
    currencies: marketData.currencies,
    assets: marketData.assets,
    markets: marketData.markets,
    requires: ['key', 'secret', 'passphrase'],
    providesHistory: 'date',
    providesFullHistory: false,
    tid: 'tid',
    tradable: true,
    forceReorderDelay: false,
    gekkoBroker: 0.6
  };
};

module.exports = Trader;
