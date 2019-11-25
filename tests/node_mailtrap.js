'use strict';

const nodemailer = require('nodemailer');


let transport = nodemailer.createTransport({
    host: 'localhost',
    port: 25
//    auth: {
//       user: 'nathaniel.lally@gmail.com',
//       pass: '1234567'
//    }
});
//With all of that set up, we can go ahead and send our first test email:

const message = {
    from: 'elonmusk@tesla.com', // Sender address
    to: 'nate.lally@gmail.com',         // List of recipients
    subject: 'Design Your Model S | Tesla', // Subject line
    text: 'Have the most fun you can in a car. Get your Tesla today!' // Plain text body
};
transport.sendMail(message, function(err, info) {
    if (err) {
      console.log(err)
    } else {
      console.log(info);
    }
});
