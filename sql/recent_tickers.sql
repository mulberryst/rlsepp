select exchange,age from (SELECT exchange,floor(EXTRACT(EPOCH FROM (now() - max(datetime)))) as age from tickers group by exchange) sq group by sq.exchange,sq.age having sq.age < 600 ;
