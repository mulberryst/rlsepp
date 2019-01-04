"use strict";

const ccxt      = require ('ccxt')
const asTable   = require ('as-table')
const log       = require ('ololog').configure ({ locate: false })

require ('ansicolor').nice

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async () => {

    // instantiate the exchange
    let gdax = new ccxt.gdax  ({ // ... or new ccxt.gdax ()
        "apiKey": "18f14eb65ad462307651896b22290dad",
        "secret": "Z7MC/iDHzkZ3wtz8dQyZumYBimlzLD9O7Y4uSOM2cZjRE3xSWydS/TRWz+2WS/08YUo5EhM6eicLiHuHYso7TQ==",
        "password": "suckit",
    })

    let hitbtc = new ccxt.gemini ({
        "apiKey": "KOa6SdN9z1SSeCsusApN",
        "secret": "uUH6JeJR8BwTQApUwL2kFUEn9Kx",
    })

    let quadrigacx = new ccxt.binance ({
        "apiKey": "9WuYXHRmiZwZrfqoAJk5EyhNgX7DmD72t0fJMeGmh6XjNDzhuTUejiNJRYuexh92",
        "secret": "jzpqIicF1awoHR0N1KsGYltTTPYhvHJELdOPJ8EHd1xJ2098yuGQGGyvJPTMNceN",
    })
    let yobit = new ccxt.yobit ({
        "apiKey": "561D4AF71F1944803C000B49B12E395C",
        "secret": "84336fd7dc4f61aa045b33d27750abf6"
    })

    try { 

        // fetch account balance from the exchange 
        let gdaxBalance = await gdax.fetchBalance ()

        // output the result
        log (gdax.name.green, 'balance', gdaxBalance)

        // fetch another
        let hitbtcBalance = await hitbtc.fetchBalance ()

        // output it
        log (hitbtc.name.green, 'balance', hitbtcBalance)

        // and the last one
        let quadrigacxBalance = await quadrigacx.fetchBalance ()

        // output it
        log (quadrigacx.name.green, 'balance', quadrigacxBalance)

        log (yobit.name.green, 'balance', await yobit.fetchBalance() )

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
        
}) ()
