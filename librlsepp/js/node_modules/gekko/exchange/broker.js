/*
  The broker manages all communicatinn with the exchange, delegating:

  - the management of the portfolio to the portfolioManager
  - the management of actual trades to "orders".
*/

const _ = require('lodash')
  , async = require('async')
  , events = require('events')
  , moment = require('moment')
  , checker = require('./exchangeChecker')
  , errors = require('./exchangeErrors')
  , Portfolio = require('./portfolioManager')
  , orders = require('./orders')
  , Trigger = require('./trigger')
  , exchangeUtils = require('./exchangeUtils')
  , bindAll = exchangeUtils.bindAll
  , isValidOrder = exchangeUtils.isValidOrder
;



class Broker {
  constructor(config) {
    this.config = config;

    this.orders = {
      // contains current open orders
      open: [],
      // contains all closed orders
      closed: []
    }

    const slug = config.exchange.toLowerCase();

    console.log('new broker config with '+slug);

    const API = require('./wrappers/' + slug);

    this.api = new API(config);

    this.capabilities = API.getCapabilities();

    if (config.currency == null)
      config.currency = _.first(_.first(this.capabilities.markets).pair).toUpperCase() 
    if (config.asset == null)
      config.asset = _.last(_.first(this.capabilities.markets).pair).toUpperCase() 
    this.exchange = config.exchange;
    this.currency = config.currency;
    this.asset = config.asset;

    this.marketConfig = _.find(this.capabilities.markets, (p) => {
      return _.first(p.pair) === config.currency.toUpperCase() &&
        _.last(p.pair) === config.asset.toUpperCase();
    });


    if(config.private) {
      if(this.cantTrade()) {
        throw new Error(this.cantTrade());
      }
    } else {
      if(this.cantMonitor()) {
        throw new Error(this.cantMonitor());
      }
    }

    if(config.customInterval) {
      this.interval = config.customInterval;
      this.api.interval = config.customInterval;
      console.log(new Date, '[GB] setting custom interval to', config.customInterval);
    } else {
      this.interval = this.api.interval || 1500;
    }

    this.market = config.currency.toUpperCase() + config.asset.toUpperCase();

    if(config.private) {
      this.portfolio = new Portfolio(config, this.api);
    }

    bindAll(this);
  }

  cantTrade() {
    return checker.cantTrade(this.config);
  }

  cantMonitor() {
    return;
    return checker.cantMonitor(this.config);
  }

  sync(callback) {
    if(!this.private) {
      this.setTicker();
      return;
    }

    if(this.cantTrade()) {
      throw new errors.ExchangeError(this.cantTrade());
    }

    this.syncPrivateData();
  }

  syncPrivateData(callback) {
    async.series([
      this.setTicker,
      next => setTimeout(next, this.interval),
      this.portfolio.setFee.bind(this.portfolio),
      next => setTimeout(next, this.interval),
      this.portfolio.setBalances.bind(this.portfolio),
      next => setTimeout(next, this.interval)
    ], callback);
  }

  setTicker(callback) {
    this.api.getTicker((err, ticker) => {

      if(err) {
        if(err.message) {
          console.log(this.api.name, err.message);
          throw err;
        } else {
          console.log('err not wrapped in error:', err);
          throw new errors.ExchangeError(err);
        }
      }

      this.ticker = ticker;

      if(_.isFunction(callback))
        callback();
    });
  }

  isValidOrder(market,amount, price) {
    return isValidOrder({
      market: market,
      api: this.api,
      amount,
      price
    });
  }

  createOrder(market,type, side, amount, parameters, handler) {
    if(!this.config.private)
      throw new Error('Client not authenticated');

    if(side !== 'buy' && side !== 'sell')
      throw new Error('Unknown side ' + side);

    if(!orders[type])
      throw new Error('Unknown order type');

    const order = new orders[type]({
      api: this.api,
      marketConfig: market,
      capabilities: this.capabilities
    });

    // todo: figure out a smarter generic way
    this.syncPrivateData(() => {
      order.setData({
        balances: this.portfolio.balances,
        ticker: this.ticker,
      });

      order.create(side, amount, parameters);
    });

    order.on('completed', summary => {
      _.remove(this.orders.open, order);
      this.orders.closed.push(summary);
    });

    return order;
  }

  createTrigger({type, onTrigger, props}) {
    return new Trigger({
      api: this.api,
      type,
      onTrigger,
      props
    });
  }
}

module.exports = Broker;
