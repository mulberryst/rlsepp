'use strict';
process.env.NODE_ENV='public'
const config = require('config')
  , stdio = require('stdio')
  , fs = require("mz/fs")
  , path = require('path')
  , util = require('util')
  , moment = require('moment')
  , JSON = require('JSON')
  , StackTracey = require('stacktracey') 
;

let ftrace = function () {
  var stack = new Error().stack
  process.stdout.write( stack )
  process.stdout.write(util.format.apply(null, arguments) + '\n')
}

//let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

Function.prototype.benchmark = function(Pthis,Pargv) {

  let then = moment()
  let r = this.call(Pthis, Pargv)
  let now = moment()

  const indent        = '    '
    , stack         = new StackTracey (Pthis).pretty
    , stackIndented = stack.split ('\n').map (x => indent + x).join ('\n')
    , type        = Pthis.constructor.name || 'Error'

  console.log(type+ " "+stackIndented+"\n"+' time taken '+moment.duration(now.diff(then)).as('seconds')+' seconds')
  return r
}


class Test extends Array {
  constructor() {
    super(Array.from(arguments))
  }
  async count() {
    sleep 2;
    return this.length;
  }
}

;(async function main() {
  let a = new Test(1,2,3,4,5)
  console.log(JSON.stringify(a))

  a.count()

  a.count.benchmark(a)

  /*
  let opt = stdio.getopt({
  })
  let exchanges = ['gemini']
  if (opt.args && opt.args.length > 0)
    exchanges = opt.args

  const rl = Rlsepp.getInstance();
  await rl.initStorable()
  await rl.initAsync(exchanges, {enableRateLimit: true})



  let promises = exchanges.map(exchange => rl.apiFetchTickers.benchmark(rl, exchange))
  let result = await Promise.all(promises)
  let tickers = new Tickers()

  result.map(e => tickers.merge(e))
//  log(JSON.stringify(tickers,null,4))
*/
})().then().catch(e => console.log(e))
