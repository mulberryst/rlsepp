const fs = require('fs');
var sendmail = require('sendmail')({
  silent: true,
  dkim: {
    privateKey: fs.readFileSync('./tests/mail.pem', 'utf8'),
    keySelector: ''
  }
})

sendmail({
    from: 'nathaniel@iewb.ai',
    to: 'nate.lally@gmail.com',
    subject: 'test sendmail',
    html: 'Mail of test sendmail ',
  }, function(err, reply) {
    console.log(err && err.stack);
    console.dir(reply);
});
