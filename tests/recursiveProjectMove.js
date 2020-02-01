'use strict';
const config = require('config')
  , Rlsepp = require('./librlsepp').Rlsepp
  , IxDictionary = require('./librlsepp').IxDictionary
  , Spread = require('./librlsepp').Spread
  , Spreads = require('./librlsepp').Spreads
  , verbose = process.argv.includes('--verbose')
  , debug = process.argv.includes('--debug')
  , fs = require("mz/fs")
  , path = require('path')
  , util = require('util')
  , asTable = require ('as-table').configure ({ title: x => x.bright, delimiter: ' | '.dim.cyan, dash: '-'.bright.cyan })
  , asTableLog = require ('as-table').configure ({ title: x => x, delimiter: ' | ', dash: '-' })
  , TreeModel = require('tree-model')
  , LTT = require('list-to-tree')
  , moment = require('moment')
  , JSON = require('JSON')
;

var filename = path.basename(__filename);
var logStdout = process.stdout;
var logStderr = process.stderr;
var now = moment()

console.debug = function () { logStderr.write(util.format.apply(null, arguments) + '\n'); };
console.error = function () { logStderr.write(util.format.apply(null, arguments) + '\n'); };
console.log = function () {
  logStdout.write(util.format.apply(null, arguments) + '\n');
};
console.info = function () { logStdout.write(util.format.apply(null, arguments) + '\n'); };

console.log("Ensure that Crypto/Crypto quotes from exchanges are actually representing the quote currency!")

/*
Map.prototype.toJSON = function () {
    var obj = {}
    for(let [key, value] of this)
        obj[key] = (value instanceof Map) ? Map.toJSON(value) : value;

    return obj
}
*/

const sortBy = (array, key, descending = false) => {
     descending = descending ? -1 : 1
     return array.sort ((a, b) => ((a[key] < b[key]) ? -descending : ((a[key] > b[key]) ? descending : 0)))
}

(async function main() {
  const rl = Rlsepp.getInstance();
//  let ixExchanges = new IxDictionary(["yobit", "livecoin", "gemini", "crex24", "cex"])

  let exchanges
  var myArgs = process.argv.slice(2);
  if (myArgs.length > 1)
    exchanges = myArgs
  else
    exchanges = config.get('exchanges')

  await rl.initAsync(exchanges, {verbose});

  let ixAC = rl.arbitrableCommodities(['USDT'],exchanges)
  let k = [...ixAC.keys()]

  /*
  for (let c of k.sort((a,b) => (a < b)?-1:(a>b)?1:0)) {
    console.log(c+' '+ixAC[c])
  }
  */

  let from = exchanges[0]
  let to = exchanges[1]

  let table = await rl.fetchArbitrableTickers(ixAC, ['USD'])

  let tickerByExchange = new IxDictionary()
  for (let e of exchanges) {
    tickerByExchange[e] = new IxDictionary()
  }
  for (let row of table) {
    tickerByExchange[row.exchange][row.symbol] = row
  }


  rl.basis['USD'].value = 500
//  let wt = rl.basis.clone()
  let wallet = new IxDictionary( {
//    "LSK": {symbol: "LSK", value:1248.43636513, exchange:"yobit"},
//    "ZEC": {symbol: "ZEC", value:29.51168300, exchange:"livecoin"},
    "USD": {symbol: "USD", value:800, exchange: "livecoin"}
  })


  let level = 1
  let direction = null
  let treeRoot = null
  for (let spread of spreads) {
    treeRoot = rl.projectMoveToTree(wallet.clone(), spread, direction, treeRoot)
  }

  level = level * 100
  let cryptoWallets = treeRoot.all(function (node) {
    return node.model.id > level;
  });
  for (let node of cryptoWallets) {
    for (let spread of spreads) {
      rl.projectMoveToTree(node.model.wallet.clone(),spread, direction, node)
    }
  }

  level = level * 100
  cryptoWallets = treeRoot.all(function (node) {
    return node.model.id > level;
  });
  for (let node of cryptoWallets) {
    for (let spread of spreads) {
      rl.projectMoveToTree(node.model.wallet.clone(),spread, direction, node)
    }
  }

/*
    let c = spread.commodity.name
    let address = rl.depositAddress(exchanges[1], c)
    if (address != null && wallet.has(c)) {
      let nextId = (ledgerNode.model.id  * 10) + (ledgerNode.children.length + 1)
      let action = {action:'move', from_exchange: exchanges[0], to_exchange: exchanges[1], symbol: c, amount: wallet[c].value, amountType: c, fee: 12.3456789}

      console.log(JSON.stringify(action, null, 4))

//      ledgerNode.addChild(ledgerTree.parse({id: nextId, wallet:wallet, action: action}))
    }
    */

  let endGame = treeRoot.all(function (node) {
    return node.model.wallet['USD'].value > 0;
  });

  for (let node of endGame.sort((a,b) => 
    ((a.model.wallet.USD.value < b.model.wallet.USD.value) ? -1 : (a.model.wallet.USD.value > b.model.wallet.USD.value) ? 1 : 0))
  ) {
    let path = node.getPath()
    /*
    let ixPath = new IxDictionary(path)
    for (let [from,to] of ixPath.Iterable('fromTo')) {
      console.log("from "+JSON.stringify(from)+" to "+JSON.stringify(to))
    }
    */

    let tweet = ""
    for (let n of path) {
      let a = n.model.action
      if (typeof a !== 'undefined') {
        if (a.action == 'buy' || a.action == 'sell')
          tweet = tweet + util.format("%s %s %s/%s %s %d |", a.action, a.exchange, a.amountType, a.costType, a.priceType, a.price); 
        if (a.action == 'move')
          tweet = tweet + util.format("%s %s from %s to %s |", a.action, a.amountType, a.from_exchange, a.to_exchange); 
      }
    }
    tweet = tweet + util.format("%d", node.model.wallet.USD.value);
    console.log(tweet)
  }

})()
