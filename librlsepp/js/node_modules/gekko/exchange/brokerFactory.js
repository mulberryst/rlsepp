const _ = require('lodash');
const async = require('async');
const events = require('events');
const moment = require('moment');
const checker = require('./exchangeChecker');
const errors = require('./exchangeErrors');
const Portfolio = require('./portfolioManager');
// const Market = require('./market');
const orders = require('./orders');
const Trigger = require('./trigger');
const exchangeUtils = require('./exchangeUtils');
const bindAll = exchangeUtils.bindAll;
const isValidOrder = exchangeUtils.isValidOrder;
const Broker = require('./broker');

var _connCache = {};
class BrokerFactory {
  static async create(settings) {
    let exchange = settings.exchange.toLowerCase();
    let self = _connCache[exchange];
    //    _.has(_connCache, market)) {

    /*
    if (self != null)
      return self;
      */

    try {
      self = new Broker(await Promise.resolve(settings));

    } catch (e) {
      e.trace="BrokerFactory.create";
      throw(e);
    }
    return self;
  }
}

module.exports = {
  BrokerFactory: BrokerFactory,
  Broker: Broker
}
