var chai = require('chai');
var expect = chai.expect;
var should = chai.should;
var assert = chai.assert;
var sinon = require('sinon');
var _ = require('lodash');
var moment = require('moment');
var util = require(__dirname + '/../core/util');
var config = util.getConfig();
var dirs = util.dirs();
var JSON = require('JSON');

//TODO, make actual test cases out of these test cases for automation

/*
config.adapter = 'PGAdaptor';

config.PGAdaptor = {
  path: 'plugins/PGAdaptor',
  version: 0.1,
  connectionString: 'postgres://postgres@mx.ewb.ai:5432', // if default port
  database: 'gekko', // if set, we'll put all tables into a single database.
  schema: 'public',
  tableNamingDelimiter: '_',
  tableNaming: [config.watch.exchange, config.watch.currency, config.watch.asset],
  table: function() {
    let d = config.PGAdaptor.tableNamingDelimiter;
    return config.PGAdaptor.tableNaming.join(d);
  },
  dependencies: [{
    module: 'pg',
    version: '7.4.3'
  }]
}
*/
var pluginParameters = require(dirs.gekko + 'plugins');
var pluginHelper = require(dirs.core + 'pluginUtil');
const pluginMock = {
  slug: 'PostgreSQL Adaptor',
  dependencies: config.PGAdapter.dependencies
}

const cannotLoad = pluginHelper.cannotLoad(pluginMock);
if(cannotLoad) {
  util.die(cannotLoad);
}

let mc = config;
        mc.PGAdapter.asset = 'BTC';
        mc.PGAdapter.currency = 'USD';
        mc.PGAdapter.exchange = 'gdax';

//test plugin load, dB check upon load
var pluginMeta =  _.find(pluginParameters, (o) => {return o.slug == 'candleWriter'})
//var pluginMeta = config.PGAdaptor;
pluginHelper.load(pluginMeta, (e) => {console.log('pluginLoader done(), next() thingy')});

//test scanner
var adapter = config[config.adapter];
var scan = require(dirs.gekko + adapter.path + '/scanner');

scan((err, markets) => {
  if (err)
    console.log("scanner err:"+err);
  console.log(JSON.stringify(markets));
  assert.typeOf(markets, 'array');

});


//reader


