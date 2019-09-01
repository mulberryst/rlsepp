"use strict";

/*  ------------------------------------------------------------------------ */

const ccxt        = require ('ccxt')
    , asTable     = require ('as-table') // .configure ({ print: require ('string.ify').noPretty })
    , log         = require ('ololog').noLocate
    , ansi        = require ('ansicolor').nice

;(async function test () {

    let total = 0
    let missing = 0
    let implemented = 0
    let emulated = 0

    log (asTable (ccxt.exchanges.map (id => new ccxt[id]()).map (exchange => {

        let result = {};

        [
            'fetchCurrencies',
            'fetchDepositAddress',
            'createDepositAddress',
            'withdraw',

        ].forEach (key => {

            total += 1

            let capability = exchange.has[key].toString ()

            if (!exchange.has[key]) {
                capability = exchange.id.red.dim + ' ' + key
                missing += 1
            } else if (exchange.has[key] === 'emulated') {
                capability = exchange.id.yellow+ ' ' + key
                emulated += 1
            } else {
                capability = exchange.id.green+ ' ' + key
                implemented += 1
            }

            result[key] = capability 
        })

        return result
    })))

    log ('Methods:',
        implemented.toString ().green, 'implemented,',
        emulated.toString ().yellow, 'emulated,',
        missing.toString ().red, 'missing,',
        total.toString (), 'total')

}) ()
