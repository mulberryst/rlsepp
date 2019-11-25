'use strict' 
const Dictionary = require("dictionaryjs").Dictionary
  , functions = require('./functions')
  , util = require('util')
;

const {
  isArray, 
  isObject, 
  isIterable, 
  isAsyncIterable,
  asyncForEach,
  sortBy,
} = functions

const itKeyVal = (keys) => {
  let self = this;
  return { "alert": "exposes Symbol.iterator, use with (for ... of) loop",
    [Symbol.iterator]: function* () {
      let keys = self.getKeys(); //Object.keys(this);
      for (let key of keys) {
        yield [key, self[key]];
      }
    }
  };
}

//  added asyncIterator
//
//  TODO: add various shortcuts for sort
//
class IxDictionary extends Dictionary {

  constructor(initial = null, options = null) {
    super(initial, options)
    this.__private__.index=0

    this.__private__.asyncIterator = {}
    this.__private__.iterator = {}
    this.__private__.iterator.fromTo = () => {
      let self = this
      return function* () {
        const k = self.keys()
        for (let i = 1; i < k.length; i++) {
          yield [self[k[i-1]],self[k[i]]];
        }
      };
    }
    this.__private__.asyncIterator.fromTo = () => {
      let self = this
      let k = self.keys()
      self.__private__.index = 1
      return {
        "alert": "exposes Symbol.iterator, use with (for ... of) loop",
        next: () => {
          if (self.__private__.index >= k.length) {
            return Promise.resolve({ done: true });
          }
          let i = self.__private__.index++
          const [from,to] = [self[k[i-1]],self[k[i]]];
          return Promise.resolve({ value: [from,to], done: false });
        }
      };
    }
    this.__private__.asyncIterator.fromToRoundRobin = () => {
      let self = this
      let k = self.keys()
      k.push(k[0])
      return {
        "alert": "exposes Symbol.iterator, use with (for ... of) loop",
        next: () => {
          if (k.length == 1)
            return Promise.resolve({ done: true });
          let [fk, tk] = [k.shift(), k[0]]
          const [from,to] = [self[fk],self[tk]];
          return Promise.resolve({ value: [from,to], done: false });
        }
      };
    }
    this.__private__.asyncIterator.fromToCirc = () => {
      let self = this
      let k = self.keys()
      let begin = k[0]
      return {
        "alert": "exposes Symbol.iterator, use with (for ... of) loop",
        next: () => {
          let [fk, tk] = [k.shift(), k[0]]
          k.push(fk)
          const [from,to] = [self[fk],self[tk]];
          return Promise.resolve({ value: [from,to], done: false });
        }
      };
    }
    this.__private__.iterator.sequential = () => {
      let self = this
      return function* () {
        for (let key of self.keys()) {
          yield self[key];
        }
      };
    }
    this.__private__.iterator.fromTo = () => {
      let self = this
      self.__private__.index = 0
      return function* () {
        let k = self.keys()
        for (let i = 1; i < k.length; i++) {
          yield [k[i-1], k[i]]
        }
      };
    }

    this[Symbol.asyncIterator] = this.__private__.asyncIterator.fromTo
    this[Symbol.iterator] = this.__private__.iterator.sequential()
    /*
    this.__private__.comparator = function* (a,b) {
      (this[a] < this[b]) ? -1 : (this[a] > this[b]) ? 1 : 0
    };
    */

  }

  // dynamic iterator management
  //
  Iterable(iterator='fromTo') {
    let self = this
    let r = {
      "alert": "exposes Symbol.iterator, use with (for ... of) loop"
    };

    if (Object(self.__private__.iterator).hasOwnProperty(iterator))
      r[Symbol.iterator] = self.__private__.iterator[iterator]()

    if (Object(self.__private__.asyncIterator).hasOwnProperty(iterator))
      r[Symbol.asyncIterator] = self.__private__.asyncIterator[iterator]
    return r
  }

  //override copy by ref of Dictionary with copy by value
  _copyValues(initial) {
    for (let prop in initial) {
      if (initial.hasOwnProperty(prop)) {
        if (isObject(initial[prop])) {
          this[prop] = {...initial[prop]};
        } else {
          this[prop] = initial[prop];
        }
      }
    }
  }
  
  hasComparator() {
    return typeof this.__private__.comparator === 'function';
  }
  comparator(func) {
    if (typeof func === 'function') {
      this.__private__.comparator = func
    }
    this.__private__.comparator
  }
  clone() {
    return new IxDictionary(this)
  }
  pretty(blacklist = []) {
    return this.asTable(blacklist)
  }
  propertyBlacklist() {
    return []
  }
  asTable(blacklist = []) {
    let table = []
    let row = {}
    for (let [key, el] of this.entries()) {

      if (blacklist.indexOf(key) == -1) {
        row[key] = el
        if (IPretty.isImplementedBy(el)) {
          row[key] = el.pretty()
        }
        table.push(row)
      }
    }
    return table
  }
}

module.exports = IxDictionary
