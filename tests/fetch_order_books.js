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
  , Ti = require('./librlsepp').Rlsepp
;

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async function main() {
  log("weee")
  const rl = Rlsepp.getInstance();
//  let ixExchanges = new IxDictionary(["yobit", "livecoin", "gemini", "crex24", "cex"])

  let allExchanges = config.get('exchanges')
  log("weee")
  let exchanges = allExchanges
  let symbols = []

  await rl.initAsync(exchanges, {enableRateLimit: true})
//  let listAC = rl.arbitrableCommodities(['USDT'])
//  let table = await rl.fetchArbitrableTickers(listAC, ['USD', 'BTC', 'ETH'])           

  //throw new Error("done with tickers")

  let tickers = await rl.retrieve(null, 'tickers')
  for (let name in tickers) {
    let symbols =  tickers[name].keys()
    log(name + " has "+symbols.length)
  }

  let orderBooks = await rl.fetchOrderBooks(tickers)
  let count = 0
  let  out = ""
  for (let exchange of orderBooks) {
    for (let book of exchange) {
      log(book)
      count++
    }
    out += exchange + " has "+count+" order books\n"
  }
  log(out)

})()
