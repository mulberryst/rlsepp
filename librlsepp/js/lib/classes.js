const chai = require('chai');
var expect = chai.expect;
var should = chai.should;
var assert = chai.assert;
/*
   let foo = new List(1,2,3,4)
   let bar = {cool: 'kids'}
   foo['hash'] = 'a bird flies through the mountains';
   foo['hashkey'] = bar;
   console.log(JSON.stringify(foo));
 
 */
class List extends Array {
  constructor(...items) {
    super(...items);

    this.hash = {};
//    [ ...arr, newEntry ]
 //   console.log(arguments);
    return new Proxy(this, {
      set: function( target, name, value ) {
        target.hash[name] = value;
      },
      get: function(target, name) {
        /*
        if (name == 'length')
          return Infinity;
          */
        if (name in target)
          return target[name];
        if (name in target.hash)
          return target.hash[name];
      }
    })
  }
  map_filter() {
  }
  each() {

  }
//  toJSON () {}
}
/*
 https://stackoverflow.com/questions/1711357/how-would-you-overload-the-operator-in-javascript

var handler = {
    get: function(target, name) {
        return "Hello, " + name;
    }
};
var proxy = new Proxy({}, handler);

console.log(proxy.world); // output: Hello, world
*/

const _type = ['fiat', 'crypto']
class Commodity {
  constructor(args) {
    this.symbol = (args['symbol'] != null) ? args['symbol'] :null
    this.value = null
    this.name = null
    this.api = null
    this.withdraw = null
    this.deposit = null
    assert.isNotNull(name, "Commodity:constructor called with no symbol")
  }
}

class Exchange  {
  constructor() {
    //hashing ?  
    this.ccxt = new Dictionary();
    this.marketData = new Dictionary();
  }
  init() {
  }
}


class Address {
  constructor() {
    this.exchange = null; //?
    return new Proxy(this, {
      set: function( target, name, value ) {
        target.hash[name] = value;
      },
      get: function(target, name) {
        /*
        if (name == 'length')
          return Infinity;
          */
        if (name in target)
          return target[name];
        if (name in target.hash)
          return target.hash[name];
      }
    })
  }
}

class Transfer {
  constructor() {
  }
}

class Exchange  {
  constructor() {
    //hashing ?  
    this.ccxt = new Dictionary();
    this.marketData = new Dictionary();
  }
  init() {
  }
}


class Pair {
  constructor() {
    this.array = []
    return new Proxy(this, {
      set: function( target, name, value ) {
        target.hash[name] = value;
      },
      get: function(target, name) {
        /*
        if (name == 'length')
          return Infinity;
          */
        if (name in target)
          return target[name];
        if (target.hash.has(name))
          return target.hash[name];
      }
    })
  }
}

Object.setPrototypeOf(List.prototype, Array.prototype);
module.exports = {
  Pair: Pair,
  Transfer: Transfer,
  Address: Address,
  Commodity: Commodity
}
