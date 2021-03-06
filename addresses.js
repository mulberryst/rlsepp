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

;

const FILE = "addresses.json"
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
  let wallets = {};
  for (let [name, ex] of rl.e.entries()) {
    let wallet = {};
    let a = {}
    for(let asset of rl.e.commodity.keys())  {
      logger.info('checking asset'+asset)
      try {
        var data = await RLSEPP.fetch_create_deposit_address(ex,asset)
        a[asset] = data.address

        wallet['deposit'] = a;
      } catch(e) {
        logger.error("\t\""+asset+"\": ", '{},');
      };
    }
    wallets[name] = wallet;
  }
  fs.writeFile(FILE, JSON.stringify(wallets, null, 2), err => {
    if (err) 
      logger.error(err);
  }); 
})()
