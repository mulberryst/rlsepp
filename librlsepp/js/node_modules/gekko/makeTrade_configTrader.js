const util = require(__dirname + '/core/util');
const dirs = util.dirs();

const _ = require('lodash');
const events = require('events');
const moment = require('moment');
//const orders = require('./orders');
//const Trigger = require('./trigger');
//const exchangeUtils = require('./exchangeUtils');
//const bindAll = exchangeUtils.bindAll;
const log = require(dirs.core + 'log');
const Broker = require(dirs.broker + 'gekkoBroker');
const Trader = require(dirs.plugins + 'trader/trader');
const JSON = require('JSON');

//const Trader = require(__dirname  + '/exchange/wrappers/gdax');

require('./exchange/dependencyCheck');

//globals
const config = util.getConfig();


//@INC = require.main.paths

//cache.set("test", require("moment"));
//console.log("moment: "+util.inspect(cache.get("test"),{showHidden: false, depth: null}));

//const m = require(dirs.plugins +'apiKeyManager');
//const creds = m._getApiKeyPair(config.watch.exchange);

log.debug("node version :"+util.getRequiredNodeVersion());
//todo, override Trader constructor for config.trader to use creds
//console.log(u.inspect(creds, {showHidden: false, depth: null}));

const adviceMock = {
	recommendation: 'long',
									id: '1',
	confidence: 0.2,
}


var trader = null;
//main
(async function main() {
  trader = await Trader.createInitAsync(() => {}, config.watch.exchange, config.trader);

  var beginEventLoop = false;
  trader.on('postInit', () => {
    console.log('\tGekko v' + util.getVersion() + " using exchange " + config.watch.exchange);
    //	console.log("market config: "+JSON.stringify(trader.broker.marketConfig));
    //	console.log("capabilities: "+JSON.stringify(trader.broker.capabilities));

    //	console.log(trader.broker.capabilities);
    //  trader.processAdvice(adviceMock);
    beginEventLoop = true;
  });

  // TODO: verify the right object has the right listener...
  //   not capturing these events
  //
  //  trader.broker.createOrder(type, side, amount);
  trader.on('triggerAborted', (ev) => {
    log.info('triggerAborted: '+JSON.stringify(ev)) });
  trader.on('triggerCreated', (ev) => {
    log.info('triggerCreated: '+JSON.stringify(ev)) });
  trader.on('triggerFired', (ev) => {
    log.info('triggerFired: '+JSON.stringify(ev)) });

  trader.on('portfolioChange', (ev) => {
    log.info('portfolioChange: ' +JSON.stringify(ev)) });
  trader.on('portfolioValueChange', (ev) => {
    log.info('portfolioValueChange: '+ JSON.stringify(ev)) });

  trader.on('tradeCancelled', (ev) => {
    log.info('tradeCancelled: '+JSON.stringify(ev)) });

  trader.on('tradeCompleted', (ev) => {
    log.info('tradeCompleted: '+JSON.stringify(ev)) });

  trader.on('tradeInitiated', (ev) => {
    log.info('tradeInitiated: '+JSON.stringify(ev)) });

  trader.on('tradeErrored', (ev) => {
    log.info('tradeErrored:' +JSON.stringify(ev)) });



  trader.on('tradeAborted', (data) => {
    log.info("trade aborted: "+ data.id + " reason: "+data.reason);
  });

  (function wait () {
    if (beginEventLoop)
      trader.broadcastDeferredEmit();
    setTimeout(wait, 50);
  })();

})()
