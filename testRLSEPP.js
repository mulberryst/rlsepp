'use strict';
const config = require('config')
  , RLSEPP = require('./lib/rlsepp').Rlsepp
  , verbose = process.argv.includes('--verbose')
  , debug = process.argv.includes('--debug')
  , fs = require("fs")
  , path = require('path')
  , util = require('util')
;

const FILE = "withdraw.json";
var filename = path.basename(__filename);
var logStdout = process.stdout;
var logStderr = process.stderr;
var logFile = fs.createWriteStream(filename+'.log', { flags: 'w' }); 

console.debug = function () {
  logStderr.write(util.format.apply(null, arguments) + '\n');
};
console.error = function () {
  logStderr.write(util.format.apply(null, arguments) + '\n');
};
console.log = function () {
  logStdout.write(util.format.apply(null, arguments) + '\n');
}
console.json = function () {
  logFile.write(util.format.apply(null, arguments) + '\n');
}
console.info = function () {
  logStdout.write(util.format.apply(null, arguments) + '\n');
}


console.debug("Remember, Rihanna's Lingerie On New Years has just as much to do with pricing as yesterday\n");

/*
Map.prototype.toJSON = function () {
    var obj = {}
    for(let [key, value] of this)
        obj[key] = (value instanceof Map) ? Map.toJSON(value) : value;

    return obj
}
*/
function mapToObject(o, m) {
    for(let[k,v] of m) { o[k] = v }
}
function mapToObjectRec(m) {
    let lo = {}
    for(let[k,v] of m) {
        if(v instanceof Map) {
            lo[k] = mapToObjectRec(v)
        }
        else {
            lo[k] = v
        }
    }
    return lo
}

(async function main() {
  const rl = new RLSEPP();
  var apiCreds = config.get('gekko.multitrader');
  await rl.init(apiCreds, {verbose});
  let wallets = {};
  for (let [name, ex] of rl.e) {
    let wallet = {};
    console.json("\""+name+"\": {");
    for(let asset of rl.base.keys())  {
      console.info('checking asset'+asset)
      try {
        var data = await RLSEPP.fetch_create_deposit_address(ex,asset)
        console.json("\t\""+asset+"\": ", data, ",")
        wallet[asset] =data;
      } catch(e) {
        console.json("\t\""+asset+"\": ", '{},');
        wallet[asset] = null;
      };

      /*
      RLSEPP.fetch_create_deposit_address(ex,asset)
        .then((data) => {
          console.json("\t\""+asset+"\": ", data, ",")
          wallet.set(asset,data);
        }).catch((e) => {
          console.json("\t\""+asset+"\": ", '{},');
          wallet.set(asset, null);
        });
        */
    }
    console.json("},");
    wallets[name] = wallet;
  }
  fs.writeFile(FILE, JSON.stringify(wallets, null, 2), err => {
    if (err) 
      console.error(err);
  }); 

})()
