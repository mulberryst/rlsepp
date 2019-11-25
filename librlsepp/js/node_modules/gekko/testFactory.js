
var _ = require('lodash');

class A {
  constructor(fooVal) {
    _.bindAll(this);
    this.foo = fooVal;
    this.bar = null;
    this.moment = null;
    this.JSON = null;
  }
  init() {
    this.bar = 'hello world';
    this.moment = require('moment');
    this.JSON = require('JSON');
    console.log(this.JSON.stringify(this));
  }
}

class AFactory {
  static async create() {
    return new A(await Promise.resolve('fooval'));
  }
  static async createInit() {
    var a = new A(await Promise.resolve('fooval'));
    a.init()
    return a;
  }
}

(async function generate() {
  const aObj = await AFactory.create();
  console.log(aObj);
})();

(async function init() {
  const aObj = await AFactory.createInit();
  console.log(aObj);
})();
