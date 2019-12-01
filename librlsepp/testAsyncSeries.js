

var _ = require('lodash');
var async = require('async');

class A {
  constructor(fooVal) {
    _.bindAll(this);
    this.foo = fooVal;
    this.bar = null;
    this.moment = null;
    this.JSON = null;
    this.list = [];
    this.plugins = [];
  }
  init() {
    this.bar = 'hello world';
    this.moment = require('moment');
    this.JSON = require('JSON');
    this.list = ['moment', 'JSON'];
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
  static async loadPlugins(A) {
    await async.mapSeries(
      A.list,
      require,
      function(err, _plugins) {
        if (error)
          return process.exit(1);
        A.list = _.compact(_plugins);
        next();
      }
    );
  }
}
(async function generate() {
  const aObj = await AFactory.createInit();
  AFactory.loadPlugins(aObj);
  console.log(aObj);
})()
