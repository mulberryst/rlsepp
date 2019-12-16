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
  , Rlsepp = require('librlsepp').Rlsepp
  , Storable = require('librlsepp/js/lib/storable').Storable
;

let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async function main() {

  let storable = new Storable({exchanges:['default']})
  await storable.init()

//  let tickers = await storable.retrieve(null, 'tickers')
  let tickers = await storable.retrieve(null, 'tickers')

  log(JSON.stringify(tickers,null,4))

})()
