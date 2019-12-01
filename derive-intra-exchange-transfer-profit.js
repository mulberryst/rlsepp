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
  , deleteme     = process.argv.includes ('--wtf')

//******************************************************************************
//******************               GLOBALS                 *********************
//******************************************************************************
const cryptoScale = 5
let symbolForPrice = {}

//i have accounts on these exchanges
let	exchangeList = [ "gemini", "gdax", "coinbase", "yobit", "binance" ]
let portfolio
let apiKeys

//  TODO: make more 
//
process.on('unhandledRejection', (err) => {
  console.error("*****-> unhandled Promise Rejection??  :" + err+"\n"+err.stack)
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
let printSymbols = async (exchangeName) => {

        var t = await exchange.fetchTicker (el.symbol)

    // load all markets from the exchange
    let markets = await exchanges[exchangeName].loadMarkets ()

    // debug log
    if (debug)
      Object.values (markets).forEach (market => log (market))

    // make a table of all markets

   //  log ("\nSymbols:\n".red)

    let table = await apiFetchTicker (exchanges[exchangeName], portfolio[exchangeName])
     
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

}

/////////////////////////////////////////////////
//  instantiates exchanges

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

// instantiates global exchange[]
//
async function initExchanges (list, creds) {
	const promises = list.map( async (exName) => {
		let exchangeFound = ccxt.exchanges.indexOf (exName) > -1
		if (exchangeFound) {

			log ('Instantiating', exName.green, 'exchange')
			// instantiate the exchange by id

  //let exchange = new ccxt.gdax (exch)
			let e =  new ccxt[exName] ({
				verbose,
			})
      if (creds.hasOwnProperty(exName)) {
        var keys = Object.keys(creds[exName])
        keys.map( self => { e[self] = creds[exName][self] } )
      }
      e['name'] = exName
      return e

		} else {
			log ('Exchange ' + exName.red + ' not found')
			printSupportedExchanges()
		}
	})
	const e = await Promise.all(promises)

	return e;
}

async function initMarkets (exchanges) 
{
//	Object.keys(exchanges).forEach( (k) => console.log(k))
	const promises = exchanges.map( (e) => e.loadMarkets () )
	const markets = await Promise.all(promises)
	return markets
}

//******************************************************************************
//******************                 MAIN                  *********************
//******************************************************************************
(async function main () {
  loadDataSection()
	let exchanges = await initExchanges(exchangeList, apiKeys)

	let markets = await initMarkets(exchanges)
//	markets.forEach( (k) => console.log(k))

  var once = 1
	markets.forEach ( (m) => {
		Object.values(m).forEach( (s) => {
      if (once) {
        once = 0
  			console.log ( s.symbol+ " taker "+s.taker + " maker "+s.maker + " base "+ s.base + " symbol " + s.symbol )
      }
		})
	})

// calculateFee (symbol, type, side, amount, price, takerOrMaker = 'taker', params = {}) {


    await asyncForEach(exchanges, async (e, i, a) => {
      console.log(e.name.green)
      try {
        let r = await e.fetchOHLCV('BTC/USD', '5m');
//        console.log("blah " +r);
      } catch(e) {
        if (verbose)
          console.log(e)
      };
//      let now = await e.fetchTime();
//    for (var i = 0; i < exchangeList.length; i++) {
      let list;
      try {
        list = await e.fetchTransactions('BTC');
//        Object.values (list).forEach (self => console.error (self))
      } catch(e) {
        if (verbose)
          console.log(e)
      };
      if (list) {
        //  lemmiwinks become auto
        //
        //Object.values (list).forEach (self => {
        //  console.log("created_at: "+self.datetime + " proccessed in " + self.elapsed_time_human)
        //})
        //
        //  Object(foo) is now iterable
        //
        console.log("Transactions:")
        for (const transaction of Object(list)) {
          console.log("created_at: "+transaction.datetime + " proccessed in " + transaction.elapsed_time_human)
        }
      }
    })

/*
    ex = exchanges;
    for (var i = 0; i < exchangeList.length; i++) {
      let e = ex.shift();
      let list
      try {
        list = await e.fetchOHLCV('BTC', '1d')

        if (deleteme)
          Object.values (list).forEach (self => console.error (self))
      } catch(e) {
        if (verbose)
          console.log(e)
      };

      for (const foo of new Map(list)) {
        console.log("")
      }

    }
    */

//    e.marketClasses[symbol].createLimitBuyOrder(amt, price)

//	exchangeList.indexOf(

	// getBalances instantiates gdax
//  Object.keys(apiKeys).forEach( (it_exch, i, a) => {
 //     log ( "\n", it_exch.green.underline," wallet".green , "\n")
  //    let balances =  getBalances(apiKeys[it_exch])

// Object.keys(balances).forEach( (el,i,a) => {
//          if (el == portfolio[exchange.name].symbol.split('/')[0]) {
//            log("getBalance ", el, balances[el])
//          }
//        })
//  })

//  process.exit ()
}) ()

//		await Object.values (markets).forEach (async (m) => {
//			log ( "taker "+m.taker + " maker "+m.maker + " base "+ m.base + " symbol " + m.symbol )
//******************************************************************************
//******************                 DATA                  *********************
//******************************************************************************
//
// quadrigacx
// xbt/cad XɃT/USD eth/cad eth/xbt ltc/cad ltc/xbt bch/cad bch/xbt bsv/cad btg/cad btg/xbt
function loadDataSection() {
  apiKeys = {
    gdax: {
      apiKey: "18f14eb65ad462307651896b22290dad",
      secret: 'Z7MC/iDHzkZ3wtz8dQyZumYBimlzLD9O7Y4uSOM2cZjRE3xSWydS/TRWz+2WS/08YUo5EhM6eicL    iHuHYso7TQ==',
      passphrase: 'suckit',
    },
    //  not sure if this one is supported
    //
    binance: {
      apiKey: "9WuYXHRmiZwZrfqoAJk5EyhNgX7DmD72t0fJMeGmh6XjNDzhuTUejiNJRYuexh92",
      secret: 'jzpqIicF1awoHR0N1KsGYltTTPYhvHJELdOPJ8EHd1xJ2098yuGQGGyvJPTMNceN',
    },
    yobit: {
      apiKey: '561D4AF71F1944803C000B49B12E395C',
      secret: '84336fd7dc4f61aa045b33d27750abf6',
    },
    gemini: {
      apiKey: "",
      secret: "",
      password: "",
      twofa: "",
    }
  }
  portfolio = { 
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
