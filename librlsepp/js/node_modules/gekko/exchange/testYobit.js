var options = {
  "key": "",
  "secret": ""
}
 
var Yobit = require('yobit-exchange-api');
var VersionTwo = require('yobit-exchange-api/lib/version_two');
var Trade = require('yobit-exchange-api/lib/trade');
 
var keys = {key: '', secret: ''}
var yobit = new Yobit(keys)
var version2 = new VersionTwo(keys);
var trade = new Trade(keys);
 
trade.getInfo(function(err, data) {
  console.log(data);
})
 
version2.ticker('ltc_btc', function(err, data) {
  console.log(data);
})
 
version2.depth('ltc_btc', function(err, data) {
  console.log(data);
})
 
version2.trades('ltc_btc', function(err, data) {
  console.log(data);
})
 
yobit.fee(['ETH-BTC'], function(err, data) {
  console.log(data);
})
 
yobit.ticker(['ETH-BTC'], function(err, data) {
  console.log(data);
})
 
yobit.depth(['ETH-BTC'], function(err, data) {
  console.log(data);
})
 
yobit.trades(['ETH-BTC'], function(err, data) {
  console.log(data);
})
 
yobit.info(function(err, data) {
  console.log(data);
})
