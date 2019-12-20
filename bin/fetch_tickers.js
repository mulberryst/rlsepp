'use strict';
process.env.NODE_ENV='public'
const config = require('config')
  , stdio = require('stdio')
  , fs = require("mz/fs")
  , path = require('path')
  , util = require('util')
  , moment = require('moment')
  , JSON = require('JSON')
  , log = require ('ololog')
  , log4js = require('log4js')
  , Rlsepp = require('librlsepp').Rlsepp
  , Tickers = require('librlsepp/js/lib/spread').Tickers
;

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

const logger = log4js.getLogger('file');

;(async function main() {

  let opt = stdio.getopt({
  })
  let exchanges = config.get('exchanges')
  if (opt.args && opt.args.length > 0)
    exchanges = opt.args

  const rl = Rlsepp.getInstance();
  await rl.initStorable()
  await rl.initAsync(exchanges, {enableRateLimit: true})

  let now = new moment()
  logger.info('fetching/storing tickers from ['+exchanges.join('|')+']')

  let promises = exchanges.map(exchange => rl.apiFetchTickers(exchange))
  let result = await Promise.all(promises)
  let tickers = new Tickers()

  result.map(e => tickers.merge(e))
//  log(JSON.stringify(tickers,null,4))

  for (let name in tickers) {
    let [count,stored] = [0,0]
    for (let ticker of tickers[name]) {
      count++;
      if (ticker.stored)
        stored++
    }
    logger.info(`fetched ${count} ticker symbols, stored ${stored} from ${name}`)

    //  var tickerFile = fs.createWriteStream('.tickers.json', { flags: 'w' });
    //    tickerFile.write( JSON.stringify(tickers, null, 4) )
  }
  let then = new moment()
  logger.info(' time taken '+moment.duration(now.diff(then)).as('seconds')+' seconds')
/*  
  let listAC = rl.arbitrableCommodities(['USDT'])
  let table = await rl.fetchArbitrableTickers(listAC, ['USD', 'BTC', 'ETH'])
*/
})().then().catch(e => logger.error(e))
