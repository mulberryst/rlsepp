'use strict';
const config = require('config')
  , stdio = require('stdio')
  , fs = require("mz/fs")
  , path = require('path')
  , util = require('util')
  , moment = require('moment')
  , JSON = require('JSON')
  , log = require ('ololog')
  , ansi = require('ansicolor').nice
  , asTable = require ('as-table').configure ({ title: x => x.bright, delimiter: ' | '.dim.cyan, dash: '-'.bright.cyan })
  , asTableLog = require ('as-table').configure ({ title: x => x, delimiter: ' | ', dash: '-' })
  , Rlsepp = require('librlsepp').Rlsepp
  , Event = require('librlsepp').Event
  , Tickers = require('librlsepp').Tickers
  , IxDictionary = require('librlsepp/js/lib/ixdictionary')
  , Storable = require('librlsepp/js/lib/storable').Storable
;


let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

;(async function main() {

  let exchanges = []
  let opt = stdio.getopt({
    'file': {key: 'f', mandatory:true, multiple: true},
    'write': {key: 'w', args: 1},
    'tid': {key: 't', args: 1}
  })

  let jsonevents = []
  let files = null
  if (opt.file.constructor == Array)
    files = opt.file
  else
    files = [opt.file]
  try {
    for (let file of files) {
      log(file)
      const contents = await fs.readFile(file)
      let parsed = JSON.parse(contents)
      jsonevents.push(parsed)
    }
  } catch(e) {
    console.log(e.message)
  };

//  log(JSON.stringify(jsonevents, null, 4))
//  throw ("asd")


  let cache = {}
  let ex = {}
  let events = [] //make generic TODO

  //  determine which exchanges to init
  //
  if (opt.tid && jsonevents[0][opt.tid]) {
    log("TID mode")
  //  mainly for testings
    for (let event of jsonevents[0][opt.tid]) {
      event.symbol = event.amountType + "/" + event.costType
      ex[event.exchange] = true
    }
    events = new Tickers(jsonevents[0][opt.tid])

  } else {
    for (let fileno in jsonevents) {
      for (let tid in jsonevents[fileno]) {
        for (let event of jsonevents[fileno][tid]) {
          event.symbol = event.amountType + "/" + event.costType
          ex[event.exchange] = true
        }
      }
    }
  }

  for (let exchange in ex)
    exchanges.push(exchange)

  const rl = Rlsepp.getInstance();
  await rl.initStorable()
  await rl.initAsync(exchanges, {enableRateLimit: true})
 

  let spreads = rl.deriveSpreads( )

//  let listAC = rl.arbitrableCommodities(['USDT'])
//  let table = await rl.fetchArbitrableTickers(listAC, ['USD', 'BTC', 'ETH'])           

  let ixMoves = new IxDictionary()
  let ixDeposit = new IxDictionary()
  let ixWithdraw = new IxDictionary()
  let transaction = new IxDictionary()

  //  add explicit move events, cache them for api verificatevents.18187.can.move.jsonion
  //
  for (let fileno in jsonevents) {
    for (let tid in jsonevents[fileno]) {

      if (opt.tid && opt.tid != tid)
        continue

      let events = []
      for (let i in jsonevents[fileno][tid]) {
        let a = jsonevents[fileno][tid][i]
        try {
          let last = jsonevents[fileno][tid][i-1]
          if (last && last.exchange != a.exchange && a.action != "move") {
            if (last.action == 'buy') {
              let e = new Event({
                action:"move",
                exchange:a.exchange,
                fromExchange:last.exchange,
                amountType:a.amountType,
                amount:a.amount,
                costType:a.amountType,
                cost:1,
                tid:null
              })

              ixMoves[e.exchange+e.fromExchange+e.amountType] = new Event(e)
              ixWithdraw[e.fromExchange] = e.amountType
              ixDeposit[e.exchange] = e.amountType
              events.push(e)
            }
          }
          if (a.action == "move") {
            ixMoves[a.exchange+a.fromExchange+a.amountType] = new Event(a)
            ixWithdraw[a.fromExchange] = a.amountType
            ixDeposit[a.exchange] = a.amountType
          }
        } catch(e) {
          log(e)
        }
        events.push(a)
      }
      transaction[tid] = events
    }
  }

  let ixNotSupported = new IxDictionary()
  for (let i in ixMoves) {
    let e = ixMoves[i]
        try {
          if (e.action == 'move') {
            if (ixNotSupported.has(e.fromExchange+e.amountType)) {
              e.cantMove = "NotSupported"
              continue
            }

            let canMove = null
            try {
              let ten = spreads[e.amountType+"/USD"].meanAmountPerOneUSD * 10
              canMove = await rl.safeMoveMoneyAsync(e.amountType, e.fromExchange, e.exchange, ten)
            } catch(err) {
              if (err.name == "withdraw") {
                ixNotSupported[e.fromExchange+e.amountType] = 1 
              }
              e.cantMove = err
              log("cant move " + err+"\n"+JSON.stringify(e))
            }
          }
        } catch(err) {
          log(err)
        }
  }

  log(JSON.stringify(ixMoves,null, 4))

//01724058266001
  //01724187266001
  for (let ti in transaction) {
    let t = transaction[ti]
    for (let i in t) {
      let e = t[i]
      if (e.action == "move") {

        let cantMove = ixMoves[e.exchange+e.fromExchange+e.amountType].cantMove
//        let message = ixMoves[e.exchange+e.fromExchange+e.amountType].message
        if (cantMove) {
          log("adding canot move "+cantMove + " "+e.amountType)
          e.cantMove = JSON.stringify(cantMove) + '|'+e.exchange+'|'+e.fromExchange+'|'+e.amountType
          rl.store(e.cantMove, 'errors')
//          e.message = message
          transaction[ti][i] = e
        }
      }
    }
  }
  let fileName = "events."+process.pid+".can.move.json"
  if (opt.write)
    fileName = opt.write
  log("writing file "+fileName+" containing "+transaction.keys().length + " transactions")
  var eventFile= fs.createWriteStream(fileName, { flags: 'w' });
  eventFile.write(JSON.stringify(transaction, null, 4))

})()
