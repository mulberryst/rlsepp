const util = require(__dirname + '/core/util')
  , dirs = util.dirs()
  , _ = require('lodash')
  , events = require('events')
  , moment = require('moment')
  , log = require(dirs.core + 'log')
  , PipelineFactory = require(dirs.core + 'pipelineFactory').PipelineFactory
  , BrokerFactory = require(dirs.broker + 'brokerFactory').BrokerFactory
  , Broker = require(dirs.broker + 'brokerFactory').Broker
  , Trader = require(dirs.plugins + 'trader/trader')
  , Checker = require(dirs.broker + 'exchangeChecker')
  , JSON = require('JSON')
  , async = require('async')

require('./exchange/dependencyCheck');

/*
 *  depends on exchange market-data being current, not entirely dynamic
 */

//globals
const config = util.getConfig();
const mode = util.gekkoMode();
var adapter = config[config.adapter];


let beginEventLoop = false;


if (_.has(config, 'multiwatch')) {
  log.debug("has configured exchanges: "+JSON.stringify(config.multiwatch));
}

//exchange/util/genMarketFiles

var pipes = [];

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}

function initPipes(broker) {
  try {
    const result = _.map(
      broker.capabilities.markets,
      function(o) {
        let currency = o.pair[0];
        let asset = o.pair[1];
        let ex = broker.exchange;
        var mc = {...config};
        //var mc = config;
        if (_.has(mc,'multitrader.'+ex))
          mc.trader = mc.multitrader[ex]

        mc.watchKey = ex+currency+asset;
//        mc.broker = broker;

        mc.trader = {
          enabled: false,
          key: '',
          secret: '',
          username: '',
          passphrase: '',
        };
        mc.watch = {
          exchange: ex,
          currency: currency,
          asset: asset,
        };
//        mc.candleWriter.market = mc.market;
        mc.candleWriter.asset = asset;
        mc.candleWriter.currency = currency;
        mc.candleWriter.exchange = ex;
        var merge = {
          market: mc.market,
          asset: asset,
          currency: currency,
          exchange: ex,
        };
        Object.assign(mc.PGAdapter, merge);
        /*
        if (!_.has(config,'multiwatch.'+ mc.watchKey))
          config.multiwatch[config.watchKey] = {
            exchange: ex,
            currency: currency,
            asset: asset,
          };
        if (!_.has(mc,'multiwatch.'+ mc.watchKey))
          mc.multiwatch[mc.watchKey] = {
            exchange: ex,
            currency: currency,
            asset: asset,
          };
          */
        var pipe = PipelineFactory.createInit({ config: mc, mode: mode });
        pipes.push(pipe);
      }
    );
    broker.capabilities.markets = _.compact(result);
  } catch (e) {
    console.log(e.fullStack)
    util.die(e, false);
  };
}

//Object.keys(config.multiwatch).forEach((ex) => { 

(async function main() {
  const result = await Promise.all(_.map(
    Object.keys(config.multitrader),
    async (ex) => {
      var broker = null;

      let conf = {
        ...config.multitrader[ex],
        exchange: ex,
        private: true
      };
      //broker still needs to be initialized with a pair
      let cap = Checker.getExchangeCapabilities(ex);
      conf.currency = _.first(_.first(cap.markets).pair).toUpperCase() 
      conf.asset = _.last(_.first(cap.markets).pair).toUpperCase() 
      try {
        broker = await BrokerFactory.create(conf);
      } catch(e) {
        util.die(e,false);
      };
      log.info("Initializing gekko broker for "+ex);
//      log.info('assets:' + JSON.stringify(broker.capabilities.assets));
//      log.info('currencies: '+JSON.stringify(broker.capabilities.currencies));
      try {
        const na = initPipes( broker );
      } catch(e) {
        util.die(e, false);
      }
      log.debug('created pipelines');
    }
  )
  );

})();
