const puppeteer = require('puppeteer')
  , fs = require("fs")
  , process = require("process")
  , util = require("util")
  , JSON = require("JSON")
;

let outPath = "/home/nathaniel/src/git/rlsepp/data/yobit_wallets.html";

let cookiesPath = '/home/nathaniel/src/git/rlsepp/config/mx.ewb.ai.puppeteer_cookiejar.json';
let writeCookies = false;
let headless = false; //for some reason, the logged in session doesn't get picked up in headless mode

process.env.DISPLAY=":1.0";  //tigervnc-server
(async () => {
  if (writeCookies) {
    headless = false;
  }
  const browser = await puppeteer.launch({
    headless: headless,
//    product: 'firefox',
//    executablePath: '/usr/bin/firefox',
    defaultViewport: { width: 1600, height: 900 },
//    extraPrefsFirefox: {
    // Enable additional Firefox logging from its protocol implementation
    // 'remote.log.level': 'Trace',
//    },
//    headless: headless,
//    slowMo: 250,
    dumpio: true, //browser console.log to node console.log
    userDataDir: '/home/nathaniel/.config/puppeteerChrome'
  });
  const page = await browser.newPage();
  const navigationPromise = page.waitForNavigation({waitUntil: "domcontentloaded", timeout: 60000 * 4});
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

  try {
    await page.goto('https://yobit.net/en/wallets', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await navigationPromise;
  } catch (e) {
    if (e instanceof puppeteer.errors.TimeoutError) {
      console.log('timeout on page.goto');
      // Do something if this is a timeout.
    }
  }

try {
  await page.waitForSelector('.rubic', {timeout: 60000 });
} catch (e) {
  if (e instanceof puppeteer.errors.TimeoutError) {
      console.log('timeout on page.waitForSelector');
    // Do something if this is a timeout.
  }
}
  await page.evaluate(() => console.log(`url is ${location.href}`));

  let sleep = (ms) => new Promise (resolve => setTimeout (resolve, ms))
//  sleep(5000);

  const html = await page.content();
  fs.writeFileSync(outPath, html);
  await page.screenshot({ path: 'yobit_wallets_puppeteer.png', fullPage: true });

  if (writeCookies) {
    do {
      await sleep(5000);
      let cookies = await page.cookies();
      let cookiesFile = fs.createWriteStream(cookiesPath, { flags: 'w' });
      cookiesFile.write(JSON.stringify(cookies, null, 4));
    } while (1)
  }
//let outputFile = fs.createWriteStream(outPath, { flags: 'w' });
//  outputFile.write( util.inspect(html, {showHidden: false, depth:null} ));

  await browser.close();
})();
