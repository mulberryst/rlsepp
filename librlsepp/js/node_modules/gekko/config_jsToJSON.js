const JSON = require('JSON')
;

try {
  var config = require('./'+process.argv[2]);
  console.log(JSON.stringify(config, null, 2));
} catch(e) {
  console.log("call with config file, pipe to file\n", e)
};
