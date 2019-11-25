//# Download the helper library from https://www.twilio.com/docs/python/install
var Rlsepp = require('../librlsepp').Rlsepp;


//# Your Account Sid and Auth Token from twilio.com/console
//# DANGER! This is insecure. See http://twil.io/secure
//var account_sid = 'AC2922705b8b5cacf3bbed29751923005e';
//var auth_token = 'fe08fa7db7cae82dd22de0cc1e9a6ddc';
//var client = Client(account_sid, auth_token);
const rl = Rlsepp.getInstance();

(async function main() {
  var sid = rl.notify("~<?///////>");
  console.log(sid);
})()
