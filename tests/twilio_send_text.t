//# Download the helper library from https://www.twilio.com/docs/python/install
var Client = require('twilio');


//# Your Account Sid and Auth Token from twilio.com/console
//# DANGER! This is insecure. See http://twil.io/secure
var account_sid = 'ACea33e4e96b2a672cf8e2bbb870b1099e';
var auth_token = '83d10b36c474925d181dc1a032ee7e2b';
var client = Client(account_sid, auth_token);

/*
 client.api.messages
    .create({
      body: message,
      to: to,
      from: config.sendingNumber,
    }).then(function(data) {
      console.log('Administrator notified');
    }).catch(function(err) {
      console.error('Could not notify administrator');
      console.error(err);
    });
    */

//1 619 431 4849
client.messages
      .create({body: 'Hi there!', from: '+16194314849', to: '+16464507917'})
      .then(message => console.log('sent :'+message.sid) )
      .catch(function(err) {
        console.error('issue sending message');
        console.error(err);
      });
