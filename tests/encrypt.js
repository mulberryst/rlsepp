/**
 * node-gpg by Mirko Schubert <office@mirkoschubert.de>
 * MIT licensed
 * 
 * This is an example how to enrypt a message with async/ await.
 * In order for this to work you should replace the user and recipient with entries from your gpg keychain!
 */

var gpg = require('node-gpg');

const message = 'jCnPKtH/FxdTGCea77zsaJ4Kt72YTImr1IRWMQ1MOokhtaFnNkX4zpuW7qbMsHEBSwvQf0xnRyJoQFn/oZk0Kg==';
const user = 'rlsepp';
const recipient = 'rlsepp';

async function encrypt() {
  try {
    let result = await gpg.encrypt(message, user, recipient);
    console.log(result);
  } catch (e) {
    console.error(e);
  }
}

encrypt();
