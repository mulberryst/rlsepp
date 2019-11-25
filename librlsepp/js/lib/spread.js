'use strict';

const stats = require('stats-lite')
  , IxDictionary = require('./ixdictionary')
  , Interface = require('interface')
  , util = require('util')
  , functions = require('./functions')
  , chai = require('chai')
;

var expect = chai.expect;
var should = chai.should;
var assert = chai.assert;

const {
  isArray, 
  isObject, 
  isIterable, 
  isAsyncIterable,
  asyncForEach,
  sortBy,
  formatUSD,
  formatBTC,
  formatCrypto
} = functions

// create a mathjs instance with everything included
const { create, all } = require('mathjs')
  // Available options: 'number' (default), 'BigNumber', or 'Fraction'
const math = create(all)


const IPretty = new Interface('pretty', 'propertyBlacklist')


//  TODO:
//    timestamps (updated as per exchange,
//      updated as per this program,
//      timestamp as per exchange
//    see TODO on Exchange
//
const debugOutput = false
//
//  class representing ticker symbol price data from multiple exchanges
//    key: exchange name string
//    value: {exchange: , symbol: , price: }
//
//  collection cannot instantiate without data
//
class Ticker extends IxDictionary {
  constructor(initial = null, options = null) {

    if (debugOutput) {
      console.log('Ticker constructed with (initial = '
        +typeof initial+ ' '
        +util.inspect(initial,{showHidden: false, depth: null})
        +', options = '
        +typeof options+' '
        +util.inspect(options,{showHidden: false, depth: null})
        +')'
      )
      console.log('isObject(options) '+isObject(options))
    }
    //  defined object passed as options, assume initial is a hash key 
    if (isObject(options)) {
      super()
      this.set(initial, options)
    //  iterable object passed as initial, options is null or invalid type
    //    pass as input to Dictionary constructor
    } else if (isIterable(initial)) {
      super(initial, options)
    //  non iterable defined opject passed as initial
    //    assume table data from api call having props [exchange,symbol,price]
    } else if (isObject(initial)) {
      super()
      this.set(initial.exchange, initial)
    } else {
      throw new Error("Ticker(intial, options)")
    }
  }

  // { gemini: { price:1.0, variance: 0.002, mvc: 0.1 } }
  flatten() {
    let data = {}
    for (let row of this) {
      for (let key of ['price', 'bid', 'ask', 'distance', 'mvc']) {
        data[row.exchange+ '_' + key] = row[key]
      }
    }
    return data
  }

  asArraySorted(field='price') {
    let result = []
      let tprop = ['price', 'bid', 'ask', 'distance', 'mvc', 'exchange']
    for (let row of this) {
      let nested = {}
      for (let key of tprop) {
        nested[key] = row[key]
      }
      result.push(nested)
    }
    if (tprop.indexOf(field) == -1)
      field = 'price'
    return sortBy(result, field, false)
  }

  strip() {
    let data = {}
    for (let row of this) {
      let nested = {}
      for (let key of ['price', 'bid','ask','distance', 'mvc']) {
        nested[key] = row[key]
      }
      data[row.exchange] = nested
    }
    let sorted = {}
    let keys = Object.keys(data).sort((a,b) => ((data[a].price < data[b].price) ? -1 : (data[a].price > data[b].price) ? 1 : 0))
    for (let k of keys) {
      sorted[k] = data[k]
    }
    return sorted
  }
}

//  collection class centered around a commodity which holds
//    calculations on the entire spread of prices accross all 
//    ccxt accessible exchanges.
//
//  in:  output from fetchArbitrableTickers
//  out:  object
//
//  TODO assertion on class instance types for collections
//  (to be inline with Tickers' constructor)
//
class Spread {
  constructor(initial = null, merge = null) {
    this.ledger = []
    this.commodity = null
    this.symbol = null
    this.meanBid = 0
    this.meanAsk = 0
  
    if (initial instanceof Ticker) {
      this.tickers = initial
    }
    if (initial instanceof Spread) {
//      console.log('Spread(spread) '+util.inspect(initial))
      for (let prop in initial) {
        if (typeof initial[prop] !== 'undefined') {
          this[prop] = initial[prop]
        }
      }
    }

    if (merge instanceof Spread) {
      for (let [k, v] of merge.tickers.entries()) {
        if (this.tickers.has(k)) {
//          console.log(this.tickers[k])
//          console.log(v)
          throw new Error("duplicate exchange ticker for symbol: "+v.symbol)
        }
        this.tickers.set(k, v)
      }
    }
    //constructor can handle iterable collection or object
    //
    if (this.tickers.size() >= 1) {
      let firstOf = this.tickers.values()[0]
      if (debugOutput) {
        console.log('instance of rlsepp, dictExchage TODO FIXME');
        //        console.log(rlsepp.dictExchange.asTable())
        console.log("Spread constructed with "+this.tickers.size()+" tickers")
        console.log(firstOf)
      }
      let [base, quote] = firstOf.symbol.split('/')

//      assert(rlsepp.dictExchange.has(firstOf.exchange), 'exchanges uninitialized or missing ['+firstOf.exchange+']')
      this.commodity = {symbol:base, name:base}
//        rlsepp.dictExchange[firstOf.exchange].commodities[base]
      this.symbol = firstOf.symbol
    }
  }

  getPrices(type='bid') {
    let prices = []
    for (let t of this.tickers) {
//      console.log('getPrices ' + util.inspect(t))
      if (type == 'bid') {
        prices.push(t.bid)
      } else if (type == 'ask') {
        prices.push(t.ask)
      } else if (type == 'last') {
        prices.push(t.price)
      }
    }
    return prices.sort()
  }

  //  calculate stats
  //  sort bid price, ask price 
  //    *! (reminder for the people without an MBA in finance)
  //      we buy on the ask price (seller is *asking* x)
  //      we sell on the bid price (buyer has put in a *bid* of y)
  //
  calculate() {
    let pBid = this.getPrices('bid')
    let pAsk = this.getPrices('ask')
    let pLast = this.getPrices('last')

    this.meanBid = stats.mean(pBid)
    this.medianBid = stats.median(pBid)
    this.modeBid = stats.mode(pBid)
    this.varianceBid = stats.variance(pBid)
    this.stdevBid = stats.stdev(pBid)
    this.meanAsk = stats.mean(pAsk)
    this.medianAsk = stats.median(pAsk)
    this.modeAsk = stats.mode(pAsk)
    this.varianceAsk = stats.variance(pAsk)
    this.stdevAsk = stats.stdev(pAsk)
    this.min = pAsk.shift()
    this.min2 = pAsk.shift()
    this.max = pBid.pop()
    this.max2 = pBid.pop()

    //TODO: makes sense now?
    for (let t of this.tickers) {
      t.distanceBid = this.meanBid - t.bid
      t.mvc = t.distanceBid / this.meanBid
    }
    let tickersBid = this.tickers.asArraySorted('bid')
    let tickersAsk = this.tickers.asArraySorted('ask')
    this.count = tickersBid.length
    if (this.count > 1) {
      let min = tickersAsk.shift()
      let max = tickersBid.pop()
      let min2 = tickersAsk.shift()
      let max2 = tickersBid.pop()
      if (typeof min !== 'undefined' && typeof max !== 'undefined') {
        this.range = max.ask - min.bid
        this.min = min.ask
        this.max = max.bid
        this.minExchange = min.exchange
        this.maxExchange = max.exchange
      }
      if (typeof min2 !== 'undefined') {
        this.min2 = min2.ask
        this.min2Exchange = min2.exchange
      }
      if (typeof max2 !== 'undefined') {
        this.max2 = max2.bid
        this.max2Exchange = max2.exchange
      }
    }
  }

  flatten() {
    let data = this.tickers.flatten()
    data.symbol = this.commodity.symbol
    data.meanBid =  this.meanBid
    data.meanAsk =  this.meanAsk
    return data
  }

  strip(blackList=['medianBid', 'medianAsk', 'modeBid', 'modeAsk',
    'stdevBid','stddevAsk', 'varianceBid', 'varianceAsk', 'tickers']) {
    let data = {}
    let tickers = this.tickers.asArraySorted()
    for (let prop in this) {
      if (blackList.indexOf(prop) == -1) {
        data[prop] = this[prop]
      }
    }
    /* NaN is possible? too slick for me
    data.min = tickers.reduce((acc, cur) => Math.min(acc.price, cur.price), -Infinity)
    data.max = tickers.reduce((acc, cur) => Math.max(acc.price, cur.price), -Infinity)
    */
    /*
    data.oom = math.evaluate('o = floor(log(x, 10))', scope)
    data.levelCoefficient = math.evaluate('c = 1 / 10 ^ o', scope)
    data.adjustedMean =  math.evaluate('am = x * c', scope)
    data.adjustedRange = math.evaluate('ar = r * am', scope)
    */
    return data
  }
}


class Spreads extends IxDictionary {
  constructor(initial = null, options = null) {
    super(initial, options)
  }
  set(key = null, spread = null) {
    if (!this.has(key)) {
      return super.set(spread.commodity.symbol, spread)
    }
    this.merge(key, spread)
  }
  merge(key = null, spread = null) {
    assert.instanceOf(spread, Spread, 'Spread.add, heterogeneous collection not allowed.  don\'t know what to do with a: '+typeof spread)

    super.set(key, new Spread(spread, this[key]))

  }
  asTable() {
    let table = []
    for (let spread of this) {
      let data = spread.flatten()
      table.push(spread.flatten())
    }
    return table
  }
  asTableRaw() {
    let table = []
    for (let spread of this) {
      let data = spread.flatten()
      
      table.push(spread.flatten())
    }
    return table
  }
}

module.exports = {
  Ticker: Ticker,
  Spread: Spread,
  Spreads: Spreads
}
