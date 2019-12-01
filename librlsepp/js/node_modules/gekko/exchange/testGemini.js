'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var GeminiAPI = _interopDefault(require('gemini-api'));

let key = '', secret = '';
const restClient = new GeminiAPI({ key, secret, sandbox: false });
const websocketClient =
  new GeminiAPI.WebsocketClient({ key, secret, sandbox: false });
 
restClient.getOrderBook('btcusd', { limit_asks: 10, limit_bids: 10 })
  .then(console.log)
  .catch(console.error);

function doSomethingCool() {
}

websocketClient.openMarketSocket('btcusd', () => {
  websocketClient.addMarketMessageListener(data =>
    doSomethingCool(data)
  );
});
 
// The methods are bound properly, so feel free to destructure them:
const { getTicker } = restClient;
const { getAllSymbols } = restClient;

getAllSymbols()
  .then(data =>
    console.log(data)
  );

/*
getTicker('btcusd')
  .then(data =>
    console.log(`Last trade: $${data.last} / BTC`)
  );
*/

