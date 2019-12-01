const _ = require('lodash');
const fs = require('fs');
const request = require('request-promise');
const Promise = require('bluebird');
const JSON = require('JSON');
//https://gemini24.zendesk.com/hc/en-us/articles/205432596-Are-there-trading-minimums-
//
//
let getMinTradeSize = asset => {
  let minTradeSize = 0.001;
  switch (asset) {
  case 'BTC':
    minTradeSize = '0.00001'
    break;
  case 'LTC':
    minTradeSize = '0.01'
    break;
  default:
    break;
  }
  return minTradeSize;
}

/*
let assetPairsPromise = request({
  url: 'https://api.gemini.com/v1/symbols',
  headers: {
    Connection: 'keep-alive',
    'User-Agent': 'Request-Promise',
  },
  json: true,
}).then(body => {
  if (!body || !body.result) {
    throw new Error('Unable to fetch list of assets, response was empty')
  } else if (!_.isEmpty(body.error)) {
    throw new Error(`Unable to fetch list of assets: ${body.error}`);
  }

  return body.result;
});
Promise.all([assetPairsPromise])
  .then(results => {
*/
let mockRequest = results => {
    let assets =  ['BTC','ETH', 'BCH', 'LTC', 'ZEC'];
    let currencies = ['USD', 'BTC', 'ETH', 'BCH', 'LTC'];

    let apiCall = [ 'btcusd', 'ethbtc', 'ethusd', 'bchusd', 'bchbtc', 'bcheth', 'ltcusd', 'ltcbtc', 'ltceth', 'ltcbch', 'zecusd', 'zecbtc', 'zeceth', 'zecbch', 'zecltc' ];
    let books = _.map(apiCall, book => {
      return book.toUpperCase();
    })
    let marketKeys = [];
    _.map(assets, a => {
      _.map(currencies, c => {
//        console.log(a+c);
        if (_.indexOf(books, a+c) > -1)
          marketKeys.push({asset: a, currency: c})
      })
    });

   let markets = _.map(marketKeys, market => {
    return {
      pair: [
       market.currency,
        market.asset
      ],
      minimalOrder: {
        amount: getMinTradeSize(market.asset, market.currency),
        unit: 'asset',
      },
    };
   });

    return { assets: assets, currencies: currencies, markets: markets };
  }
let markets = mockRequest();
console.log(JSON.stringify(markets));
    fs.writeFileSync('../../wrappers/gemini-markets.json', JSON.stringify(markets, null, 2));
    console.log(`Done writing Gemini market data`);
/*
  .then(markets => {
    fs.writeFileSync('../../wrappers/gemini-markets.json', JSON.stringify(markets, null, 2));
    console.log(`Done writing Gemini market data`);
  })
  .catch(err => {
    console.log(`Couldn't import products from Gemini`);
    console.log(err);
  });
  */
