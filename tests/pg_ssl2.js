'use strict';
require('dotenv').config()
const { Pool, Client } = require('pg')
	, { parseSsl } = require('pg-ssl')
;


let c = new Client({ssl:parseSsl()});
let options = Object.assign({}, c.connectionParameters)

const pool = new Pool({
    ssl: parseSsl(),
    log: (msg) => {console.log(msg)}
})

pool.on('error', function (err) {
    console.log('idle client error', err.message, err.stack)
})

;(async function main() {
  console.log('pool query results');
  console.log(pool);
  const result = await pool.query(`SELECT now()`);
  console.log(result)
  })();
