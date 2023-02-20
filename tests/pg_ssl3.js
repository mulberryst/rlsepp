'use strict';
require('dotenv').config()
const { Pool, Client } = require('pg')
	, { parseSsl } = require('pg-ssl')
;

//;(async function main() {

	const c = new Client();
	let options = Object.assign({}, c.connectionParameters);
	options.ssl = parseSsl({
//		checkServerIdentity: true,
		rejectUnauthorized: true,
//		servername: 'db.grandstreet.group',
	});
	options.log = (msg) => { console.log(msg) };
//	options.options = {};
	//const c = new Client({ssl:parseSsl()});

	let pool = new Pool(options);
	console.log(pool);
	/*

	// pools will use environment variables for connection information
	// const pool = new Pool({ ssl: true }); This works too in the absence of PGSSLMODE
	pool.on('error', function (err, client) {
		console.log('idle client error', err.message, err.stack)
	});
	pool.on('connect', (client) => {
		console.log("new pgclient connection ,pid " + client.processID);
	});

//	Object.assign(pool.options, pool.options)
//	console.log(pool);

//	const dbh = await pool.connect();

	*/
//  let client = await pool.connect();
  console.log('connecting');
//	console.log(c.connect);
		//	await c.connect();
		pool.connect( (err, client, done) => {
  if (err) { console.log(err); return done(err); }

  console.log('query');
	  let q = 'select now();';
//	  let q = 'select distinct(exchange) from public.tickers;';
    client.query(q, '', (err, res) => { 
	    done()
	    if (err) {
		    return console.error('query error', e.message, e.stack)
	    }
	    console.log('hello from', res.rows[0].name)
    })
		})
//})()
