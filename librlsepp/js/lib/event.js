const moment = require('moment')
 , expect = require('chai').expect
 , IxDictionary= require('./ixdictionary')
 , functions = require('./functions')
 , IStorable = require('./storable').IStorable
// , Wallet = require('./wallet').Wallet
 , StronglyTyped = require('./stronglytyped')
 , stats = require('stats-lite')
 , log = require('ololog')
  , util = require('util')
  , sprintf = require('sprintf-js').sprintf
  , asTableLog = require ('as-table').configure ({ title: x => x, delimiter: ' ', dash: '-' })
;

const {
  isArray, 
  isObject, 
  isIterable, 
  isAsyncIterable,
  numberToString
} = functions

class TransferFee extends StronglyTyped {
  constructor(opts) {
    super(opts,{exchange:String, currency:String, fee:String})
    for (let prop in opts)
      this[prop] = opts[prop]
  }
}

class TransferFees extends IxDictionary {
  constructor(obj) {
    if (isIterable(obj)) {
      super()
      for (let e of obj) {
        let ev = new TransferFee(e)
        if (!this.has(ev.exchange))
          this.set(ev.exchange, new IxDictionary())
        this[ev.exchange].set(ev.currency, ev.fee)
      }
    } else {
      throw new Error("Events() don't know what to do with "+obj)
    }
  }
}

class ExchangeException extends StronglyTyped {
  constructor(opts) {
    super(opts,{exchange:String, action:String})
    for (let prop in opts)
      this[prop] = opts[prop]
    if (typeof opts.datetime === 'undefined')
      this.datetime = moment().toISOString();
  }
}

class ExchangeExceptions extends IxDictionary {
  constructor(obj) {
    if (obj instanceof Event) {
      super()
      this.set(obj.exchange, new IxDictionary())
      this[obj.exchange].set(obj.action, obj)
    } else if (obj instanceof Events) {
      super(obj)
    } else if (isIterable(obj)) {
      super()
      for (let e of obj) {
        let ev = new ExchangeException(e)
        if (!this.has(ev.exchange))
          this.set(ev.exchange, new IxDictionary())
        this[ev.exchange].set(ev.action, new IxDictionary(ev.data))
      }
    } else {
      throw new Error("Events() don't know what to do with "+obj)
    }
  }
}


//  dsc:
//
//  {
//    "<id>" : [
//      Event{}
//    ]
//  }
//
//  where id is one of 3
//
//  tree id from a tree in another executable
//  fileno+treeid ^_^
//  eventid from database
//
class Events extends IxDictionary {

  //  frequency counts
  //
  printTotals() {
    let totals = new IxDictionary()
    for (let k in this) {
      for (let e of this[k]) {
        if (e.action == 'buy' || e.action == 'buy') {
          if (!totals.has(e.exchange))
            totals.set(e.exchange, new IxDictionary())
          if (!totals[e.exchange].has(e.symbol))
            totals[e.exchange].set(e.symbol, 1)
          else
            totals[e.exchange].set(e.symbol, totals[e.exchange][e.symbol]+1)
        }
      }
    }

    for (let name in totals) {
      let ixD = totals[name]
      console.log(name)

      for (let symbol in ixD) {
        let count = totals[name][symbol]
        console.log(symbol+"\t"+count)
      }
      console.log()
    }
  }

  count(tid=null) {
    let c = 0
    for(let k in this) {
      if (tid != null && k != tid)
        continue
      for (let kk in this[k]) {
        if (this[k][kk])
          c++
      }
    }
    return c
  }

  //accessors
  //
  //events
  last(tid=null) {
    let r = null
    let k = this.keys()
    if (tid == null)
      tid = k.pop()

    try {
      r = this[tid][this[tid].length - 1]
      r.transaction_tag = tid
    } catch(e) {
    }
    return r
  }

  first(tid=null) {
    let r = null
    let k = this.keys()
    if (tid == null)
      tid = k.shift()

    try {
      r = this[tid][0]
      r.transaction_tag = tid
    } catch(e) {
    }
    return r
  }

  //transactions
  //
  costBasis(tid=null) {
    let r = null

    try {
      r = Number(this.first(tid).cost)
    } catch(e) {
    }
    return r
  }

  profit(tid=null) {
    if (this.last(tid).action == 'sell')
      return Number(this.last(tid).cost) - this.costBasis(tid)
  }

  buysell(tid=null) {
    /*
    let r = new Events()
    let k = this.keys()
    if (tid == null)
      tid = k.shift()

    for (let ev of this[tid]) {
      if (ev.action == "buy" || ev.action == "sell")

    }
    */
  }

  //  this can also be done with a selection
  //
  trimLossPercentAnyEvent(lossP=0.1) {
    let tids = this.keysByProfit()
    for (let tid of tids) {
      let t = this[tid]
      for (let ev of t) {
      }
    }
    let loss = this.costBasis
  }

  trimLoss(loss=0) {
    let tids = this.keysByProfit()
    let loosers = tids.filter(tid => this.profit(tid) <= loss)
    this.remove(loosers)
  }


  cloneProfitable(profit=0) {
    let tids = this.keysByProfit()
    let winners = tids.filter(tid => this.profit(tid) > profit)

    let r = new Events()
    for (let t of winners) {
      r.add(this[t])
    }
    return r
  }

  keysByProfit(dir='asc') {
    let tids = this.keys()
    if (dir == 'asc')
      tids.sort((a,b) => ((this.profit(a) < this.profit(b)) ? -1 : (this.profit(a) > this.profit(b) ? 1 : 0)))
    else
      tids.sort((a,b) => ((this.profit(a) < this.profit(b)) ? 1 : (this.profit(a) > this.profit(b) ? -1 : 0)))

    return tids
  }

  print(tid=null) {
    console.log(this.asString(tid))
  }

  asTweet(tid=null) {
    let dupCheck = new IxDictionary()
    let table = []
    let tweet = []
    if (tid) {
      let rows = [[ sprintf("$%0.2f",this.profit(tid)), "","","", "amount","","price","orders","cost"]]
      rows.push(["", tid, "","","","","",""])
      for (let aid in this[tid]) {
        let ev = this[tid][aid]
          if (ev.action == 'move' && ev.cantMove)
            continue

          if (ev.orders)
            rows.push(["", ev.action, ev.exchange, ev.amountType + "/" + ev.costType, ev.amount,ev.priceType, ev.price, ev.orders.length,ev.cost])
          else {
            if (ev.action == "move") {
              rows.push(["",ev.action, ev.fromExchange+"/"+ev.exchange,ev.amountType,ev.amount,"fee","?","",""])
            } else {
              rows.push(["",ev.action,ev.exchange,ev.amountType + "/" + ev.costType, "no order book", "","","","",""])
            }
          }

      }
      if (this.last(tid).action == 'sell')
        table.push(rows)
    }
    log(table)
    let t = table.map(el => asTableLog(el) + "\n").join("\n")
    return t
  }

  //  TODO: floatToPrecision
  //
  asString(tid=null) {

    let dupCheck = new IxDictionary()
    let r = ""
    let out = []
    if (tid) {

      let costBasis = Number(this.first(tid).cost)
      for (let aid in this[tid]) {
        let ev = this[tid][aid]

          if (ev.action == 'move' && ev.cantMove)
            continue

          if (ev.action == 'buy' || ev.action == 'sell') {
            r = r + util.format("%s %s %s/%s %s %d", ev.action, ev.exchange, ev.amountType, ev.costType, ev.priceType, ev.price);
          } 
        if (ev.orders) {
            r += " orders " + ev.orders.length + "|"
          } else 
            r = r + "|"

          if (ev.action == 'sell' && aid == (this[tid].length - 1)) {
            r += sprintf("$%0.2f",this.profit(tid))
            if (!dupCheck.has(r)) {
              dupCheck.set(r, 1)
              //all sales
              out.push([r])
//              if (opt.notify && Number(ev.cost) >= Number(opt.notify))
//                table.push(rows)
            }
          }

      }
    }
    return out.join("\n")
  }

  //  keys of collection
  //  nested array of Event()
  //
  merge(obj) {
    if (isIterable(obj)) {
      for (let tid in obj) {
        let item = obj[tid]
        if (isArray(item)) {
          for (let ev of item) {
            let event = new Event(ev)
            if (!this.has(tid))
              this.set(tid, [])
            this[tid].push(event)

            //  running total of exchanges used within events collection (transaction)
            //
            /*
            if (event.action == "move" && event.romExchange)
              this.exchanges[event.fromExchange] = 1
            this.exchanges[event.exchange] = 1
            */
          }
        } else if (isObject(item)) {
          throw new Error(typeof item)
          //  use case?
          //
          let event = new Event(obj[tid])
          if (!this.has(tid))
            this.set(tid, [])
          this[tid].push(event)
          /*
          if (event.action == "move" && event.fromExchange)
            this.exchanges[event.fromExchange] = 1
            */
        }
      }
    } else {
      log(obj)
      throw (new Error("Events::merge passed non-iterable"))
    }
  }

  //  
  //
  add(array=null,tid=null) {
    if (!this.has(tid))
      this.set(tid, [])
    for (let e of array) {
      let ev = e
      if (!(e instanceof Event)) {
        ev = new Event(e)
      }
      this[tid].push(ev)
    }
  }

  //  the ever evolving data structure that is this object
  //
  transactionTags() {
    return this.keys()
  }

  //
  //
  exchangeBeginsOn() {
    let r = new IxDictionary()
    for (let tag of this.keys()) {
      r.set(this.first(tag).exchange)
    }    
    return r.keys().sort((a,b) => (a < b) ? -1 : (a > b) ? 1 : 0)
  }

  //  
  //
  exchangeEndsOn(name=null) {
    let r = new IxDictionary()
    for (let tag of this.keys()) {
      r.set(this.last(tag).exchange)
    }
    if (name != null) 
      if (r.has(name))
        return true
      else
        return false
    return r.keys().sort((a,b) => (a < b) ? -1 : (a > b) ? 1 : 0)
  }


  //  returns HofH ex => { sym => count }
  //
  symbolsPerExchange() {
    let r = new IxDictionary()
    for (let e of this) {
      if (!r.has(e.exchange))
        r[e.exchange] = new IxDictionary()
      if (!r[e.exchange].has(e.symbol))
        r[e.exchange].set(e.symbol, 0)
      r[e.exchange][e.symbol]++
    }
    return r
  }

  //  enumerate all exchanges used within transaction
  //
  exchanges() {
    let r = new IxDictionary()
    for (let it of this) {
      r.set(it.exchange, 1)
      if (it['fromExchange'])
        r.set(it.fromExchange, 1)
    }    
    return r.keys().sort((a,b) => (a < b) ? -1 : (a > b) ? 1 : 0)
  }

  //  begins and ends on an exchange linked to a bank account with fiat
  //
  //  For now, minimum
  //    buy, [move] ,sell  (resulting in profit)
  //    buy, buy, buy, sell (single)
  //    buy [move] buy [
  //
  isValidTransaction() {
    throw new Error("implement me");
    let last = null
    let begin = this[0]
    let end = this[this.keys().length-1]

    for (let ev of this) {
      if (last != null && last.exchange != ev.exchange && ev.action != 'move')
        return false

      last = ev
    }
    return true
  }

/*
  const months = ['Jan', 'March', 'April', 'June'];
months.splice(4, 1, 'May');
  Array ["Jan", "March", "April", "June", "May"]
*/


  //TODO:: add iterator(tid)
  //
  //  collection -> array
  //         ^_   -> collection
  //
  constructor(obj=null) {
//    this.exchanges = new IxDictionary()
    if (isObject(obj) && !isIterable(obj)) { 
//      log("new Event() !isIt isObj")
      super()
      //{ //"transaction -> exchange a ---> exchange b
      //  "<fileno><nodeId>": [
      //      {Event()}, 
      //      {Event()},
      //      {Event()}
      //  ],
      //  "transactionID <fileno><nodeId>": [   {ev1}, {ev2}  ]
      //  }
      let iterable = new IxDictionary()
      for (let prop in obj) {
        iterable.set(prop,obj[prop])
      }
      this.merge(iterable)
    } else if (isIterable(obj) && isObject(obj[0])) {
//      log("new Event() isIt isObj[0]")
      super()
      let t = obj[0].transaction_tag
      for (let e of obj) {
        if (e.transaction_tag == t) {
          let f = new Event(e)
          if (!this.has(t))
            this[t] = []
          this[t].push(f)
        }
      }

    } else if (obj == null) {
//      log("new Event() null")
      super()
    } else {
//      log("new Event() else")
      super()
      if (obj)
        this.merge(obj)
      //throw new Error("don't know what to do with this obj")
    }
    //  TODO: handle multiple DSC formats
    //
    this[Symbol.iterator] = function* () {
      for (let key in this) {
        for (let nested in this[key]) {
          yield this[key][nested];
        }
      }
    };

  }
}


class Event extends StronglyTyped {
  constructor(opts) {
    let o =
      {
        exchange:String, 
        action:String, 
        amountType:String, 
        amount:String,
        costType:String,
        cost: String
      };

//    log(opts)
    if (opts.fromexchange) {
//      o[fromExchange] = String
    }
//    log(o)
 //throw "fromExchange, fromexchange"
    super(o)
    for (let prop in opts)
      this[prop] = opts[prop]

    //  moniker camelcase from lowercase token string hard coded
    //
    if (opts.fromexchange)
      this.fromExchange = opts.fromexchange
    if (opts.amounttype)
      this.amountType = opts.amounttype
    if (opts.costtype)
      this.costType = opts.costtype

    if (typeof opts.datetime === 'undefined')
      this.datetime = moment().toISOString();
    else  {
      this.datetime = new moment(this.datetime).toISOString();
      this.age = moment.duration(new moment().diff(new moment(this.datetime))).as('seconds')
    }

    if (typeof opts.symbol === 'undefined')
      this.symbol = opts.amountType+"/"+opts.costType
    if (this.price)
      this.priceRounded = this.price

//    log(this.costType)
//    log(this)
  }
  dbFields() {
    return ['created_by', 'tagid', 'transaction_tag', 'exchange', 'address', 'action', 'fromExchange', 'amountType', 'amount', 'costType', 'cost', 'symbol', 'fee', 'price', 'priceType','fulfilled', 'remaining', 'orderbookid', 'datetime','fulfilled_datetime', 'cantmove', 'error_exception_api', 'tid', 'success', 'status', 'created']
  }
}

module.exports = {
  Event: Event,
  Events: Events,
  ExchangeException: ExchangeException,
  ExchangeExceptions: ExchangeExceptions,
  TransferFee: TransferFee,
  TransferFees: TransferFees,
}
