const _ = require('lodash');
const fs = require('fs');
const request = require('request-promise');
const Promise = require('bluebird');

request({
  url: 'https://yobit.net/api/3/info',
  headers: {
    Connection: 'keep-alive',
    'User-Agent': 'Request-Promise',
  },
  json: true,
})
.then(body => {
  if (!body) {
    throw new Error('Unable to fetch list of assets, response was empty');
  }

  return body;
})
.then(results => {
  let marketKeys = [];
  let assets = _.uniq(_.map(_.keys(results.pairs), pairs => {
    let p = _.split(pairs.toUpperCase(),'_');
    marketKeys.push({asset: p[1], currency: p[0], book: pairs, minimalOrder: {amount:results.pairs[pairs].min_amount, unit: 'asset'}});
    return p[1];
  }));
  let currencies = _.uniq(_.map(_.keys(results.pairs), pairs => {
    return _.split(pairs.toUpperCase(),'_')[0];
  }));

  let markets = _.map(marketKeys, market => {
    return {
      pair: [
        market.currency,
        market.asset
      ],
      minimalOrder: market.minimalOrder,
      book: market.book,
    };
  });

  return { assets: assets, currencies: currencies, markets: markets };
})
.then(markets => {
  fs.writeFileSync('../../wrappers/yobit-markets.json', JSON.stringify(markets, null, 2));
  console.log(`Done writing YoBit market data`);
})
.catch(err => {
  console.log(`Couldn't import products from YoBit`);
  console.log(err);
});

  
