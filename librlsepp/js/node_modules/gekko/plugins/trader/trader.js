const _ = require('lodash');
const util = require('../../core/util.js');
const dirs = util.dirs();
const moment = require('moment');
const emitter = require('../../core/emitterClass.js');

const log = require(dirs.core + 'log');
//const Broker = require(dirs.broker + 'gekkoBroker');
const BrokerFactory = require(dirs.broker + 'brokerFactory').BrokerFactory;


require(dirs.gekko + '/exchange/dependencyCheck');


var _instances;
class Trader extends emitter.GekkoEventEmitter {
  static create() {
    const args = [].slice.apply(arguments);
    let self = new Trader(args);
    return self;
  }
  static async createInitAsync() {
    const args = [].slice.apply(arguments);
    var self = Trader.create(args);
    try {
      await self.initAsync()
    } catch (e) {
      log.error("Trader.createInitAsync ",e);
    }   
    return self;
  }

  constructor (PpostSyncCB, exchangeName, Pconfig) {
    super();
    _.bindAll(this);
    if (Pconfig != null)
      this.config = Pconfig;
    else
      this.config = util.getConfig()

    var traderConfig = this.config.trader;
    var watchConfig = this.config.watch;
    if (_.has(this.config.multitrader, exchangeName)) {
      traderConfig = this.config.multitrader[exchangeName];
    }
    if (_.has(this.config.multiwatch,exchangeName)) {
      watchConfig = this.config.multiwatch[exchangeName];
    }
    //TODO: make collection keyed by exchange/wrapper/this.name
    this.brokerConfig = {
      ...traderConfig,
      ...watchConfig,
      private: true
    }

    this.propogatedTrades = 0;
    this.propogatedTriggers = 0;

    this.cancellingOrder = false;
    this.sendInitialPortfolio = false;
    if (PpostSyncCB instanceof Function)
      this.postSyncCB = PpostSyncCB;
    else
      this.postSyncCB = () => {};
    this.exposed = false;
    this.exchangeName = exchangeName;
    this.currency = this.brokerConfig.currency.toUpperCase(); 
    this.asset = this.brokerConfig.asset.toUpperCase(); 
  }
  market() {
    return this.brokerConfig.currency.toUpperCase() + this.brokerConfig.asset.toUpperCase();
  }

  async initAsync () {
    //TODO: see config comment
    try {
      this.broker = await BrokerFactory.create(this.brokerConfig);
    } catch(e) {
      util.die(e.message);
    }

    if(!this.broker.capabilities.gekkoBroker) {
      util.die('This exchange is not yet supported');
    }

    console.log("new trader ", this.brokerConfig);
    setInterval(this.sync, 1000 * 60 * 10);

    this.sync ( () =>  {
      log.info('\t', 'Portfolio:');
      log.info('\t\t', this.portfolio.currency, this.brokerConfig.currency);
      log.info('\t\t', this.portfolio.asset, this.brokerConfig.asset);
      log.info('\t', 'Balance:');
      log.info('\t\t', this.balance, this.brokerConfig.currency);
      log.info('\t', 'Exposed:');
      log.info('\t\t',
        this.exposed ? 'yes' : 'no',
        `(${(this.exposure * 100).toFixed(2)}%)`
      );
      this.postSyncCB();
      this.emit('postInit');
    });
  }

  sync(PpostCB) {
    log.debug('syncing private data');
    this.broker.syncPrivateData(() => {
      if(!this.price) {
        this.price = this.broker.ticker.bid;
      }

      const oldPortfolio = this.portfolio;

      this.setPortfolio();
      this.setBalance();

      if(this.sendInitialPortfolio && !_.isEqual(oldPortfolio, this.portfolio)) {
        this.relayPortfolioChange();
      }

      // balance is relayed every minute
      // no need to do it here.

      if(PpostCB) {
        PpostCB()
      }
    });
    this.deferredEmit('postInit', { });
  }

  relayPortfolioChange () {
    this.deferredEmit('portfolioChange', {
      asset: this.portfolio.asset,
      currency: this.portfolio.currency
    });
  }

  relayPortfolioValueChange () {
    this.deferredEmit('portfolioValueChange', {
      balance: this.balance
    });
  }

  setPortfolio() {
    this.portfolio = {
      currency: _.find(
        this.broker.portfolio.balances,
        b => b.name === this.brokerConfig.currency
      ).amount,
      asset: _.find(
        this.broker.portfolio.balances,
        b => b.name === this.brokerConfig.asset
      ).amount
    }
  }

  setBalance() {
    this.balance = this.portfolio.currency + this.portfolio.asset * this.price;
    this.exposure = (this.portfolio.asset * this.price) / this.balance;
    // if more than 10% of balance is in asset we are exposed
    this.exposed = this.exposure > 0.95;
  }

  processCandle(candle, done) {
    this.price = candle.close;
    const previousBalance = this.balance;
    this.setPortfolio();
    this.setBalance();

    if(!this.sendInitialPortfolio) {
      this.sendInitialPortfolio = true;
      this.deferredEmit('portfolioChange', {
        asset: this.portfolio.asset,
        currency: this.portfolio.currency
      });
    }

    if(this.balance !== previousBalance) {
      // this can happen because:
      // A) the price moved and we have > 0 asset
      // B) portfolio got changed
      this.relayPortfolioValueChange();
    }

    done();
  }

  processAdvice(advice) {
    let direction;

    if(advice.recommendation === 'long') {
      direction = 'buy';
    } else if(advice.recommendation === 'short') {
      direction = 'sell';
    } else {
      log.error('ignoring advice in unknown direction');
      return;
    }

    const id = 'trade-' + (++this.propogatedTrades);

    if(this.order && this.order.initialized) {
      if(this.order.side === direction) {
        return log.info('ignoring advice: already in the process to', direction);
      }

      if(this.cancellingOrder) {
        return log.info('ignoring advice: already cancelling previous', this.order.side, 'order');
      }

      log.info('Received advice to', direction, 'however Gekko is already in the process to', this.order.side);
      log.info('Canceling', this.order.side, 'order first');
      return this.cancelOrder(id, advice, () => this.processAdvice(advice));
    }

    let amount;
    let confidence = advice.confidence;
    //look at math.max for bounds

    if(direction === 'buy') {
      //(this.exposure * 100).toFixed(2)
      if(this.exposed) {
        log.info('NOT buying, already exposed');
        return this.deferredEmit('tradeAborted', {
          id,
          adviceId: advice.id,
          action: direction,
          portfolio: this.portfolio,
          balance: this.balance,
          reason: "Portfolio already in position."
        });
      }

      amount = this.portfolio.currency / this.price * 0.95 * confidence;

      if (amount < this.broker.marketConfig.minimalOrder.amount) {
        /*
         return this.deferredEmit('tradeAborted', {
         id,
adviceId: advice.id,
action: direction,
portfolio: this.portfolio,
balance: this.balance,
reason: "Amount doesn't exceed minimal order."
});
*/
        console.log("no confidence "+amount);
        return;
      }

      log.info(
        'Trader',
        'Received advice to go long.',
        'Buying ', amount, this.brokerConfig.asset,
        'Total Currency ', this.portfolio.currency,
        'Price ', this.price,
      );

    } else if(direction === 'sell') {

      if(!this.exposed) {
        log.info('NOT selling, already no exposure');
        return this.deferredEmit('tradeAborted', {
          id,
          adviceId: advice.id,
          action: direction,
          portfolio: this.portfolio,
          balance: this.balance,
          reason: "Portfolio already in position."
        });
      }

      // clean up potential old stop trigger
      if(this.activeStopTrigger) {
        this.deferredEmit('triggerAborted', {
          id: this.activeStopTrigger.id,
          date: advice.date
        });

        this.activeStopTrigger.instance.cancel();

        delete this.activeStopTrigger;
      }

      amount = this.portfolio.asset;

      log.info(
        'Trader',
        'Received advice to go short.',
        'Selling ', this.brokerConfig.asset
      );
    }

    this.createOrder(direction, amount, advice, id);
  }

  createOrder(side, amount, advice, id) {
    const type = 'sticky';

    // NOTE: this is the best check we can do at this point
    // with the best price we have. The order won't be actually
    // created with this.price, but it should be close enough to
    // catch non standard errors (lot size, price filter) on
    // exchanges that have them.
    const check = this.broker.isValidOrder(amount, this.price);

    if(!check.valid) {
      log.warn('NOT creating order! Reason:', check.reason);
      return this.deferredEmit('tradeAborted', {
        id,
        adviceId: advice.id,
        action: side,
        portfolio: this.portfolio,
        balance: this.balance,
        reason: check.reason
      });
    }

    log.debug('Creating order to', side, amount, this.brokerConfig.asset);

    this.deferredEmit('tradeInitiated', {
      id,
      adviceId: advice.id,
      action: side,
      portfolio: this.portfolio,
      balance: this.balance
    });

    this.order = this.broker.createOrder(type, side, amount);

    this.order.on('fill', f => log.info('[ORDER] partial', side, 'fill, total filled:', f));
    this.order.on('statusChange', s => log.debug('[ORDER] statusChange:', s));

    this.order.on('error', e => {
      log.error('[ORDER] Gekko received error from GB:', e.message);
      log.debug(e);
      this.order = null;
      this.cancellingOrder = false;

      this.deferredEmit('tradeErrored', {
        id,
        adviceId: advice.id,
        date: moment(),
        reason: e.message
      });

    });
    this.order.on('completed', () => {
      this.order.createSummary((err, summary) => {
        if(!err && !summary) {
          err = new Error('GB returned an empty summary.')
        }

        if(err) {
          log.error('Error while creating summary:', err);
          return this.deferredEmit('tradeErrored', {
            id,
            adviceId: advice.id,
            date: moment(),
            reason: err.message
          });
        }

        log.info('[ORDER] summary:', summary);
        this.order = null;
        this.sync(() => {

          let cost;
          if(_.isNumber(summary.feePercent)) {
            cost = summary.feePercent / 100 * summary.amount * summary.price;
          }

          let effectivePrice;
          if(_.isNumber(summary.feePercent)) {
            if(side === 'buy') {
              effectivePrice = summary.price * (1 + summary.feePercent / 100);
            } else {
              effectivePrice = summary.price * (1 - summary.feePercent / 100);
            }
          } else {
            log.warn('WARNING: exchange did not provide fee information, assuming no fees..');
            effectivePrice = summary.price;
          }

          this.deferredEmit('tradeCompleted', {
            id,
            adviceId: advice.id,
            action: summary.side,
            cost,
            amount: summary.amount,
            price: summary.price,
            portfolio: this.portfolio,
            balance: this.balance,
            date: summary.date,
            feePercent: summary.feePercent,
            effectivePrice
          });

          if(
            side === 'buy' &&
            advice.trigger &&
            advice.trigger.type === 'trailingStop'
          ) {
            const trigger = advice.trigger;
            const triggerId = 'trigger-' + (++this.propogatedTriggers);

            this.deferredEmit('triggerCreated', {
              id: triggerId,
              at: advice.date,
              type: 'trailingStop',
              properties: {
                trail: trigger.trailValue,
                initialPrice: summary.price,
              }
            });

            log.info(`Creating trailingStop trigger "${triggerId}"! Properties:`);
            log.info(`\tInitial price: ${summary.price}`);
            log.info(`\tTrail of: ${trigger.trailValue}`);

            this.activeStopTrigger = {
              id: triggerId,
              adviceId: advice.id,
              instance: this.broker.createTrigger({
                type: 'trailingStop',
                onTrigger: this.onStopTrigger,
                props: {
                  trail: trigger.trailValue,
                  initialPrice: summary.price,
                }
              })
            }
          }
        });
      })
    });
  }

  onStopTrigger(price) {
    log.info(`TrailingStop trigger "${this.activeStopTrigger.id}" fired! Observed price was ${price}`);

    this.deferredEmit('triggerFired', {
      id: this.activeStopTrigger.id,
      date: moment()
    });

    const adviceMock = {
      recommendation: 'short',
      id: this.activeStopTrigger.adviceId
    }

    delete this.activeStopTrigger;

    this.processAdvice(adviceMock);
  }

  cancelOrder(id, advice, next) {

    if(!this.order) {
      return next();
    }

    this.cancellingOrder = true;

    this.order.removeAllListeners();
    this.order.cancel();
    this.order.once('completed', () => {
      this.order = null;
      this.cancellingOrder = false;
      this.deferredEmit('tradeCancelled', {
        id,
        adviceId: advice.id,
        date: moment()
      });
      this.sync(next);
    });
  }

}

Object.setPrototypeOf(Trader.prototype, emitter.GekkoEventEmitter.prototype);
module.exports = Trader
//module.exports = { Trader: Trader }
