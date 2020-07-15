const puppeteer = require('puppeteer')
  , fs = require("fs")
  , util = require("util")
  , JSON = require("JSON")
;

let outputFile = fs.createWriteStream("yobit_wallets.html", { flags: 'w' });
(async () => {
//  const browser = await puppeteer.launch({headless: false});
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();
  await page.goto('https://yobit.net/en/wallets');
  await page.waitForSelector('input');
  let html = await page.content();
//  outputFile.write( JSON.stringify(html));
  outputFile.write( util.inspect(html, {showHidden: false, depth:null} ));

  await browser.close();
})();
