'use strict';
const config = require('config')
  , RLSEPP = require('./librlsepp/js/lib/rlsepp').Rlsepp
  , verbose = process.argv.includes('--verbose')
  , debug = process.argv.includes('--debug')
  , fs = require("fs")
  , path = require('path')
  , util = require('util')
  , log4js = require('log4js')
  , moment = require('moment')
;
const logger = log4js.getLogger();
logger.level = 'debug';

var filename = path.basename(__filename);

/*
Map.prototype.toJSON = function () {
    var obj = {}
    for(let [key, value] of this)
        obj[key] = (value instanceof Map) ? Map.toJSON(value) : value;

    return obj
}
*/
// gemini : "result":"error","reason":"CryptoAddressWhitelistsNotEnabled","message":"Cryptocurrency withdrawal address whitelists are not enabled for account 908793.  Please contact support@gemini.com for information on setting up a withdrawal address whitelist."} (possible reasons: invalid API keys, bad or old nonce, exchange is down or offline, on maintenance, DDoS protection, rate-limiting)

//let srcAddress = config.withdraw.gdax.ETH.address
//let destAddress = config.withdraw.gemini.ETH.address;
//let destAddress ="0x0D78B665bEe557D0Cfb1268A0C88EFF80Ea9B77A" //gemini ETH deposit
let destAddress = "MRXYwi1pv8Xtz65BXLZK5Nrfox4wgozjGA"; //gdax LTC deposit
//let amount = 0.00040481;
let amount = 1.37039
logger.info(filename + " BEGIN ");
(async function main() {
  const rl = new RLSEPP();
  var apiCreds = config.get('gekko.multitrader');
  await rl.initAsync(apiCreds, {verbose});

  let b = await rl.fetchBalances(['binance', 'gemini']);
//  logger.info(util.inspect(b));

  for (let e of b) {
    let name = e.name
    let eAPI = e.eAPI
//    logger.info(util.inspect(eAPI['LTC']))
    //free, used, total
    if (typeof eAPI['LTC'] !== 'undefined') 
      logger.info("pre move, we have : "+eAPI['LTC']['total']+ " LTC in "+name)
  }


  try {
    await rl.showBalances()
  } catch(e) {
    logger.error(e)
  };
  try {
    const r = await rl.moveMoneyAsync('LTC', 1.37039, 'gemini', 'yobit')
    logger.info(r)
  } catch(e) {
    logger.error(e)
  };


//  while

  //  loop over show balances until the money shows up
  //  keep track of timings
  //  calculate fees locally anyway
  //

})()
