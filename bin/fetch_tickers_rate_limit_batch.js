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
  , Ticker = require('librlsepp').Ticker
  , Tickers = require('librlsepp/js/lib/spread').Tickers
  , IxDictionary = require('librlsepp/js/lib/ixdictionary')
  , Storable = require('librlsepp/js/lib/storable').Storable
;

const logger = log4js.getLogger('file');
let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async function main() {

  let opt = stdio.getopt({
  })
  let exchanges = []
  if (opt.args && opt.args.length > 0) {
    exchanges = opt.args
  } else {
    exchanges = config.get('exchanges')
  }

  logger.info("initialzing "+exchanges.join(" "))

  const rl = Rlsepp.getInstance();
  await rl.initStorable()
  await rl.initAsync(exchanges, {enableRateLimit: true, fetchTickerMethod: 'fetchTickerV2', fetchMarketsMethod:'fetch_markets_from_api'})

  let dbTickers = rl.tickerByExchange
    //await rl.storable.retrieve(null, 'tickers')

  // of all ticker symbols ccxt market data knows about
  // cross reference with whats in the database 
  // filling in epoch as missing datetimes
  //
  let shuffle = []
  exchanges.map(name => {
    rl.exchangeMarketSymbols(name).map(s => {

      if (dbTickers.has(name) && dbTickers[name].has(s))
        shuffle.push({sort: Math.random(), value: dbTickers[name][s]})
      else 
        shuffle.push({sort: Math.random(), value: new Ticker({symbol: s, exchange: name, datetime: new moment("1970-01-01T00:00:00Z").format()})})
    })
  })
  let r = shuffle.sort((a, b) => a.sort - b.sort)
    .map((a) => a.value)

  let tickers = new Tickers(r)
  let nPerE = new IxDictionary()
  tickers.keys().map( name => {
    let s = tickers[name].size 
    if (s > 512)
      nPerE[name] = 32
    else if (s < 25)
      nPerE[name] = 5
    else
      nPerE[name] = s/10
  })

  let now = new moment()
  do {
    //  sort ascending by datetime
    //  slice N tickers off at a time
    //  fetch from api, store in database
    //
    let promises = []

    let stats = [0, []]
    for (let e of tickers.keys()) {
      let tickersOfE = tickers[e].keys()

      tickersOfE.sort ((a,b) => ((tickers[e][a].datetime < tickers[e][b].datetime) 
        ? -1 : (tickers[e][a].datetime > tickers[e][b].datetime) ? 1 : 0))

      let batchKeys = tickersOfE.splice(0,nPerE[e])
      let batch = tickers[e].splice(batchKeys).values()

      //  yobit etc.. need a list for the call argument # limit
      //
      if (rl.get(e).ccxt.has['fetchTickers'] == true) {
        if (batch.length > 0) {
          stats[0]++
          stats[1].push(batch.length)
          let p = rl.apiFetchTickers(e, batchKeys)
          promises.push(p);
        } else {
          tickers.remove(e)
          logger.info(`completed fetch/store of ${e} tickers`)
        }
      } else  {
        if (batch.length > 0) {
          stats[0]++
          stats[1].push(batch.length)
          let p = rl.fetchTickers(e, batchKeys)
          promises.push(p);
        } else {
          tickers.remove(e)
          logger.info(`completed fetch/store of ${e} tickers`)
        }
      }
    }

    log("waiting on call count "+stats[0]+" representing "+stats[1] )
    let fetched = new Tickers()
    let data = await Promise.all(promises)
      .then(resolved => {
        resolved.map(silo => fetched.merge(silo))
      })
      .catch(error => logger.error(error))
    
    let then = new moment()
    log('seconds taken: '+moment.duration(then.diff(now)).as('seconds'))

    for (let name in fetched) {
      let [count,stored,remain] = [0,0,0]
      for (let ticker of fetched[name]) {
        count++;
        if (ticker.stored) stored++
        remain = tickers[name].size
      }
      log(`fetched ${count} ticker symbols, stored ${stored} from ${name}, ${remain} remain`)

    }
    await sleep(5)
  } while (tickers.size > 0)
})().then().catch(e => logger.error(e))
