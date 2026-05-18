'use strict';
const Getopt = require('node-getopt')
  , Rlsepp = require('librlsepp').Rlsepp
  , Wallet = require('librlsepp/js/lib/wallet').Wallet
  , WalletEntry = require('librlsepp/js/lib/wallet').WalletEntry
  , Event = require('librlsepp').Event
  , Events = require('librlsepp').Events
  , verbose = process.argv.includes('--verbose')
  , fs = require("mz/fs")
  , util = require('util')
  , TreeModel = require('tree-model')
  , log = require('ololog')
;

const logStdout = process.stdout;
const logStderr = process.stderr;

console.debug = function () { logStderr.write(util.format.apply(null, arguments) + '\n'); };
console.error = function () { logStderr.write(util.format.apply(null, arguments) + '\n'); };
console.info  = function () { logStdout.write(util.format.apply(null, arguments) + '\n'); };

const DEBUG = true;
const dbg = DEBUG ? (...a) => log(...a) : () => {};

log("Ensure that Crypto/Crypto quotes from exchanges are actually representing the quote currency!");

function walletFromEvent(event = null) {
  let wallet = new Wallet();
  let currency = null;
  let amount = 0;
  if (event && event.exchange && event.amountType && event.amount && event.amount > 0) {
    if (event.action == "buy") {
      currency = event.amountType;
      amount = event.amount;
    }
    if (event.action == "sell") {
      currency = event.costType;
      amount = event.cost;
    }
    wallet.add(new WalletEntry({ currency, value: amount, exchange: event.exchange }));
  }
  return wallet;
}

let getopt = new Getopt([
  ['b', 'costbasis',     'seed buys with 1k usd'],
  ['t', 'to=ARG',        'ends on exchange'],
  ['x', 'exchanges=ARG', 'only use exchanges listed'],
  ['f', 'file=ARG',      'transaction file to draw from'],
  ['w', 'write=ARG',     'file name to write output'],
  ['h', 'help',          'display this help'],
  ['v', 'version',       'show version']
]).bindHelp();

let opt = getopt.parse(process.argv.slice(2)).options;
console.info({ argv: opt.argv, options: opt.options });
log(opt);

let seedEntry = { currency: "USD", value: 1000 };
if (opt.from) seedEntry.exchange = opt.from;

const beginsOn = new Set();
const endsOn = new Set();
if (opt.to) endsOn.add(opt.to);

(async function main() {
  const rl = Rlsepp.getInstance();
  await rl.initStorable();

  let exchanges = rl.getCurrentTickerExchanges();
  if (opt.exchanges) {
    exchanges = opt.exchanges.split(/ /);
    console.log(exchanges);
  }

  await rl.initAsync(exchanges, { verbose });

  // unused result, but retained for side effects parity with prior versions
  rl.arbitrableCommodities(['USDT']);

  let level = 1;
  const spreads = rl.deriveSpreads();

  let wallet;
  if (opt.costbasis) {
    wallet = new Wallet(new WalletEntry(seedEntry));
  } else {
    wallet = await rl.showBalances(spreads);
  }

  let tree = new TreeModel({ modelComparatorFn: (a, b) => { a.index - b.index; } });
  let root = tree.parse({ id: '1', wallet: null });
  log(JSON.stringify(root, null, 4));
  let treeNode = root;

  let transactions = null;
  let nodeCount = 0;

  if (opt.all) {
    const wq = 'USD';
    for (let e of rl.getCurrentTickerExchanges()) {
      if (opt.to && e == opt.to) continue;
      for (let symbol of rl.exchangeMarketsHavingQuote(e, wq)) {
        let ticker = rl.getTickerByExchange(e, symbol);
        if (ticker == null) {
          rl.dictExchange[e].symbolsByQuote[wq].remove(symbol);
          log("No ticker data from " + e + " for " + symbol);
          continue;
        }
        let leafNode = rl.projectBuyTree(wallet.clone(), e, ticker, treeNode, null, tree);
        log(leafNode);
      }
    }
  } else if (opt.file) {

    let jsonevents = null;
    try {
      const contents = await fs.readFile(opt.file);
      jsonevents = JSON.parse(contents);
    } catch (e) {
      log(e.message);
    }

    transactions = new Events(jsonevents);
    transactions.trimLoss(2);
    const tids = transactions.keysByProfit();

    for (let exchange of transactions.exchangeBeginsOn()) beginsOn.add(exchange);
    for (let exchange of transactions.exchangeEndsOn())   endsOn.add(exchange);
    log("transaction count in file with profits of 2 USD or greater: " + transactions.count());

    for (let exchange of wallet.exchanges()) {
      for (let currency of wallet.currency(exchange)) {

        for (let t of tids) {
          transactions.print(t);

          let ev = transactions.first(t);
          let beginexchange = ev.exchange;

          if (beginsOn.has(exchange)) {
            try {
              let symbol = currency + "/USD";
              let ticker = rl.getTickerByExchange(exchange, symbol);
              if (ticker) {
                let w = new Wallet(new WalletEntry({ currency, value: wallet.valueOf(currency, exchange), exchange }));
                rl.projectSellTree(w, exchange, ticker, treeNode, null, tree);
                nodeCount++;
              }
            } catch (e) {
              // missing market/ticker — control flow, ignore
            }
          }

          for (let symbol of rl.exchangeMarketsHavingQuote(beginexchange, currency)) {
            let ticker = rl.getTickerByExchange(exchange, symbol);
            if (!ticker) continue;
            let w = new Wallet(new WalletEntry({ currency, value: wallet.valueOf(currency, exchange), exchange }));
            rl.projectBuyTree(w, exchange, ticker, treeNode, t, tree);
            nodeCount++;
          }
        }
      }
    }

  } else {

    if (opt.costbasis) {
      const currency = 'USD';
      for (let exchange of exchanges) {
        dbg(exchange + ' ' + currency);
        for (let symbol of rl.exchangeMarketsHavingQuote(exchange, currency)) {
          let ticker = rl.getTickerByExchange(exchange, symbol);
          if (ticker == null) continue;
          let w = new Wallet(new WalletEntry({ currency, value: 1000, exchange }));
          rl.projectBuyTree(w, exchange, ticker, root, null, tree);
          nodeCount++;
        }
      }
    } else {
      for (let exchange of wallet.exchanges()) {
        for (let currency of wallet.currency(exchange)) {
          log(exchange + ' ' + currency);
          const value = wallet.valueOf(currency, exchange);
          for (let symbol of exchanges) {
            let ticker = rl.getTickerByExchange(exchange, symbol);
            let w = new Wallet(new WalletEntry({ currency, value, exchange }));
            rl.projectBuyTree(w, exchange, ticker, treeNode, null, tree);
            nodeCount++;
          }
        }
      }
    }
  }

  //////////
  //  per-level expansion (depth bound by i<2; level multiplier is the algorithm)
  //
  for (let i = 0; i < 2; i++) {
    level *= 1000;
    log("makes it to level " + level + " nodeCount " + nodeCount);

    for (let node of root.all(function (node) { return node.model.id >= level; })) {
      let currency = node.model.wallet.currencyFirst();
      let value = node.model.wallet.valueOf(currency);
      let exchange = node.model.wallet.exchangeOf(currency);

      for (let name of endsOn) {
        let w = new Wallet(node.model.wallet);
        try {
          await rl.projectTransferTree(w, name, currency, node, null, tree);
          dbg('project transfer tree');
          nodeCount++;
        } catch (e) {
          log(e);
        }
      }

      for (let name of rl.dictExchange.keys()) {

        if (node.model.action.action != 'sell' && node.model.action.exchange != name && rl.canWithdraw(exchange, currency)) {
          let symbol = currency + "/USD";
          try {
            let t = rl.getTickerByExchange(name, symbol);
            if (t) {
              let w = new Wallet(new WalletEntry({ currency, value, exchange: name }));
              rl.projectSellTree(w, name, t, node, null, tree);
              nodeCount++;
            }
          } catch (e) {
            // missing market/ticker — control flow, ignore
          }
        }

        for (let symbol of rl.exchangeMarketsHavingQuote(name, currency)) {

          // heuristics — rule out bad transactions
          if (node.model.action.action == 'sell') continue;
          if (name != exchange && !rl.canWithdraw(exchange, currency)) continue;

          let ticker = rl.getTickerByExchange(name, symbol);
          if (typeof ticker === 'undefined') continue;

          let w = new Wallet(new WalletEntry({ currency, value, exchange: name }));
          rl.projectBuyTree(w, name, ticker, node, null, tree);
          nodeCount++;
        }
      }
    }
  }
  level *= 1000;
  log("makes it to level " + level + ", sell (nodeCount " + nodeCount + ")");

  for (let node of root.all(function (node) {
    return (!node.hasChildren() && node.model.action != null);
  })) {
    let exchange = node.model.action.exchange;
    let currency = node.model.wallet.currencyFirst();
    if (!endsOn.has(exchange)) {
      for (let name of endsOn) {
        let w = new Wallet(node.model.wallet);
        try {
          await rl.projectTransferTree(w, name, currency, node, null, tree);
          dbg('project transfer 2');
          nodeCount++;
        } catch (e) {
          // unable to project transfer
        }
      }
    }
  }

  for (let node of root.all(function (node) { return node.model.id >= level; })) {
    let currency = node.model.wallet.currencyFirst();
    let value = node.model.wallet.valueOf(currency);

    if (node.model.action.action == 'sell') continue;

    let exchange = node.model.action.exchange;
    let symbol = currency + "/USD";
    try {
      let t = rl.getTickerByExchange(exchange, symbol);
      if (t) {
        let w = new Wallet(new WalletEntry({ currency, value, exchange }));
        rl.projectSellTree(w, exchange, t, node, null, tree);
        nodeCount++;
      }
    } catch (e) {
      // missing market/ticker — control flow, ignore
    }
  }

  log("nodeCount " + nodeCount);
  log("ends on one of: ");
  log([...endsOn]);

  log("walking tree");
  let ft = new Events();
  for (let node of root.all(function (node) {
    return !node.hasChildren() && node.model.action && node.model.action.action == "sell";
  })) {
    let fkey = node.model.id + "_" + node.model.action.exchange;
    let costTicker = null;
    let path = node.getPath();

    if (path.length < 2 || !path[1].model.action) continue;

    let costBasis = 0; // in USD
    let first = path[1].model.action;
    if (first.costType == "USD") {
      costBasis = first.cost;
    } else {
      try {
        costTicker = rl.getTickerByExchange(first.exchange, first.costType + "/USD");
        costBasis = costTicker.ask * Number(first.cost);
      } catch (e) {
        log(e);
        continue;
      }
    }

    if (Number(node.model.wallet.valueOf("USD", node.model.action.exchange)) > (Number(costBasis) - 50)) {
      let transaction = new Events();
      for (let n of path) {
        let a = n.model.action;
        if (a) {
          a.transaction_tag = fkey;
          transaction.add([new Event(a)], fkey);
        }
      }
      ft.merge(transaction);
    }
  }

  log('event count with USD value > (costBasis + 2)' + ft.count());
  log('correcting events');
  ft = await rl.correctEvents(ft);
  ft = rl.applyExceptionsEvents(ft);

  if (!'costbasis' in opt) {
    ft = await rl.fetchDepositAddresses(ft);
    ft = await rl.checkMoves(ft);
  }

  log('applyExceptions');

  let fileName = "events.transfer." + process.pid + ".json";
  if (opt.write) fileName = opt.write;
  log("writing file " + fileName + " containing " + ft.keys().length + " transactions");

  // Release the tree before serializing — it dominates RSS, and JSON.stringify
  // allocates a single large string. Letting V8 collect the tree first keeps
  // peak memory closer to (output string) instead of (tree + output string).
  root = null;
  treeNode = null;
  tree = null;
  transactions = null;

  const eventFile = fs.createWriteStream(fileName, { flags: 'w' });
  eventFile.end(JSON.stringify(ft));
})();
