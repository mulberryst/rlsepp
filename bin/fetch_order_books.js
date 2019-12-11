'use strict';
const config = require('config')
  , stdio = require('stdio')
  , fs = require("mz/fs")
  , path = require('path')
  , util = require('util')
  , moment = require('moment')
  , JSON = require('JSON')
  , log = require ('ololog')
  , Rlsepp = require('./librlsepp').Rlsepp
  , Storable = require('./librlsepp/js/lib/storable').Storable
;

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async function main() {

  let storable = new Storable({exchanges:['default']})
  await storable.init()

//  let tickers = await storable.retrieve(null, 'tickers')
  let bookheaders = await storable.retrieve(null, 'orderbookheaders')

  //let allExchanges = config.get('exchanges')
  //
  let exchanges = bookheaders.keys()

  let opt = stdio.getopt({
  })
  if (opt.args && opt.args.length > 0) {
    exchanges = opt.args
  }


  let symbols = []

  const rl = Rlsepp.getInstance();
  await rl.initAsync(exchanges, {enableRateLimit: true})
//  let listAC = rl.arbitrableCommodities(['USDT'])
//  let table = await rl.fetchArbitrableTickers(listAC, ['USD', 'BTC', 'ETH'])           

  //throw new Error("done with tickers")

  let filter = bookheaders.splice(exchanges)
  let orderBooks = await rl.fetchOrderBooks(filter)
  let count = 0
  let  out = ""
  for (let exchange of orderBooks) {
    for (let book of exchange) {
      count++
    }
    out += exchange.exchange + " has "+count+" order books\n"
  }
  log(out)

})()
