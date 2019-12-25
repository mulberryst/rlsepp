'use strict';
const config = require('config')
  , stdio = require('stdio')
  , Rlsepp = require('librlsepp').Rlsepp
  , IxDictionary = require('librlsepp').IxDictionary
  , Spread = require('librlsepp').Spread
  , Spreads = require('librlsepp').Spreads
  , Storable = require('librlsepp').Storable
  , verbose = process.argv.includes('--verbose')
  , debug = process.argv.includes('--debug')
  , fs = require("fs")
  , path = require('path')
  , util = require('util')
  , ansicolor = require('ansicolor')
  , asTable = require ('as-table').configure ({ title: x => x.bright, delimiter: ' | '.dim.cyan, dash: '-'.bright.cyan })
  , asTableLog = require ('as-table').configure ({ title: x => x, delimiter: ' | ', dash: '-' })
  , TreeModel = require('tree-model')
  , moment = require('moment')
  , log = require('ololog')
;

var filename = path.basename(__filename);
var logStdout = process.stdout;
var logStderr = process.stderr;
var now = moment()
var logFileS = fs.createWriteStream('/home/nathaniel/log/spread.log', { flags: 'w' }); 
var logFileT = fs.createWriteStream('/home/nathaniel/log/tickers.log', { flags: 'w' }); 
var logFile = fs.createWriteStream('/home/nathaniel/log/' + filename+'.'+now.format('YYYYMMDD.HHmm')+'.log', { flags: 'w' }); 
var logFile2 = fs.createWriteStream('/home/nathaniel/log/synopsis.'+now.format('YYYYMMDD.HHmm')+'.log', { flags: 'w' }); 
var logFile3 = fs.createWriteStream('/home/nathaniel/log/notice.log', { flags: 'w' }); 

console.debug = function () { logStderr.write(util.format.apply(null, arguments) + '\n'); };
console.error = function () { logStderr.write(util.format.apply(null, arguments) + '\n'); };
console.log = function () {
  logStdout.write(util.format.apply(null, arguments) + '\n');
};
console.spread = function () { logFileS.write(util.format.apply(null, arguments) + '\n'); };
console.tickers = function () { logFileT.write(util.format.apply(null, arguments) + '\n'); };
console.paths = function () {
  logFile2.write(util.format.apply(null, arguments) + '\n');
};
console.fiveAndOver = function () {
  logFile3.write(util.format.apply(null, arguments) + '\n');
};
console.info = function () { logStdout.write(util.format.apply(null, arguments) + '\n'); };

console.log("Ensure that Crypto/Crypto quotes from exchanges are actually representing the quote currency!")

var eventFile= fs.createWriteStream('events.minmax.json', { flags: 'w' }); 

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
  await rl.initStorable()

  let exchanges
  let opt = stdio.getopt({
    'write': {key: 'w', args: 1},
    'min': {key:'m', args:1}
  })
  if (opt.args && opt.args.length > 0) {
    exchanges = opt.args
  } else {
    exchanges = await rl.getCurrentTickerExchanges()
    log(exchanges)
  }

  await rl.initAsync(exchanges, {verbose});

  let ledger = []
//  for (let base of ['USD', 'BTC', 'LTC', 'ETH', 'ZEC', 'XRP',]) {
    let listAC = rl.arbitrableCommodities(['USDT'])
//    console.log(listAC)

  let wt = rl.basis.clone()
  let spreads = rl.deriveSpreads( )

  log (JSON.stringify(spreads,null,4))

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
        //console.spread(spread.strip(['tickers']))
        console.spread(spread)
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
      let nextId = (ledgerNode.model.id  * 1000)+ (ledgerNode.children.length + 1)
      ledgerNode.addChild(ledgerTree.parse({id: nextId, wallet:w, action: action}))
    }
  }

  let cryptoWallets = ledgerRoot.all(function (node) {
    return node.model.id > 1000;
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
        let nextId = (node.model.id  * 1000)+ (node.children.length + 1)
        node.addChild(ledgerTree.parse({id: nextId, wallet:w, action: action}))
      }
    }
  }

  let round3 = ledgerRoot.all(function (node) {
    return node.model.id > 1000000;
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
        let nextId = (node.model.id  * 1000)+ (node.children.length + 1)
        node.addChild(ledgerTree.parse({id: nextId, wallet:w, action: action}))
      }
    }
  }

  let min = 950
  if (opt.min)
    min = opt.min
  let endGame = ledgerRoot.all(function (node) {
    return node.model.wallet['USD'].value > min;
  });

  //  
  //
  var message = [];
  message.push(moment().format('LLLL'));

  let transaction = {}
  //  sort endGame projections by highest resulting USD 
  //
  for (let node of endGame.sort((a,b) => 
    ((a.model.wallet.USD.value < b.model.wallet.USD.value) ? -1 : (a.model.wallet.USD.value > b.model.wallet.USD.value) ? 1 : 0))
  ) {
    let path = node.getPath()

    //  within a periodicity of one hour, a good rule of thumb is 4000
    //
    //if ((node.model.wallet.USD.value >= 955) && (node.model.wallet.USD.value <= 4000))

    let events = []
    if ((node.model.wallet.USD.value <= 5000))
    {
      var tweet = node.model.id+" "
//      /* Altcoin/Centralized/4k max */
//                "sell from your Twilio trial account"
      for (let n of path) {
        let a = n.model.action
        if (typeof a !== 'undefined') {
          a.id = n.model.id
          events.push(a)
          tweet = tweet + util.format("%d %s %s %s/%s %s %d |", 
            n.model.id, a.action, a.exchange, a.amountType, a.costType, a.priceType, a.price); 
        }
      }
      tweet = tweet + util.format("%d", node.model.wallet.USD.value);
      message.push(tweet);
      transaction[node.model.id] = events
    }

  }
//  rl.notify(message.join("\n"), 'synopsis');
  console.log(message.join("\n"));

  let fileName = 'events.minmax.json'
  if (opt.write)
    fileName = opt.write
  var eventFile= fs.createWriteStream(fileName, { flags: 'w' }); 
  eventFile.write(JSON.stringify(transaction, null, 4))

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
