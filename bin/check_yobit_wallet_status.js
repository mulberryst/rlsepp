const puppeteer = require('puppeteer')
  , fs = require("fs")
  , util = require("util")
  , JSON = require("JSON")
;

let outPath = "/home/nathaniel/src/git/rlsepp/data/yobit_wallets.html";
let cookiesPath = '/home/nathaniel/src/git/rlsepp/config/puppeteer_cookiejar';
let writeCookies = false;
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
//    headless: false,
//    slowMo: 250,
//    dumpio: true,
    userDataDir: '/home/nathaniel/.config/puppeteerChrome'
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('puppeteerChrome:', msg.text()));
  // If the cookies file exists, read the cookies.
  try {
    const content = fs.readFileSync(cookiesPath);
    const cookiesArr = JSON.parse(content);
    if (cookiesArr.length !== 0) {
      for (let cookie of cookiesArr) {
        await page.setCookie(cookie)
      }
      console.log('Session has been loaded in the browser')
    }
  } catch(e) {
    console.log('error reading cookies, you need to create new jar');
    console.log(e);
  }
  await page.goto('https://yobit.net/en/wallets');
  await page.evaluate(() => console.log(`url is ${location.href}`));
  await page.waitForSelector('input');

  let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))

  const html = await page.content();
  await page.screenshot({ path: 'yobit_wallets_puppeteer.png', fullPage: true });

  if (writeCookies) {
    do {
      await sleep(5000);
      let cookies = await page.cookies();
      await page.screenshot({ path: 'yobit_wallets_puppeteer.png', fullPage: true });
      let cookiesFile = fs.createWriteStream(cookiesPath, { flags: 'w' });
      cookiesFile.write(JSON.stringify(cookies, null, 4));
    } while (1)
  }
//let outputFile = fs.createWriteStream(outPath, { flags: 'w' });
//  outputFile.write( util.inspect(html, {showHidden: false, depth:null} ));
  fs.writeFileSync(outPath, html);

  await browser.close();
})();
