var pg = require("pg");

var client = new pg.Client({
	  user: "app",
	  password: "",
	  database: "rlsepp",
	  port: 5432,
	  host: "db.grandstreet.group",
	  ssl: true
});

client.connect();

var query = client.query('select now();');

query.on('row', function(row) {
	  console.log(row.name);
});

query.on('end', client.end.bind(client));
