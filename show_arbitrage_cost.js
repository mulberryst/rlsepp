'use strict';
const config = require('config')
  , RLSEPP = require('./librlsepp').Rlsepp
  , IxDictionary = require('./librlsepp').IxDictionary
  , Spread = require('./librlsepp').Spread
  , Spreads = require('./librlsepp').Spreads
  , verbose = process.argv.includes('--verbose')
  , debug = process.argv.includes('--debug')
  , fs = require("fs")
  , path = require('path')
  , util = require('util')
  , asTable = require ('as-table').configure ({ title: x => x.bright, delimiter: ' | '.dim.cyan, dash: '-'.bright.cyan })
  , asTableLog = require ('as-table').configure ({ title: x => x, delimiter: ' | ', dash: '-' })
  , TreeModel = require('tree-model')
  , LTT = require('list-to-tree')
  , moment = require('moment')
;

var filename = path.basename(__filename);
var logStdout = process.stdout;
var logStderr = process.stderr;
var now = moment()
var logFile = fs.createWriteStream('/home/nathaniel/log/' + filename+'.'+now.format('YYYYMMDD.HHmm')+'.log', { flags: 'w' }); 
var logFile2 = fs.createWriteStream('/home/nathaniel/log/synopsis.'+now.format('YYYYMMDD.HHmm')+'.log', { flags: 'w' }); 

console.debug = function () { logStderr.write(util.format.apply(null, arguments) + '\n'); };
console.error = function () { logStderr.write(util.format.apply(null, arguments) + '\n'); };
console.log = function () {
  logStdout.write(util.format.apply(null, arguments) + '\n');
};
console.spread = function () { logFile.write(util.format.apply(null, arguments) + '\n'); };
console.paths = function () {
  logFile2.write(util.format.apply(null, arguments) + '\n');
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
  const rl = RLSEPP.getInstance();
  var apiCreds = config.get('gekko.pathing');
  await rl.initAsync(apiCreds, {verbose});
//  console.json(rl.e);

/*
  const apiBalances = await rl.fetchBalances();
  let printNice = asTable(sortBy(table, Object.values(table), 'value'))
  console.log(printNice)
  */
  //let printNice = asTable(sortBy(symbolHistogram.keys()
//    , Object.values(table), 'value'))
//  let table = rl.arbitrableCommodities().asTable()
//  console.log( asTable( table ) )

  let ledger = []
//  for (let base of ['USD', 'BTC', 'LTC', 'ETH', 'ZEC', 'XRP',]) {
    let listAC = rl.arbitrableCommodities()
    console.log(listAC)
    let table = await rl.fetchArbitrableTickers(listAC)
    //console.log( table )


    let spreads = rl.deriveSpreads( table )

/*
    for (let spread of spreads) {
      console.log('%j', spread.strip(['commodity']))
    }
    */

//Utilizing an N-ary tree data type for spreads to emulate the functionality of a 
//  wallet might be the way to go for projections.
//
  //  then the n-th leaf would be i of the chain
//
//    let path = new TreeModel({modelComparatorFn:sortSpread)
//    let path = new TreeModel()
//    let root = path.parse({children:[]})

    spreads = rl.projectMoves(rl.basis.clone(),spreads)
    
    for (let spread of spreads) {
      if (spread.amount > 0) {
        console.spread(spread.strip(['tickers']))
      }
    }

    let wallet = rl.basis.clone()
    let ledgerTree =  new TreeModel()
    let ledgerRoot = ledgerTree.parse({id:'1', wallet: wallet})

    let symbolForPriceRange = new IxDictionary()

    for (let spread of spreads) {
      symbolForPriceRange.set(spread.commodity.name, {min: spread.min, max: spread.max})
      if (spread.commodity.value > 0) {
        //  rl.basis hold minimim values of tradable currencies 
        //  used by projectMove to determine a buy
        //
        if (!rl.basis.has(spread.commodity.name)) {
          rl.basis[spread.commodity.name] = spread.commodity
          rl.basis[spread.commodity.name].price = spread.min
          rl.basis[spread.commodity.name].cost_basis = spread.cost
        }
      }
    }

  //  the amount of 1000 dollars in all base currencies
  //  at the moment tickers were fetched
  //
//  console.log(rl.basis)

  let ledgerNode = ledgerRoot
  let actual = new IxDictionary(wallet)
  for (let spread of spreads) {
    console.spread(spread.strip(['tickers']))
    while (spread.ledger.length > 0) {

      let action = spread.ledger.pop()
      let w = new IxDictionary(actual)

      w[spread.commodity.name] = {...spread.commodity}
      if (action.action == 'buy') {
        w[action.costType].value -= (action.cost + action.fee)
      } else if (action.action == 'sell') {
        //buy must occour first, hence no wallet init for currency type
        //
        w[action.costType].value += (action.cost + action.fee)
      }
      let nextId = (ledgerNode.model.id  * 100)+ (ledgerNode.children.length + 1)
      ledgerNode.addChild(ledgerTree.parse({id: nextId, wallet:w, action: action}))
    }
  }

  let cryptoWallets = ledgerRoot.all(function (node) {
    return node.model.id > 100;
  });
  for (let node of cryptoWallets) {
    spreads = rl.projectMoves(node.model.wallet,spreads)
    for (let spread of spreads) {
      console.spread(spread.strip(['tickers']))
      while (spread.ledger.length > 0) {
        let action = spread.ledger.pop()
        let w = new IxDictionary(node.model.wallet)

        w[spread.commodity.name] = {...spread.commodity}
        if (action.action == 'buy') {
          w[action.costType].value -= (action.cost + action.fee)
        } else if (action.action == 'sell') {
          w[action.costType] = {name: action.costType, symbol: action.costType}
          w[action.costType].value = (action.cost - action.fee)
        }
        let nextId = (node.model.id  * 100)+ (node.children.length + 1)
        node.addChild(ledgerTree.parse({id: nextId, wallet:w, action: action}))
      }
    }
  }

  let round3 = ledgerRoot.all(function (node) {
    return node.model.id > 10000;
  });
  for (let node of round3) {
    spreads = rl.projectMoves(node.model.wallet,spreads, 'sell')
    for (let spread of spreads) {
      while (spread.ledger.length > 0) {
        let action = spread.ledger.pop()
        let w = new IxDictionary(node.model.wallet)

        w[spread.commodity.name] = {...spread.commodity}
        if (action.action == 'buy') {
          w[action.costType].value -= (action.cost + action.fee)
        } else if (action.action == 'sell') {
          w[action.costType] = {name: action.costType, symbol: action.costType}
          w[action.costType].value = (action.cost - action.fee)
        }
        let nextId = (node.model.id  * 100)+ (node.children.length + 1)
        node.addChild(ledgerTree.parse({id: nextId, wallet:w, action: action}))
      }
    }
  }

  let endGame = ledgerRoot.all(function (node) {
    return node.model.wallet['USD'].value > 1000;
  });

  for (let node of endGame) {
    let path = node.getPath()
    for (let n of path) {
      let a = n.model.action
      if (typeof a !== 'undefined')
        console.paths("%s [%d] %s on %s for [%d] %s at [%d]",
          a.action, a.amount, a.amountType, a.exchange, a.cost, a.costType, a.price)
    }
    console.paths("result in USD: ",node.model.wallet.USD.value)
  }


  //ledgerNode.walk({strategy: 'breadth'}, node => console.log(node))

   // console.log(util.inspect(ledgerNode,false, null, true))


/*
    var ltt = new LTT(rl.ledger, {
        key_id: 'id',
        key_parent: 'parent'
    });
    var tree = ltt.GetTree();

    console.log(util.inspect(tree,false, null, true))
    */
  /*
    for (let [sym, c] of wallet.entries()) {
      console.log(c.ledger)
      console.log(c.symbol, c.value)
    }
*/

  /*
    moves2 = rl.projectMoves(wallet, spreads)
    for (let spread of sortBy(moves2.filter(spread => spread.amount > 0), 'valueUSD', false)) {
      console.log(spread.strip(['commodity','tickers']))
 //     moves2 = rl.projectMoves(rl.basis,spreads)
    }

    for (let [sym, c] of wallet.entries()) {
      console.log(c.ledger)
      console.log(c.symbol, c.value)
    }
*/

  /*
    for (let spread of sortBy(moves2.filter(spread => spread.amount > 0), 'valueUSD', false)) {
      console.log(spread.strip(['commodity','tickers']))
    }
*/
//  console.log(out.sort((a, b) => 
//  console.log(asTableLog( spreads.asTable() ))
//  asTable.configure ({ print: x => (typeof x === 'boolean') ? (x ? 'yes' : 'no') : String (x) }) (data)

  /*
  for (let r of ixDict) {
    console.log(r.name)
    let tickerTable = r.tickers
    rl.showTickers(tickerTable)
  }
  */
//  await rl.showDerivedWallet()
})()
