'use strict';
const config = require('config')
  , RLSEPP = require('./librlsepp/js/lib/rlsepp').Rlsepp
  , verbose = process.argv.includes('--verbose')
  , debug = process.argv.includes('--debug')
  , fs = require("fs")
  , path = require('path')
  , util = require('util')
  , log4js = require('log4js')
  , Dictionary = require("dictionaryjs").Dictionary
  , version = require("./librlsepp/js/lib/gekko")
  , mode = require("./librlsepp/js/lib/gekko")
  , gconfig = require("./librlsepp/js/lib/gekko")
  , gutil = require("./librlsepp/js/lib/gekko")
  , dirs = require("./librlsepp/js/lib/gekko")
  , log = require("./librlsepp/js/lib/gekko")
  , PipelineFactory = require("./librlsepp/js/lib/gekko")
  , BrokerFactory = require("./librlsepp/js/lib/gekko")
  , Broker = require("./librlsepp/js/lib/gekko")
  , Trader = require("./librlsepp/js/lib/gekko")
  , Checker = require("./librlsepp/js/lib/gekko")
;

const config = util.getConfig();
const mode = util.gekkoMode();


const logger = log4js.getLogger('screen')
logger.level = 'debug';

var filename = path.basename(__filename);

(async function main() {
  const rl = new RLSEPP();
  var apiCreds = config.get('gekko.multitrader');
  try {
    await rl.init(apiCreds, {verbose});
  } catch(e) {
    logger.error(e)
  };

})()
