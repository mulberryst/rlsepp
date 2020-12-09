'use strict';
process.env.NODE_ENV='public'
const config = require('config')
  , fs = require("mz/fs")
  , path = require('path')
  , util = require('util')
  , moment = require('moment')
  , JSON = require('JSON')
  , log = require ('ololog')
  , log4js = require('log4js')
  , Rlsepp = require('librlsepp').Rlsepp
  , Tickers = require('librlsepp/js/lib/spread').Tickers
  , Getopt = require('node-getopt')
;

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

const logger = log4js.getLogger('file');

let getopt = new Getopt([
  ['h' , 'help'                , 'display this help'],
  ['n', 'n=ARG', 'n symbols per call'],
]);              // create Getopt instance
//.bindHelp()     // bind option 'help' to default action

// Use custom help template instead of default help
// [[OPTIONS]] is the placeholder for options list
getopt.setHelp(
  "Usage: node help.js [OPTION]\n" +
  "node-getopt help demo.\n" +
  "\n" +
  "[[OPTIONS]]\n" +
  "\n" +
  "Installation: npm install node-getopt\n" +
  "Respository:  https://github.com/jiangmiao/node-getopt"
);



;(async function main() {

  let opt = getopt.parse(process.argv.slice(2));
  //  console.info({argv: opt.argv, options: opt.options});
  log(opt.options)

  let exchanges = config.get('exchanges')
  if (opt.argv && opt.argv.length > 0)
    exchanges = opt.argv

  const rl = Rlsepp.getInstance();
  await rl.initStorable()
  await rl.initAsync(exchanges, {enableRateLimit: true})

  let now = new moment()
  logger.info('fetching/storing tickers from ['+exchanges.join('|')+']')

  let promises = []
  let result

  let dbTickers = rl.tickerByExchange
  if (opt.options.n) {
    for (let exchange of exchanges) {
      //await rl.storable.retrieve(null, 'tickers')

      // of all ticker symbols ccxt market data knows about
      // cross reference with whats in the database 
      // filling in epoch as missing datetimes
      //
      let symbols = []
//      log(dbTickers[exchange])
      rl.exchangeMarketSymbols(exchange).map(s => {
//          if (dbTickers.has(exchange) && dbTickers[exchange].has(s)) {
//            let bn = s.toLowerCase().split(/\//)
//            symbols.push(bn.join('_'))
            symbols.push(s)
//          }
      })
      let batch = []

      let len = 0
      let count = 0
      for (let s of symbols) {
        len += (s.length + 1)
        let endpoint = 'https://yobit.net/api/3/ticker/';
        if (len > (511 - endpoint.length))
          break
        count++;
      }
      batch = [...symbols.splice(0,count)]

      while (batch.length > 0) {
       let result = [await rl.apiFetchTickers(exchange, batch)];

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
    let remain = symbols.length
    logger.info(`fetched ${count} ticker symbols, stored ${stored} from ${name}, ${remain} remaining`)

    //  var tickerFile = fs.createWriteStream('.tickers.json', { flags: 'w' });
    //    tickerFile.write( JSON.stringify(tickers, null, 4) )
  }
        let len = 0
        let count = 0
        for (let s of symbols) {
          len += (s.length + 1)
          let endpoint = 'https://yobit.net/api/3/ticker/';
          if (len > (511 - endpoint.length))
            break
          count++
        }
        batch = [...symbols.splice(0,count)]
      }
    }
    process.exit()
  } else {
    promises = exchanges.map(exchange => rl.apiFetchTickers(exchange))
    result = await Promise.all(promises)
  }

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
