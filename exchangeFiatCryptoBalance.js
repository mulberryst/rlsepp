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
const Trader = require(dirs.plugins + 'trader/trader').Trader;
const JSON = require('JSON');

//const Trader = require(__dirname  + '/exchange/wrappers/gdax');

require('./exchange/dependencyCheck');

//globals
const config = util.getConfig();

//main
var trader = new Trader(() => {});

trader.init();
