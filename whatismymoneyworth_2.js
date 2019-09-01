#!/usr/bin/node
/*
 * $Id: $
 *  TODO:
 *    make getBalance truly dynamic
 *
 *  -COST BASIS
 *   RDBMS, or local cache file - local cache file- makes longterm easier
 *   postgres rdbms table should include:
 *     table of coin, symbols
 *     historical table: datetime, coin
 *  
 *  -list out all exchange tokens, grep USD<->USDT
 *  -incorporate local wallets
 *
 *  Look At Market Cap
 *
 *****************************************************************************/

"use strict";

const ccxt = require('ccxt')
  , log       = require ('ololog').noLocate
  , ansicolor = require ('ansicolor').nice
  , asTable = require ('as-table').configure ({ delimiter: ' | ' })
  , fs        = require ('fs')
  , util      = require ('util')
  , verbose   = process.argv.includes ('--verbose')
  , debug     = process.argv.includes ('--debug')

//******************************************************************************
//******************               GLOBALS                 *********************
//******************************************************************************
const cryptoScale = 5
let symbolForPrice = {}
let portfolio
let apiKeys

process.on('unhandledRejection', (err) => {
  console.error("unhandled Promise Rejection??" + err+"\n"+err.stack)
  process.exit(1)
})

//  Ancillary Functions
//
const numberWithCommas = (x) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

let inspect = function (o) {
  return util.inspect(o, {showHidden: false, depth: null})
}

let printUsage = function () {
  log ('Usage: node', process.argv[1], 'id'.green)
  printSupportedExchanges ()
}

let printSupportedExchanges = function () {
  log ('Supported exchanges:', ccxt.exchanges.join (', ').green)
}

const sortBy = (array, key, descending = false) => {
     descending = descending ? -1 : 1
     return array.sort ((a, b) => ((a[key] < b[key]) ? -descending : ((a[key] > b[key]) ? descending : 0)))
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}

//  Flux Capacitor
//******************************************************************************
let apiFetchTicker = async (exchange,array) => {
    let table = []
//    let table = Object.assign({}, portfolio[id])
//    for (var i = 0, len = table.length; i < len; i++) {
    var i = 0

    await asyncForEach(array, async (el, i, a) => {
//        let coin = table[id][i]
        var t = await exchange.fetchTicker (el.symbol)

        if (Object.hasOwnProperty('high'))
          el.high = t.high
        if (Object.hasOwnProperty('low'))
          el.low = t.low
        el.price = t.last

        let cur = el.symbol.split('/')
//        console.log("currency "+cur[0].red+" against "+cur[1].red);
        symbolForPrice[cur[0]] = el.price
        el['value USD'] = el.amount * t.last
        if (cur[1] == 'USD' || cur[1] == 'USDT') {
//          el.value += ' USD'
        } else {
          if (typeof symbolForPrice[cur[1]] !== 'undefined') {
            el['value USD'] *= symbolForPrice[cur[1]]
//            el.value += ' USD'
          }
        }
        table[i++] = el
    })
  return table
}

let deriveValues = function(key) {
  let text = "deriveValues IMPLEMENT ME"
  console.info(key, text.red)
}

/////////////////////////////////////////////////
//
//  printSymbols will display table output as well as
//  aggregates, etcetera
//
let printSymbols = async (key) => {

  let exchangeFound = ccxt.exchanges.indexOf (key) > -1
  if (exchangeFound) {

    log ('Instantiating', key.green, 'exchange')
    // instantiate the exchange by id
    let exchange = new ccxt[key] ({
      verbose,
      // 'proxy': 'https://cors-anywhere.herokuapp.com/',
      // 'proxy': 'https://crossorigin.me/',
    })

    // set up keys and settings, if any
    const keysGlobal = 'keys.json'
    const keysLocal = 'keys.local.json'

    let keysFile = fs.existsSync (keysLocal) ? keysLocal : (fs.existsSync (keysGlobal) ? keysGlobal : false)
    let settings = keysFile ? (require ('../../' + keysFile)[key] || {}) : {}

    Object.assign (exchange, settings)

    // load all markets from the exchange
    let markets = await exchange.loadMarkets ()

    // debug log
    if (debug)
      Object.values (markets).forEach (market => log (market))

    // make a table of all markets

   //  log ("\nSymbols:\n".red)

    let table = await apiFetchTicker (exchange, portfolio[key])
     
    let totalUSD = table.map( el => el['value USD'])
        .reduce( (acc, cur) => acc + cur )

    //
    // END of derivations, BEGIN of processing as strings
    //
    //  el['value USD'] = el['value USD'].toFixed(2)
    table.push({symbol: 'Total', 'value USD': totalUSD })

    /*
    await asyncForEach(Object.keys(table), async function(el, i, a) {
      console.log(el)
      table[el] = numberWithCommas(table[el])
    })
    */

    table.forEach(function(el,i,a) {
      el['value USD'] = '$'+numberWithCommas(el['value USD'].toFixed(2))
    })

    let printNice = asTable(sortBy(table, Object.values(table), 'value'))
    console.log(key.magenta)
    console.log(printNice)
      
//     log (symbolForPrice)
     
    //    let symbols = Object.keys (exchange.markets)
    //    let random = Math.floor ((Math.random () * symbols.length)) - 1
    //    console.log (exchange.fetchTicker (symbols[random])) // ticker for a random symbol
  } else {

    log ('Exchange ' + key.red + ' not found')
    printSupportedExchanges()
  }
}

/////////////////////////////////////////////////
//  pass name of exchange, make dynamic
//
async function getBalances(exch)
{
  let exchange = new ccxt.gdax (exch)
  let table = {}
  try {

    // fetch account balance from the exchange
    let balance = await exchange.fetchBalance ()

    // output the result
    log (exchange.name.green, 'balance')

//    log(balance)
    await asyncForEach(balance.info, async (el, i, a) => {
      if (parseFloat(el.available) > 0) {
 //       log(el.currency, " => ", el.available)
        table[el.currency] = parseFloat(el.total)
//        log( portfolio[exchange.name.toLowerCase()] )
          portfolio[exchange.name.toLowerCase()].forEach(function (Pel, i, a) {
            if (Pel.symbol.split('/')[0] == el.currency) {
//              log(el.currency, " ",Pel.symbol, " ", parseFloat(el.total))
              Pel.amount = el.available
//              log(el.currency, " ",Pel.symbol, " ", Pel.amount)

            }
        })
      }
    })
//    log(portfolio)

    /*
    let printNice = asTable(sortBy(table, Object.values(table), 'value'))
    log( printNice )
    log( balance )
    */

  } catch (e) {

    if (e instanceof ccxt.DDoSProtection || e.message.includes ('ECONNRESET')) {
      log.bright.yellow ('[DDoS Protection] ' + e.message)
    } else if (e instanceof ccxt.RequestTimeout) {
      log.bright.yellow ('[Request Timeout] ' + e.message)
    } else if (e instanceof ccxt.AuthenticationError) {
      log.bright.yellow ('[Authentication Error] ' + e.message)
    } else if (e instanceof ccxt.ExchangeNotAvailable) {
      log.bright.yellow ('[Exchange Not Available Error] ' + e.message)
    } else if (e instanceof ccxt.ExchangeError) {
      log.bright.yellow ('[Exchange Error] ' + e.message)
    } else if (e instanceof ccxt.NetworkError) {
      log.bright.yellow ('[Network Error] ' + e.message)
    } else {
      throw e;
    }
  }
  return table
}


//******************************************************************************
//******************                 MAIN                  *********************
//******************************************************************************
(async function main () {
  loadDataSection()

  Object.keys(apiKeys).forEach( (it_exch) => {
      log ( "\n", it_exch.green.underline," wallet".green , "\n")
      let balances =  getBalances(apiKeys[it_exch])

  Object.keys(balances).forEach( function(el,i,a)  {
          if (el == portfolio[exchange.name].symbol.split('/')[0]) {
            log("getBalance ", el, balances[el])
          }
        })
  })
  
  Object.keys(portfolio).forEach( it_exch => deriveValues (it_exch) )

  Object.keys(portfolio).forEach( (it_exch) => printSymbols (it_exch) )

//  Object.keys(portfolio).forEach( it_exch => printSymbols (it_exch) )

//  process.exit ()
}) ()

//******************************************************************************
//******************                 DATA                  *********************
//******************************************************************************
//
// quadrigacx
// xbt/cad XɃT/USD eth/cad eth/xbt ltc/cad ltc/xbt bch/cad bch/xbt bsv/cad btg/cad btg/xbt
function loadDataSection() {
  apiKeys = {
    gdax: {
      apiKey: "3817f90fececb0a34e268b687bbeb836",
      secret: "McGKSd3eh4L142nQlVtaZtmG2NezswxA06gYKqCcKRmhfczcKljlIqlYDg2v/5Ff0fiwtFjTyduoU96Ok7KBaQ==",
      password: "q1w2E#r4",
    }
  }
  portfolio = { 
    "yobit": [
      { "symbol": "BTC/USD",
        "amount": 1 },
      { "symbol": "ETH/USD",
        "amount": 1 },
      { "symbol": "LTC/USD",
        "amount": 1 },
    ],
    "quadrigacx": [
      { "symbol": "BTC/USD",
        "amount": 1 },
      { "symbol": "BTC/CAD",
        "amount": 1 },
      { "symbol": "ETH/BTC",
        "amount": 1 },
      { "symbol": "ETH/CAD",
        "amount": 1 },
      { "symbol": "LTC/BTC",
        "amount": 1 },
      { "symbol": "LTC/CAD",
        "amount": 1 },
    ],
    "okcoinusd": [
      { "symbol": "BTC/USD",
        "amount": 1 },
      { "symbol": "ETH/USD",
        "amount": 1 },
      { "symbol": "LTC/USD",
        "amount": 1 },
    ],
    "gemini": [
      { "symbol": "BTC/USD",
        "amount": 1 },
      { "symbol": "ETH/USD",
        "amount": 1 },
      { "symbol": "ZEC/USD",
        "amount": 1 },
      { "symbol": "LTC/USD",
        "amount": 1 },
    ],
    "gdax": [
      { "symbol": "BTC/USD"},
      { "symbol": "ETH/USD"},
      { "symbol": "ETC/USD"},
      { "symbol": "BCH/USD"},
      { "symbol": "LTC/USD"}
    ]
  }
}
