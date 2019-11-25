'use strict' 
const Dictionary = require("dictionaryjs").Dictionary
  , functions = require('./functions')
;

const {
  isArray, 
  isObject, 
  isIterable, 
  isAsyncIterable,
  asyncForEach,
  sortBy,
} = functions

//  TODO: add various shortcuts for sort
//
class IxDictionary extends Dictionary {
  constructor(initial = null, options = null) {
    super(initial, options)
    this[Symbol.iterator] = function* () {
      let keys = this.getKeys(); //Object.keys(this);
      /*
      if (this.hasComparator) {
        keys.sort(this.comparator)
      }
      */
      for (let key of keys) {
        yield this[key];
      }
    };
    /*
    this.__private__.comparator = function* (a,b) {
      (this[a] < this[b]) ? -1 : (this[a] > this[b]) ? 1 : 0
    };
    */

  }
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
