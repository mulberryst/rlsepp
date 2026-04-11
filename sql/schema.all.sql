--
-- PostgreSQL database dump
--

\restrict ExGkTvXKbo43PAPLw2tfGLKwxIr28doLIjXm5ou6mNBAFWB4xdHb0G16hLO9sG6

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

-- Started on 2026-04-10 20:35:35 EDT

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 8 (class 2615 OID 16391)
-- Name: private; Type: SCHEMA; Schema: -; Owner: nathaniel
--

CREATE SCHEMA private;


ALTER SCHEMA private OWNER TO nathaniel;

--
-- TOC entry 9 (class 2615 OID 16392)
-- Name: useraccesscontrol; Type: SCHEMA; Schema: -; Owner: nathaniel
--

CREATE SCHEMA useraccesscontrol;


ALTER SCHEMA useraccesscontrol OWNER TO nathaniel;

--
-- TOC entry 1 (class 3079 OID 17179)
-- Name: plperlu; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS plperlu WITH SCHEMA pg_catalog;


--
-- TOC entry 3866 (class 0 OID 0)
-- Dependencies: 1
-- Name: EXTENSION plperlu; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION plperlu IS 'PL/PerlU untrusted procedural language';


--
-- TOC entry 3 (class 3079 OID 16853)
-- Name: ltree; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA public;


--
-- TOC entry 3867 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION ltree; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION ltree IS 'data type for hierarchical tree-like structures';


--
-- TOC entry 985 (class 1247 OID 16394)
-- Name: action; Type: TYPE; Schema: public; Owner: nathaniel
--

CREATE TYPE public.action AS ENUM (
    'buy',
    'sell',
    'move'
);


ALTER TYPE public.action OWNER TO nathaniel;

--
-- TOC entry 988 (class 1247 OID 16402)
-- Name: created_by_tag; Type: TYPE; Schema: public; Owner: nathaniel
--

CREATE TYPE public.created_by_tag AS ENUM (
    'events_maker',
    'events_pending',
    'mock'
);


ALTER TYPE public.created_by_tag OWNER TO nathaniel;

--
-- TOC entry 991 (class 1247 OID 16410)
-- Name: direction; Type: TYPE; Schema: public; Owner: nathaniel
--

CREATE TYPE public.direction AS ENUM (
    'deposit',
    'withdraw'
);


ALTER TYPE public.direction OWNER TO nathaniel;

--
-- TOC entry 994 (class 1247 OID 16416)
-- Name: typewalletstatus; Type: TYPE; Schema: public; Owner: nathaniel
--

CREATE TYPE public.typewalletstatus AS ENUM (
    'Online',
    'Delayed',
    'Maintenance'
);


ALTER TYPE public.typewalletstatus OWNER TO nathaniel;

--
-- TOC entry 279 (class 1255 OID 16423)
-- Name: audittransaction(); Type: FUNCTION; Schema: public; Owner: nathaniel
--

CREATE FUNCTION public.audittransaction() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
	declare 
	  wsHasTo int;
  	  wsHasFrom int;
	  wsTo typewalletstatus;
  	  wsFrom typewalletstatus;
    BEGIN
        -- Check that empname and salary are given
        IF NEW.action = 'move' THEN
        	wsHasTo := (select count(exchange) from walletstatus where exchange=NEW.exchange);
        	wsHasFrom := (select count(exchange) from walletstatus where exchange=NEW.fromExchange);
        	wsTo := (select status from walletstatus where exchange=NEW.exchange and symbol=NEW.amounttype);
        	wsFrom := (select status from walletstatus where exchange=NEW.fromExchange and symbol=NEW.amounttype);
        	if wsTo != 'Online' and wsHasTo > 0 then
	            RAISE EXCEPTION 'walletstatus for % to % is %', NEW.symbol, NEW.exchange, wsTo;
	        end if; 
           	if wsFrom != 'Online' and wsHasFrom > 0 then
	            RAISE EXCEPTION 'walletstatus for % to % is %', NEW.symbol, NEW.fromExchange, wsFrom;
	        end if; 

        END IF;
        RETURN NEW;
    END;
$$;


ALTER FUNCTION public.audittransaction() OWNER TO nathaniel;

--
-- TOC entry 308 (class 1255 OID 17218)
-- Name: enumeratepath(character varying, integer); Type: PROCEDURE; Schema: public; Owner: nathaniel
--

CREATE PROCEDURE public.enumeratepath(IN character varying, IN integer)
    LANGUAGE plperlu
    AS $_X$
  my ( $cur, $level ) = @_;

use Data::Dumper;
elog( INFO, "begin enumeratePath cur $cur level $level" );
my $l = 0;
my $c = $cur;

# rv = list of ....
#
$_SHARED{ofLevel} = sub {
  # shift works not this
  my ($l, $path) = @ARGV;
  my @out = split(/:/, $path);


  $out[$l];
};

#  produce nth path string given level and thus far coalesced path
#  return value @Branch(es)
#      |__  for each exchange, enumerate all branches from previous level
#
$_SHARED{getNextBranch} = sub {
  my $path = shift;
  my $action = shift;
  elog(NOTICE, "BEGIN getNextBranch path [$path] action [$action]");
  my @branch; 
  my @path = split(/:/, $path);

  #  last leaf in this branch
  #
  my ( $a, $symbol, $exchange ) = ( split( /_/, $path[-1] ));
  my ( $base, $quote )  = ( split( /\-/, $symbol ));

  #  enumerate all symbols by all exchanges
  #
  foreach my ( $k, $v ) ( each %{$_SHARED{symbolByExchange}} ) {
    my ( $symbols, $ex ) = ( $v, $k );

    foreach my $s (@$symbols) {
      my ( $b, $q )  = ( split( /\-/, $s ) );
      elog( INFO, "#############################exchange $ex symbol $s b $b q $q");

      $tpath = join('_', $action, $s, $ex);

      if ($action eq "buy") {
        push @branch, "$action_$q-$b_$exchange";
      } elsif ($action eq "sell") {
        push @branch, "$action_$b-$q_$exchange";
      } elsif ($action eq "transfer") {
        die "NOOP: getNextBranch with xfer should be done further in program chain";
      } else {
        die "NOOOPS";
      }
    }
 }

#...   $_SHARED{Abranch} = \@branch;
  \@branch;
};

#  pull recent tickers
#
my $sql = "select concat_ws('_', 'buy', replace(symbol, '/','-'), replace(exchange, ' ','-')) as tpath from recentTickersByQuote('$c'); ";

elog( DEBUG, $sql );
my $rv    = spi_exec_query($sql);
my $nrows = $rv->{processed};

$_SHARED{symbolByExchange} = {};
my $pathByLevel      = {};
my $transaction_tags = {};

#  from tickers [schema]
#   
#    hashes
#
foreach my $rn ( 0 .. $nrows - 1 ) {

    #  insert varchar -> ltree
    #
    my $tpath = $rv->{rows}[$rn]->{tpath};
    $tpath =~ s/ /-/g;
    my $sql = "insert into evTree (tpath) values (text2ltree('$tpath'));";
    elog( DEBUG, "1: $sql" );
    my $rv = spi_exec_query($sql);
    spi_commit();
    elog( DEBUG, sprintf( "inserted %s rows l %s", $rv->{processed}, $l ) );

    my ( $action, $symbol, $exchange ) = ( split( /_/, $tpath ) );

    $exchange =~ s/ /-/g;
    my ( $base, $quote ) = ( split( /\-/, $symbol ) );

    #  initialized
    #
    if ( not defined $_SHARED{symbolByExchange}->{$exchange} ) {
        $_SHARED{symbolByExchange}->{$exchange} = [];
    }
    push @{ $_SHARED{symbolByExchange}->{$exchange} }, $symbol;

    #  initialized
    #
    if ( not defined $pathByLevel->{'0'} ) {
        $pathByLevel->{'0'} = ();
    }
    elog( DEBUG, "->pathByLevel 0:$tpath" );
    push @{ $pathByLevel->{'0'} }, $tpath;
}
elog( NOTICE, 'sym e ' . Dumper( $_SHARED{symbolByExchange} ) );
elog( DEBUG4, 'pathByLevel ' . Dumper( \$pathByLevel ) );

#
#  populate tree to N levels deep
#
  elog( NOTICE, "  from evTree->ltree " );
#
foreach my $l ( 1 .. $level ) {
    my ( $action, $tid, $transaction_tag, $prevSym, $exOf)
    = ( 'buy', (undef) x 4 );

    elog( INFO, "l:$l level:$level" );

    if ( $l == 1 ) { $c = $cur; }

    #  enumerate comprehensive list
    #

  foreach my ( $k, $v ) ( each %{$_SHARED{symbolByExchange}} ) {
      my ( $symbols, $ex ) = ( $v, $k );

    if ( $l == $level ) {
        $action          = 'sell';
        $tid             = keys(%$transaction_tags) + 1;
        $transaction_tag = $transaction_tags{$tid} = $tid . "_$ex";
        elog( INFO, "action $action tid $tid transaction_tag $transaction_tag");
    }

# .. sym
#
    foreach my $s (@$symbols) {
          my ( $b, $q )  = ( split( /\-/, $s ) );
          elog( INFO, "exchange $ex symbol $s b $b q $q");
          elog( INFO, sprintf( "transaction_tag $transaction_tag") );

    $tpath = join('_', $action, $s, $ex);
    $pathByLevel->{$l} = $tpath;
 
    #TODO  could tidy uniformly namespace-wise
    #
    my $cb = $_SHARED{getNextBranch};
    my $branch = &$cb($tpath,$action);
#    my $a = $_SHARED{Abranch};

    elog(NOTICE, "####################################");
    elog(NOTICE, Dumper(\$branch));

    #  get next branch(es) in tree for each exchange / symbol
    #
    foreach my $path (@$branch) {
      my $sql = "insert into evTree (tpath) values (text2ltree('$path'));";
      elog( DEBUG5, "getNextBranch->  $sql" );
      my $rv = spi_exec_query($sql);
      spi_commit();
      elog( DEBUG4, sprintf( "getNextBranch->evTree inserted %s", $rv->{processed} ) );
    }

    #
    #  only the full path needs transaction_tag & tid
    #      wallet
    #
        my ( $base, $quote ) = ( split( /\-/, $s ) );

        if ( (defined $transaction_tag) and (defined $tid) ) {
            my $sql = sprintf("insert into evTree (tpath, tid, transaction_tag) values (text2ltree(concat_ws('_', '$action', replace('$s', '/','-'), replace('$ex', ' ','-'))), '%s', '%s')", $tid, $transaction_tag);
            elog( DEBUG, "----- $sql" );
            my $rv = spi_exec_query($sql);
            spi_commit();
            my $nrows = $rv->{processed};
            elog( DEBUG, sprintf( "inserted %s rows level %s", $rv->{processed}, $l ) );
        }
       }
     }
}
elog( INFO, 'pathByLevel ' . Dumper( \$pathByLevel ) );

$_X$;


ALTER PROCEDURE public.enumeratepath(IN character varying, IN integer) OWNER TO nathaniel;

--
-- TOC entry 332 (class 1255 OID 17212)
-- Name: makeevent(text); Type: PROCEDURE; Schema: public; Owner: nathaniel
--

CREATE PROCEDURE public.makeevent(IN text)
    LANGUAGE plperlu
    AS $$
	# this doesn't need to happen
	elog(ERROR, 'DO NOT IMPLEMENT THIS, just use the node shit');
$$;


ALTER PROCEDURE public.makeevent(IN text) OWNER TO nathaniel;

--
-- TOC entry 280 (class 1255 OID 17220)
-- Name: output(text, text); Type: PROCEDURE; Schema: public; Owner: nathaniel
--

CREATE PROCEDURE public.output(IN text, IN text)
    LANGUAGE plperlu
    AS $_X$
my ( $filename, $transaction_tag ) = @_;

use JSON;
use Data::Dumper;
my $json = JSON->new->allow_nonref;

elog( INFO, "begin enumeratePath output, $filename, $transaction_tag" );
my $sql = sprintf(
    "select tpath, tid, transaction_tag from evTree where tid is not null;");
elog( NOTICE, "$sql" );
my $rv    = spi_exec_query($sql);
my $nrows = $rv->{processed};
elog( NOTICE, "nrows of ^^^:$nrows" );

#
# https://www.postgresql.org/docs/current/ltree.html
#
my @transactions;

foreach my $rn ( 0 .. ( $nrows - 1 ) ) {
    my $tpath           = $rv->{rows}[$rn]->{tpath};
    my $tid             = $rv->{rows}[$rn]->{tid};
    my $transaction_tag = $rv->{rows}[$rn]->{transaction_tag};

    my ( $action, $symbol, $exchange ) = ( ( split( /_/, $tpath ) ) );
    my ( $base, $quote ) = ( ( split( /-/, $symbol ) ) );

    $exchange = join( ' ', split( /-/, $exchange ) );

    #
    #      MOCK
    #
    ###################################################################################
    my ( $value, $currency ) = ( (undef) x 2 );
    my ( $cost, $costtype, $amount, $amounttype, $fee, $price, $pricetype );

    #		amount = (wallet[exchange][quote].value - fee) / ticker.ask;
    if ( $action == 'buy' ) {
        $value      = 17;
        $fee        = 4109477.00011102030501;
        $currency   = $quote;
        $cost       = $value;
        $price      = $value;
        $amount     = $value;
        $costtype   = $quote;
        $amounttype = $quote;
        $pricetype  = $quote;
    }
    if ( $action == 'sell' ) {

        #	my $value = amount * ticker.bid - fee
        $value      = 14;
        $currency   = $quote;
        $fee        = 4109477.00011102030501;
        $currency   = $quote;
        $cost       = $value;
        $price      = $value;
        $amount     = $value;
        $costtype   = $quote;
        $amounttype = $quote;
        $pricetype  = $quote;
    }

 #  finalized.  posted:
 #                               wallet 
 #
 #################################################################################
    my $sql =
"insert into wallet (currency,value,exchange) values ('$currency','$value','$exchange') on conflict (currency,value,exchange) do update set value=excluded.value returning id ;";

    elog( INFO, "$sql" );
    my $rv = spi_exec_query($sql);
    spi_commit();
    my $o     = sprintf( Dumper( \$rv ) );
    my $nrows = $rv->{processed};
    my $id    = $rv->{rows}[0]->{id};
    elog( INFO, "inserted $nrows wallet id:$id" );
    elog( INFO, $o );

    $sql = "update evTree set wid=$id where tpath='$tpath';";
    elog( INFO, "$sql" );
    $rv = spi_exec_query($sql);
    spi_commit();
    $nrows = $rv->{processed};
    elog( INFO, "inserted (wid[$id]) into evTree;" );


#***********************************************************************************
#   Make an Event
#
#
#		my @evF = qw/created_by transaction_tag action exchange fromexchange address cost costtype amount amounttype symbol fee price pricetype fullfilled remaining orderbookid datetime fullfilled_datetime cantmove error_exception_api tid tagid success status/;
    my @evF = qw/created_by transaction_tag action exchange fromexchange cost costtype amount amounttype symbol price pricetype tid tagid/;

    my $ev = {};
    foreach my $f (@evF) {
        $ev->{$f} = undef;
    }
    $ev->{created_by}      = 'postgres->procedure->enumerateTree';
    $ev->{transaction_tag} = $transaction_tag;
    $ev->{tagid}           = $tid;
    $ev->{tid}             = $tid;
    $ev->{action}          = $action;
    $ev->{exchange}        = $exchange;
    $ev->{fromexchange}    = $exchange;
    $ev->{cost}            = $cost;
    $ev->{costtype}        = $costtype;
    $ev->{amount}          = $amount;
    $ev->{amounttype}      = $amounttype;
    $ev->{symbol}          = $symbol;
    #		$ev->{fee} = 'transferfee';
    $ev->{price}     = $price;
    $ev->{pricetype} = $pricetype;

    push @transactions, $ev;

# comment

    my $sql = sprintf("insert into event ");
    $sql .= '( ' . join( ',', @evF ) . ') ';
    $sql .= 'values( ' . join( ',', map { "'" . $ev->{$_} . "'"; } @evF ) . ') on conflict (transaction_tag,tagid) do nothing;';

    elog( INFO, "$sql" );

    my $rv = spi_exec_query($sql);
    spi_commit();
    my $nrows = $rv->{processed};
    if ( $nrows > 0 ) {
        elog( INFO, "inserted event $nrows" );
    }
}

elog( NOTICE, "output" );
my $out = $json->pretty->encode(@transactions);
open( OUT, ">$filename" );
print OUT $out;
close(OUT);

$_X$;


ALTER PROCEDURE public.output(IN text, IN text) OWNER TO nathaniel;

--
-- TOC entry 316 (class 1255 OID 17164)
-- Name: parsesub(integer); Type: FUNCTION; Schema: public; Owner: nathaniel
--

CREATE FUNCTION public.parsesub(integer) RETURNS TABLE(action character varying, base character varying, quote character varying, exchange character varying)
    LANGUAGE sql
    AS $_$
/*  parse ltree path into class event.js  components
 */
select evAction as action, split_part(symbol, '-', 1) as base,  split_part(symbol, '-', 2) as quote, exchange from 
(
select split_part(sub, '_', 1) as evAction, split_part(sub, '_', 2) as symbol, split_part(sub, '_', 3) as exchange
from (
select subpath(tpath,$1,1)::TEXT as sub from evTree
) sq
) sq2
$_$;


ALTER FUNCTION public.parsesub(integer) OWNER TO nathaniel;

--
-- TOC entry 345 (class 1255 OID 17165)
-- Name: parsetree(integer); Type: FUNCTION; Schema: public; Owner: nathaniel
--

CREATE FUNCTION public.parsetree(integer) RETURNS TABLE(action character varying, base character varying, quote character varying, exchange character varying)
    LANGUAGE sql
    AS $_$
select evAction as action, split_part(symbol, '-', 1) as base,  split_part(symbol, '-', 2) as quote, exchange from 
(
select split_part(sub, '_', 1) as evAction, split_part(sub, '_', 2) as symbol, split_part(sub, '_', 3) as exchange
from (
select subpath(tpath,$1,1)::TEXT as sub from evTree
) sq
) sq2
$_$;


ALTER FUNCTION public.parsetree(integer) OWNER TO nathaniel;

--
-- TOC entry 281 (class 1255 OID 17169)
-- Name: recenttickersbybase(character varying); Type: FUNCTION; Schema: public; Owner: nathaniel
--

CREATE FUNCTION public.recenttickersbybase(character varying) RETURNS TABLE(exchange character varying, symbol character varying)
    LANGUAGE sql
    AS $_$
--select exchange,replace(symbol, '/','-') as symbol
select exchange,symbol
from (
	SELECT exchange,
		symbol,
		floor(EXTRACT(EPOCH FROM (now() - max(datetime)))) as age
	from tickers
	where quotevolume > 0
	and symbol like $1||'/%'
	group by exchange, symbol
) sq 
group by sq.exchange,sq.symbol, sq.age
having sq.age < 300
$_$;


ALTER FUNCTION public.recenttickersbybase(character varying) OWNER TO nathaniel;

--
-- TOC entry 283 (class 1255 OID 17177)
-- Name: recenttickersbybaselimit(integer, character varying); Type: FUNCTION; Schema: public; Owner: nathaniel
--

CREATE FUNCTION public.recenttickersbybaselimit(integer, character varying) RETURNS TABLE(exchange character varying, symbol character varying)
    LANGUAGE sql
    AS $_$
--select exchange,replace(symbol, '/','-') as symbol
select exchange,symbol
from (
	SELECT exchange,
		symbol,
		floor(EXTRACT(EPOCH FROM (now() - max(datetime)))) as age
	from tickers
	where quotevolume > 0
	and symbol like $2||'/%'
	group by exchange, symbol
) sq 
group by sq.exchange,sq.symbol, sq.age
having sq.age < 300
limit 1
offset $1
$_$;


ALTER FUNCTION public.recenttickersbybaselimit(integer, character varying) OWNER TO nathaniel;

--
-- TOC entry 291 (class 1255 OID 33427)
-- Name: recenttickersbyquote(character varying); Type: FUNCTION; Schema: public; Owner: nathaniel
--

CREATE FUNCTION public.recenttickersbyquote(character varying) RETURNS TABLE(exchange character varying, symbol character varying)
    LANGUAGE sql
    AS $_$
--select exchange,replace(symbol, '/','-') as symbol
select exchange,symbol
from (
	SELECT exchange,
		symbol,
		floor(EXTRACT(EPOCH FROM (now() - max(datetime)))) as age
	from tickers
	where basevolume > 0
	and right(symbol, 1 + length($1)) = '/'||$1
	and symbol not like '%$%/%'
	group by exchange, symbol

) sq 
group by sq.exchange,sq.symbol, sq.age
having sq.age < 3600
$_$;


ALTER FUNCTION public.recenttickersbyquote(character varying) OWNER TO nathaniel;

--
-- TOC entry 296 (class 1255 OID 16424)
-- Name: update_datetime(); Type: FUNCTION; Schema: public; Owner: nathaniel
--

CREATE FUNCTION public.update_datetime() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
	    -- Set the last_modified column to the current time
    -- 'NEW' is a special record variable holding the new row data
    NEW.datetime = NOW();
    -- Return the modified new row
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_datetime() OWNER TO nathaniel;

--
-- TOC entry 334 (class 1255 OID 16425)
-- Name: default_roles_proc(); Type: FUNCTION; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE FUNCTION useraccesscontrol.default_roles_proc() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
		insert into useraccesscontrol.rolemap (useremail, roleid) values (NEW.useremail, 1)
			on conflict do nothing;
		insert into useraccesscontrol.rolemap (useremail, roleid) values (NEW.useremail, 2)
					on conflict do nothing;
		insert into useraccesscontrol.rolemap (useremail, roleid) values (NEW.useremail, 3)
					on conflict do nothing;
		insert into useraccesscontrol.rolemap (useremail, roleid) values (NEW.useremail, 4)
					on conflict do nothing;
        RETURN NEW;
    END;
$$;


ALTER FUNCTION useraccesscontrol.default_roles_proc() OWNER TO nathaniel;

--
-- TOC entry 344 (class 1255 OID 16426)
-- Name: googlesso(numeric, character varying, character varying, character varying); Type: FUNCTION; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE FUNCTION useraccesscontrol.googlesso(guserid numeric, gusername character varying, guseremail character varying, guserimageurl character varying) RETURNS TABLE(id numeric)
    LANGUAGE plpgsql
    AS $$
	DECLARE 
    	var_r record;
    BEGIN
insert into useraccesscontrol.googlesso(pguserid, pgusername, pguseremail, pguserimageurl) values (guserid, gusername, guseremail, guserimageurl);

	    	FOR var_r IN(select 
    		s.id as ssoid from useraccesscontrol.sso as s
    		join useraccesscontrol.googlesso as gs
    		on s.useremail= gs.Pguseremail)
    	LOOP
    		id := var_r.id;
    		return next;
    	end loop;
    END;
$$;


ALTER FUNCTION useraccesscontrol.googlesso(guserid numeric, gusername character varying, guseremail character varying, guserimageurl character varying) OWNER TO nathaniel;

--
-- TOC entry 277 (class 1255 OID 33436)
-- Name: googlesso_whitelist(numeric, character varying, character varying, character varying); Type: FUNCTION; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE FUNCTION useraccesscontrol.googlesso_whitelist(guserid numeric, gusername character varying, guseremail character varying, guserimageurl character varying) RETURNS TABLE(id numeric)
    LANGUAGE plpgsql
    AS $$
	DECLARE 
    	var_r record;
    BEGIN
    	FOR var_r IN(select 
    		s.id as ssoid from useraccesscontrol.sso as s
    		join useraccesscontrol.googlesso as gs
    		on s.useremail= gs.Pguseremail)
    	LOOP
    		id := var_r.id;
    		return next;
    	end loop;
    END;
$$;


ALTER FUNCTION useraccesscontrol.googlesso_whitelist(guserid numeric, gusername character varying, guseremail character varying, guserimageurl character varying) OWNER TO nathaniel;

--
-- TOC entry 362 (class 1255 OID 16427)
-- Name: hasrole(character varying, character varying); Type: FUNCTION; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE FUNCTION useraccesscontrol.hasrole(useremail character varying, role character varying) RETURNS TABLE(name character varying)
    LANGUAGE plpgsql
    AS $$
	DECLARE 
    	var_r record;
    BEGIN
    	FOR var_r IN(
    	select rm.useremail from useraccesscontrol.sso as s join useraccesscontrol.rolemap as rm on s.useremail= rm.useremail
    		)
    	LOOP
    		name := var_r.name;
    		return next;
    	end loop;
    END;
$$;


ALTER FUNCTION useraccesscontrol.hasrole(useremail character varying, role character varying) OWNER TO nathaniel;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 219 (class 1259 OID 16428)
-- Name: event; Type: TABLE; Schema: private; Owner: nathaniel
--

CREATE TABLE private.event (
    eid integer NOT NULL,
    created_by public.created_by_tag NOT NULL,
    transaction_tag character varying(80),
    action public.action,
    exchange character varying(80),
    fromexchange character varying(80),
    address character varying(255),
    cost double precision,
    costtype character varying(80),
    amount double precision,
    amounttype character varying(80),
    symbol character varying(80),
    fee double precision,
    price double precision,
    pricetype character varying(80),
    fullfilled double precision,
    remaining double precision,
    orderbookid bigint,
    datetime timestamp with time zone,
    fullfilled_datetime timestamp with time zone,
    cantmove character varying(8192),
    error_exception_api character varying(512),
    tid bigint NOT NULL,
    tagid character varying(255),
    success boolean,
    status character varying(20)
);


ALTER TABLE private.event OWNER TO nathaniel;

--
-- TOC entry 220 (class 1259 OID 16433)
-- Name: event_eid_seq; Type: SEQUENCE; Schema: private; Owner: nathaniel
--

CREATE SEQUENCE private.event_eid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE private.event_eid_seq OWNER TO nathaniel;

--
-- TOC entry 3868 (class 0 OID 0)
-- Dependencies: 220
-- Name: event_eid_seq; Type: SEQUENCE OWNED BY; Schema: private; Owner: nathaniel
--

ALTER SEQUENCE private.event_eid_seq OWNED BY private.event.eid;


--
-- TOC entry 221 (class 1259 OID 16434)
-- Name: orderbook_asks_snap; Type: TABLE; Schema: private; Owner: nathaniel
--

CREATE TABLE private.orderbook_asks_snap (
    id integer NOT NULL,
    orderbookid bigint NOT NULL,
    price double precision NOT NULL,
    amount double precision NOT NULL,
    datetime timestamp with time zone
);


ALTER TABLE private.orderbook_asks_snap OWNER TO nathaniel;

--
-- TOC entry 222 (class 1259 OID 16437)
-- Name: orderbook_asks_snap_id_seq; Type: SEQUENCE; Schema: private; Owner: nathaniel
--

CREATE SEQUENCE private.orderbook_asks_snap_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE private.orderbook_asks_snap_id_seq OWNER TO nathaniel;

--
-- TOC entry 3869 (class 0 OID 0)
-- Dependencies: 222
-- Name: orderbook_asks_snap_id_seq; Type: SEQUENCE OWNED BY; Schema: private; Owner: nathaniel
--

ALTER SEQUENCE private.orderbook_asks_snap_id_seq OWNED BY private.orderbook_asks_snap.id;


--
-- TOC entry 223 (class 1259 OID 16438)
-- Name: orderbook_bids_snap; Type: TABLE; Schema: private; Owner: nathaniel
--

CREATE TABLE private.orderbook_bids_snap (
    id integer NOT NULL,
    orderbookid bigint NOT NULL,
    price double precision NOT NULL,
    amount double precision NOT NULL,
    datetime timestamp with time zone
);


ALTER TABLE private.orderbook_bids_snap OWNER TO nathaniel;

--
-- TOC entry 224 (class 1259 OID 16441)
-- Name: orderbook_bids_snap_id_seq; Type: SEQUENCE; Schema: private; Owner: nathaniel
--

CREATE SEQUENCE private.orderbook_bids_snap_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE private.orderbook_bids_snap_id_seq OWNER TO nathaniel;

--
-- TOC entry 3870 (class 0 OID 0)
-- Dependencies: 224
-- Name: orderbook_bids_snap_id_seq; Type: SEQUENCE OWNED BY; Schema: private; Owner: nathaniel
--

ALTER SEQUENCE private.orderbook_bids_snap_id_seq OWNED BY private.orderbook_bids_snap.id;


--
-- TOC entry 225 (class 1259 OID 16442)
-- Name: orderbook_snap; Type: TABLE; Schema: private; Owner: nathaniel
--

CREATE TABLE private.orderbook_snap (
    id integer NOT NULL,
    exchange character varying NOT NULL,
    symbol character varying NOT NULL,
    datetime timestamp with time zone NOT NULL
);


ALTER TABLE private.orderbook_snap OWNER TO nathaniel;

--
-- TOC entry 226 (class 1259 OID 16447)
-- Name: orderbook_snap_id_seq; Type: SEQUENCE; Schema: private; Owner: nathaniel
--

CREATE SEQUENCE private.orderbook_snap_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE private.orderbook_snap_id_seq OWNER TO nathaniel;

--
-- TOC entry 3871 (class 0 OID 0)
-- Dependencies: 226
-- Name: orderbook_snap_id_seq; Type: SEQUENCE OWNED BY; Schema: private; Owner: nathaniel
--

ALTER SEQUENCE private.orderbook_snap_id_seq OWNED BY private.orderbook_snap.id;


--
-- TOC entry 227 (class 1259 OID 16448)
-- Name: web_event; Type: VIEW; Schema: private; Owner: nathaniel
--

CREATE VIEW private.web_event AS
 SELECT
   FROM private.event;


ALTER VIEW private.web_event OWNER TO nathaniel;

--
-- TOC entry 228 (class 1259 OID 16452)
-- Name: errorprioritizeswithdrawstatus; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.errorprioritizeswithdrawstatus (
    exchange character varying(80) NOT NULL,
    currency character varying(80) NOT NULL
);


ALTER TABLE public.errorprioritizeswithdrawstatus OWNER TO nathaniel;

--
-- TOC entry 259 (class 1259 OID 17256)
-- Name: event; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.event (
    eid bigint NOT NULL,
    created_by character varying(80) NOT NULL,
    transaction_tag character varying(80),
    tagid bigint NOT NULL,
    action public.action,
    exchange character varying(80),
    fromexchange character varying(80),
    address character varying(255),
    cost double precision,
    costtype character varying(80),
    amount double precision NOT NULL,
    amounttype character varying(80),
    symbol character varying(80),
    fee double precision,
    price double precision,
    pricetype character varying(80),
    fullfilled double precision,
    remaining double precision,
    orderbookid bigint,
    datetime timestamp with time zone,
    fullfilled_datetime timestamp with time zone,
    cantmove character varying(8192),
    error_exception_api character varying(512),
    tid bigint,
    success boolean,
    status character varying(20),
    txid character varying(255),
    created timestamp with time zone
);


ALTER TABLE public.event OWNER TO nathaniel;

--
-- TOC entry 258 (class 1259 OID 17255)
-- Name: event_eid_seq; Type: SEQUENCE; Schema: public; Owner: nathaniel
--

ALTER TABLE public.event ALTER COLUMN eid ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.event_eid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 229 (class 1259 OID 16461)
-- Name: event_pending; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.event_pending (
    eid integer NOT NULL,
    created_by character varying(80) NOT NULL,
    transaction_tag character varying(80),
    tagid bigint NOT NULL,
    action public.action,
    exchange character varying(80),
    fromexchange character varying(80),
    address character varying(255),
    cost double precision,
    costtype character varying(80),
    amount double precision NOT NULL,
    amounttype character varying(80),
    symbol character varying(80),
    fee double precision,
    price double precision,
    pricetype character varying(80),
    fullfilled double precision,
    remaining double precision,
    orderbookid bigint,
    datetime timestamp with time zone,
    fullfilled_datetime timestamp with time zone,
    cantmove character varying(8192),
    error_exception_api character varying(512),
    tid bigint,
    success boolean,
    status character varying(20),
    txid character varying(255),
    created timestamp with time zone
);


ALTER TABLE public.event_pending OWNER TO nathaniel;

--
-- TOC entry 230 (class 1259 OID 16466)
-- Name: event_pending_eid_seq; Type: SEQUENCE; Schema: public; Owner: nathaniel
--

CREATE SEQUENCE public.event_pending_eid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.event_pending_eid_seq OWNER TO nathaniel;

--
-- TOC entry 3872 (class 0 OID 0)
-- Dependencies: 230
-- Name: event_pending_eid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nathaniel
--

ALTER SEQUENCE public.event_pending_eid_seq OWNED BY public.event_pending.eid;


--
-- TOC entry 252 (class 1259 OID 17043)
-- Name: evpath; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.evpath (
    path public.ltree
);


ALTER TABLE public.evpath OWNER TO nathaniel;

--
-- TOC entry 267 (class 1259 OID 17473)
-- Name: evtree; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.evtree (
    tpath public.ltree,
    evid bigint,
    wid bigint,
    tid bigint,
    transaction_tag character varying(80)
);


ALTER TABLE public.evtree OWNER TO nathaniel;

--
-- TOC entry 231 (class 1259 OID 16467)
-- Name: exchangeexceptions; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.exchangeexceptions (
    exchange character varying NOT NULL,
    action character varying NOT NULL,
    datetime timestamp with time zone,
    data json
);


ALTER TABLE public.exchangeexceptions OWNER TO nathaniel;

--
-- TOC entry 255 (class 1259 OID 17062)
-- Name: files_on_disk; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.files_on_disk (
    name text,
    parent_folder text,
    size bigint
);


ALTER TABLE public.files_on_disk OWNER TO nathaniel;

--
-- TOC entry 261 (class 1259 OID 17270)
-- Name: transaction_moves; Type: VIEW; Schema: public; Owner: nathaniel
--

CREATE VIEW public.transaction_moves AS
 SELECT min(datetime) AS date,
    transaction_tag,
    array_agg(((
        CASE
            WHEN (action = 'buy'::public.action) THEN (((costtype)::text || ' to '::text) || (amounttype)::text)
            WHEN (action = 'sell'::public.action) THEN (((amounttype)::text || ' to '::text) || (costtype)::text)
            WHEN (action = 'move'::public.action) THEN (costtype)::text
            ELSE NULL::text
        END || ' '::text) ||
        CASE
            WHEN (fromexchange IS NULL) THEN (exchange)::text
            ELSE (((fromexchange)::text || ' -> '::text) || (exchange)::text)
        END) ORDER BY tagid) AS moves
   FROM public.event
  GROUP BY transaction_tag;


ALTER VIEW public.transaction_moves OWNER TO nathaniel;

--
-- TOC entry 263 (class 1259 OID 17279)
-- Name: transaction_profit; Type: VIEW; Schema: public; Owner: nathaniel
--

CREATE VIEW public.transaction_profit AS
 WITH cte AS (
         SELECT event.transaction_tag,
            max(event.tagid) AS last,
            min(event.tagid) AS first
           FROM public.event
          WHERE ((event.costtype)::text = 'USD'::text)
          GROUP BY event.transaction_tag
        )
 SELECT firstev.transaction_tag,
    (lastev.costfinal - firstev.costbasis) AS profit,
    firstev.costbasis,
    lastev.costfinal
   FROM (( SELECT event.transaction_tag,
            event.cost AS costbasis
           FROM (cte
             JOIN public.event ON ((((event.transaction_tag)::text = (cte.transaction_tag)::text) AND (event.tagid = cte.first))))) firstev
     JOIN ( SELECT event.transaction_tag,
            event.cost AS costfinal
           FROM (cte
             JOIN public.event ON ((((event.transaction_tag)::text = (cte.transaction_tag)::text) AND (event.tagid = cte.last))))) lastev ON (((firstev.transaction_tag)::text = (lastev.transaction_tag)::text)))
  ORDER BY (lastev.costfinal - firstev.costbasis) DESC;


ALTER VIEW public.transaction_profit OWNER TO nathaniel;

--
-- TOC entry 266 (class 1259 OID 17298)
-- Name: latest_moves_by_profit; Type: VIEW; Schema: public; Owner: nathaniel
--

CREATE VIEW public.latest_moves_by_profit AS
 SELECT lm.transaction_tag,
    lm.latest,
    tp.profit,
    lm.moves,
    lm.date
   FROM (( SELECT m.transaction_tag,
            m.moves,
            s.date,
            date_trunc('minute'::text, s.date) AS latest
           FROM (( SELECT transaction_moves.moves,
                    max(transaction_moves.date) AS date
                   FROM public.transaction_moves
                  WHERE ((transaction_moves.transaction_tag)::text !~~ '%_min'::text)
                  GROUP BY transaction_moves.moves) s
             JOIN public.transaction_moves m ON (((m.moves = s.moves) AND (m.date = s.date))))) lm
     JOIN public.transaction_profit tp ON (((tp.transaction_tag)::text = (lm.transaction_tag)::text)))
  ORDER BY lm.latest DESC, tp.profit DESC;


ALTER VIEW public.latest_moves_by_profit OWNER TO nathaniel;

--
-- TOC entry 254 (class 1259 OID 17049)
-- Name: node; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.node (
    id integer NOT NULL,
    name text NOT NULL,
    parent_id integer
);


ALTER TABLE public.node OWNER TO nathaniel;

--
-- TOC entry 253 (class 1259 OID 17048)
-- Name: node_id_seq; Type: SEQUENCE; Schema: public; Owner: nathaniel
--

CREATE SEQUENCE public.node_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.node_id_seq OWNER TO nathaniel;

--
-- TOC entry 3873 (class 0 OID 0)
-- Dependencies: 253
-- Name: node_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nathaniel
--

ALTER SEQUENCE public.node_id_seq OWNED BY public.node.id;


--
-- TOC entry 232 (class 1259 OID 16487)
-- Name: orderbook_asks_snap; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.orderbook_asks_snap (
    id integer NOT NULL,
    orderbookid bigint NOT NULL,
    price double precision NOT NULL,
    amount double precision NOT NULL,
    datetime timestamp with time zone
);


ALTER TABLE public.orderbook_asks_snap OWNER TO nathaniel;

--
-- TOC entry 233 (class 1259 OID 16490)
-- Name: orderbook_asks_snap_id_seq; Type: SEQUENCE; Schema: public; Owner: nathaniel
--

CREATE SEQUENCE public.orderbook_asks_snap_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orderbook_asks_snap_id_seq OWNER TO nathaniel;

--
-- TOC entry 3874 (class 0 OID 0)
-- Dependencies: 233
-- Name: orderbook_asks_snap_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nathaniel
--

ALTER SEQUENCE public.orderbook_asks_snap_id_seq OWNED BY public.orderbook_asks_snap.id;


--
-- TOC entry 234 (class 1259 OID 16491)
-- Name: orderbook_bids_snap; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.orderbook_bids_snap (
    id integer NOT NULL,
    orderbookid bigint NOT NULL,
    price double precision NOT NULL,
    amount double precision NOT NULL,
    datetime timestamp with time zone
);


ALTER TABLE public.orderbook_bids_snap OWNER TO nathaniel;

--
-- TOC entry 235 (class 1259 OID 16494)
-- Name: orderbook_bids_snap_id_seq; Type: SEQUENCE; Schema: public; Owner: nathaniel
--

CREATE SEQUENCE public.orderbook_bids_snap_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orderbook_bids_snap_id_seq OWNER TO nathaniel;

--
-- TOC entry 3875 (class 0 OID 0)
-- Dependencies: 235
-- Name: orderbook_bids_snap_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nathaniel
--

ALTER SEQUENCE public.orderbook_bids_snap_id_seq OWNED BY public.orderbook_bids_snap.id;


--
-- TOC entry 236 (class 1259 OID 16495)
-- Name: orderbook_snap; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.orderbook_snap (
    id integer NOT NULL,
    exchange character varying NOT NULL,
    symbol character varying NOT NULL,
    datetime timestamp with time zone NOT NULL
);


ALTER TABLE public.orderbook_snap OWNER TO nathaniel;

--
-- TOC entry 237 (class 1259 OID 16500)
-- Name: orderbook_snap_id_seq; Type: SEQUENCE; Schema: public; Owner: nathaniel
--

CREATE SEQUENCE public.orderbook_snap_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orderbook_snap_id_seq OWNER TO nathaniel;

--
-- TOC entry 3876 (class 0 OID 0)
-- Dependencies: 237
-- Name: orderbook_snap_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nathaniel
--

ALTER SEQUENCE public.orderbook_snap_id_seq OWNED BY public.orderbook_snap.id;


--
-- TOC entry 238 (class 1259 OID 16501)
-- Name: tickers; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.tickers (
    bid numeric,
    ask numeric,
    datetime timestamp with time zone DEFAULT now(),
    symbol character varying NOT NULL,
    exchange character varying NOT NULL,
    price numeric,
    basevolume numeric,
    quotevolume numeric
);


ALTER TABLE public.tickers OWNER TO nathaniel;

--
-- TOC entry 265 (class 1259 OID 17288)
-- Name: transaction_view; Type: VIEW; Schema: public; Owner: nathaniel
--

CREATE VIEW public.transaction_view AS
 SELECT transaction_tag,
    string_agg(((
        CASE
            WHEN (action = 'buy'::public.action) THEN (((costtype)::text || ' to '::text) || (amounttype)::text)
            WHEN (action = 'sell'::public.action) THEN (((amounttype)::text || ' to '::text) || (costtype)::text)
            WHEN (action = 'move'::public.action) THEN (costtype)::text
            ELSE NULL::text
        END || ' '::text) ||
        CASE
            WHEN (fromexchange IS NULL) THEN (exchange)::text
            ELSE (((fromexchange)::text || ' -> '::text) || (exchange)::text)
        END), '|'::text ORDER BY tagid) AS moves
   FROM public.event
  GROUP BY transaction_tag;


ALTER VIEW public.transaction_view OWNER TO nathaniel;

--
-- TOC entry 239 (class 1259 OID 16512)
-- Name: transfercheck; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.transfercheck (
    exchange character varying,
    amounttype character varying,
    canwithdraw boolean,
    candeposit boolean
);


ALTER TABLE public.transfercheck OWNER TO nathaniel;

--
-- TOC entry 240 (class 1259 OID 16517)
-- Name: transferfees; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.transferfees (
    exchange character varying NOT NULL,
    currency character varying NOT NULL,
    description character varying,
    fee numeric,
    network character varying,
    minimum numeric,
    withdrawenabled character varying,
    depositenabled character varying,
    percentage numeric
);


ALTER TABLE public.transferfees OWNER TO nathaniel;

--
-- TOC entry 257 (class 1259 OID 17104)
-- Name: wallet; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.wallet (
    id bigint NOT NULL,
    currency character varying(26),
    value numeric(24,8),
    exchange character varying(80)
);


ALTER TABLE public.wallet OWNER TO nathaniel;

--
-- TOC entry 256 (class 1259 OID 17103)
-- Name: wallet_id_seq; Type: SEQUENCE; Schema: public; Owner: nathaniel
--

ALTER TABLE public.wallet ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.wallet_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 241 (class 1259 OID 16522)
-- Name: walletstatus; Type: TABLE; Schema: public; Owner: nathaniel
--

CREATE TABLE public.walletstatus (
    exchange character varying(25) NOT NULL,
    symbol character varying(26) NOT NULL,
    status public.typewalletstatus NOT NULL,
    updated timestamp with time zone NOT NULL
);


ALTER TABLE public.walletstatus OWNER TO nathaniel;

--
-- TOC entry 260 (class 1259 OID 17265)
-- Name: web_event; Type: VIEW; Schema: public; Owner: nathaniel
--

CREATE VIEW public.web_event AS
 SELECT eid,
    created_by,
    transaction_tag,
    tagid,
    action,
    exchange,
    fromexchange,
    address,
    cost,
    costtype,
    amount,
    amounttype,
    symbol,
    fee,
    price,
    pricetype,
    fullfilled,
    remaining,
    orderbookid,
    datetime,
    fullfilled_datetime,
    cantmove,
    error_exception_api,
    tid,
    success,
    status,
    txid,
    created
   FROM public.event;


ALTER VIEW public.web_event OWNER TO nathaniel;

--
-- TOC entry 242 (class 1259 OID 16525)
-- Name: web_event_pending; Type: VIEW; Schema: public; Owner: nathaniel
--

CREATE VIEW public.web_event_pending AS
 SELECT eid,
    created_by,
    transaction_tag,
    tagid,
    action,
    exchange,
    fromexchange,
    address,
    cost,
    costtype,
    amount,
    amounttype,
    symbol,
    fee,
    price,
    pricetype,
    fullfilled,
    remaining,
    orderbookid,
    datetime,
    fullfilled_datetime,
    cantmove,
    error_exception_api,
    tid,
    txid,
    success,
    status
   FROM public.event_pending;


ALTER VIEW public.web_event_pending OWNER TO nathaniel;

--
-- TOC entry 262 (class 1259 OID 17275)
-- Name: web_transaction_moves; Type: VIEW; Schema: public; Owner: nathaniel
--

CREATE VIEW public.web_transaction_moves AS
 SELECT date,
    transaction_tag,
    moves
   FROM public.transaction_moves
  ORDER BY date DESC;


ALTER VIEW public.web_transaction_moves OWNER TO nathaniel;

--
-- TOC entry 264 (class 1259 OID 17284)
-- Name: web_transaction_profit; Type: VIEW; Schema: public; Owner: nathaniel
--

CREATE VIEW public.web_transaction_profit AS
 SELECT transaction_tag,
    profit,
    costbasis,
    costfinal
   FROM public.transaction_profit;


ALTER VIEW public.web_transaction_profit OWNER TO nathaniel;

--
-- TOC entry 268 (class 1259 OID 33431)
-- Name: googlesso; Type: TABLE; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE TABLE useraccesscontrol.googlesso (
    pguserid character varying,
    pgusername character varying,
    pguseremail character varying,
    pguserimageurl character varying
);


ALTER TABLE useraccesscontrol.googlesso OWNER TO nathaniel;

--
-- TOC entry 243 (class 1259 OID 16542)
-- Name: role; Type: TABLE; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE TABLE useraccesscontrol.role (
    id integer NOT NULL,
    name character varying(25)
);


ALTER TABLE useraccesscontrol.role OWNER TO nathaniel;

--
-- TOC entry 244 (class 1259 OID 16545)
-- Name: role_id_seq; Type: SEQUENCE; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE SEQUENCE useraccesscontrol.role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE useraccesscontrol.role_id_seq OWNER TO nathaniel;

--
-- TOC entry 3877 (class 0 OID 0)
-- Dependencies: 244
-- Name: role_id_seq; Type: SEQUENCE OWNED BY; Schema: useraccesscontrol; Owner: nathaniel
--

ALTER SEQUENCE useraccesscontrol.role_id_seq OWNED BY useraccesscontrol.role.id;


--
-- TOC entry 245 (class 1259 OID 16546)
-- Name: rolemap; Type: TABLE; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE TABLE useraccesscontrol.rolemap (
    useremail character varying,
    roleid bigint
);


ALTER TABLE useraccesscontrol.rolemap OWNER TO nathaniel;

--
-- TOC entry 246 (class 1259 OID 16551)
-- Name: session; Type: TABLE; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE TABLE useraccesscontrol.session (
    sid integer NOT NULL,
    session json
);


ALTER TABLE useraccesscontrol.session OWNER TO nathaniel;

--
-- TOC entry 247 (class 1259 OID 16556)
-- Name: session_sid_seq; Type: SEQUENCE; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE SEQUENCE useraccesscontrol.session_sid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE useraccesscontrol.session_sid_seq OWNER TO nathaniel;

--
-- TOC entry 3878 (class 0 OID 0)
-- Dependencies: 247
-- Name: session_sid_seq; Type: SEQUENCE OWNED BY; Schema: useraccesscontrol; Owner: nathaniel
--

ALTER SEQUENCE useraccesscontrol.session_sid_seq OWNED BY useraccesscontrol.session.sid;


--
-- TOC entry 248 (class 1259 OID 16557)
-- Name: sso; Type: TABLE; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE TABLE useraccesscontrol.sso (
    id integer NOT NULL,
    useremail character varying NOT NULL
);


ALTER TABLE useraccesscontrol.sso OWNER TO nathaniel;

--
-- TOC entry 249 (class 1259 OID 16562)
-- Name: sso_id_seq; Type: SEQUENCE; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE SEQUENCE useraccesscontrol.sso_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE useraccesscontrol.sso_id_seq OWNER TO nathaniel;

--
-- TOC entry 3879 (class 0 OID 0)
-- Dependencies: 249
-- Name: sso_id_seq; Type: SEQUENCE OWNED BY; Schema: useraccesscontrol; Owner: nathaniel
--

ALTER SEQUENCE useraccesscontrol.sso_id_seq OWNED BY useraccesscontrol.sso.id;


--
-- TOC entry 250 (class 1259 OID 16563)
-- Name: uipref; Type: TABLE; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE TABLE useraccesscontrol.uipref (
    schema character varying,
    view character varying,
    ssoid numeric,
    fields character varying,
    sortorder character varying
);


ALTER TABLE useraccesscontrol.uipref OWNER TO nathaniel;

--
-- TOC entry 251 (class 1259 OID 16568)
-- Name: vw_useremail_role; Type: VIEW; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE VIEW useraccesscontrol.vw_useremail_role AS
 SELECT rm.useremail,
    role.name AS role
   FROM ((useraccesscontrol.sso s
     JOIN useraccesscontrol.rolemap rm ON (((s.useremail)::text = (rm.useremail)::text)))
     JOIN useraccesscontrol.role role ON ((rm.roleid = role.id)));


ALTER VIEW useraccesscontrol.vw_useremail_role OWNER TO nathaniel;

--
-- TOC entry 3645 (class 2604 OID 16572)
-- Name: event eid; Type: DEFAULT; Schema: private; Owner: nathaniel
--

ALTER TABLE ONLY private.event ALTER COLUMN eid SET DEFAULT nextval('private.event_eid_seq'::regclass);


--
-- TOC entry 3646 (class 2604 OID 16573)
-- Name: orderbook_asks_snap id; Type: DEFAULT; Schema: private; Owner: nathaniel
--

ALTER TABLE ONLY private.orderbook_asks_snap ALTER COLUMN id SET DEFAULT nextval('private.orderbook_asks_snap_id_seq'::regclass);


--
-- TOC entry 3647 (class 2604 OID 16574)
-- Name: orderbook_bids_snap id; Type: DEFAULT; Schema: private; Owner: nathaniel
--

ALTER TABLE ONLY private.orderbook_bids_snap ALTER COLUMN id SET DEFAULT nextval('private.orderbook_bids_snap_id_seq'::regclass);


--
-- TOC entry 3648 (class 2604 OID 16575)
-- Name: orderbook_snap id; Type: DEFAULT; Schema: private; Owner: nathaniel
--

ALTER TABLE ONLY private.orderbook_snap ALTER COLUMN id SET DEFAULT nextval('private.orderbook_snap_id_seq'::regclass);


--
-- TOC entry 3649 (class 2604 OID 16577)
-- Name: event_pending eid; Type: DEFAULT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.event_pending ALTER COLUMN eid SET DEFAULT nextval('public.event_pending_eid_seq'::regclass);


--
-- TOC entry 3657 (class 2604 OID 17052)
-- Name: node id; Type: DEFAULT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.node ALTER COLUMN id SET DEFAULT nextval('public.node_id_seq'::regclass);


--
-- TOC entry 3650 (class 2604 OID 16578)
-- Name: orderbook_asks_snap id; Type: DEFAULT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.orderbook_asks_snap ALTER COLUMN id SET DEFAULT nextval('public.orderbook_asks_snap_id_seq'::regclass);


--
-- TOC entry 3651 (class 2604 OID 16579)
-- Name: orderbook_bids_snap id; Type: DEFAULT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.orderbook_bids_snap ALTER COLUMN id SET DEFAULT nextval('public.orderbook_bids_snap_id_seq'::regclass);


--
-- TOC entry 3652 (class 2604 OID 16580)
-- Name: orderbook_snap id; Type: DEFAULT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.orderbook_snap ALTER COLUMN id SET DEFAULT nextval('public.orderbook_snap_id_seq'::regclass);


--
-- TOC entry 3654 (class 2604 OID 16581)
-- Name: role id; Type: DEFAULT; Schema: useraccesscontrol; Owner: nathaniel
--

ALTER TABLE ONLY useraccesscontrol.role ALTER COLUMN id SET DEFAULT nextval('useraccesscontrol.role_id_seq'::regclass);


--
-- TOC entry 3655 (class 2604 OID 16582)
-- Name: session sid; Type: DEFAULT; Schema: useraccesscontrol; Owner: nathaniel
--

ALTER TABLE ONLY useraccesscontrol.session ALTER COLUMN sid SET DEFAULT nextval('useraccesscontrol.session_sid_seq'::regclass);


--
-- TOC entry 3656 (class 2604 OID 16583)
-- Name: sso id; Type: DEFAULT; Schema: useraccesscontrol; Owner: nathaniel
--

ALTER TABLE ONLY useraccesscontrol.sso ALTER COLUMN id SET DEFAULT nextval('useraccesscontrol.sso_id_seq'::regclass);


--
-- TOC entry 3659 (class 2606 OID 16585)
-- Name: event event_pkey; Type: CONSTRAINT; Schema: private; Owner: nathaniel
--

ALTER TABLE ONLY private.event
    ADD CONSTRAINT event_pkey PRIMARY KEY (eid);


--
-- TOC entry 3661 (class 2606 OID 16587)
-- Name: orderbook_asks_snap orderbook_asks_snap_pkey; Type: CONSTRAINT; Schema: private; Owner: nathaniel
--

ALTER TABLE ONLY private.orderbook_asks_snap
    ADD CONSTRAINT orderbook_asks_snap_pkey PRIMARY KEY (id);


--
-- TOC entry 3663 (class 2606 OID 16589)
-- Name: orderbook_bids_snap orderbook_bids_snap_pkey; Type: CONSTRAINT; Schema: private; Owner: nathaniel
--

ALTER TABLE ONLY private.orderbook_bids_snap
    ADD CONSTRAINT orderbook_bids_snap_pkey PRIMARY KEY (id);


--
-- TOC entry 3665 (class 2606 OID 16591)
-- Name: orderbook_snap orderbook_snap_pkey; Type: CONSTRAINT; Schema: private; Owner: nathaniel
--

ALTER TABLE ONLY private.orderbook_snap
    ADD CONSTRAINT orderbook_snap_pkey PRIMARY KEY (id);


--
-- TOC entry 3667 (class 2606 OID 16593)
-- Name: errorprioritizeswithdrawstatus errorprioritizeswithdrawstatus_pkey; Type: CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.errorprioritizeswithdrawstatus
    ADD CONSTRAINT errorprioritizeswithdrawstatus_pkey PRIMARY KEY (exchange, currency);


--
-- TOC entry 3669 (class 2606 OID 16595)
-- Name: event_pending event_pending_pkey; Type: CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.event_pending
    ADD CONSTRAINT event_pending_pkey PRIMARY KEY (eid);


--
-- TOC entry 3698 (class 2606 OID 17262)
-- Name: event event_pkey; Type: CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.event
    ADD CONSTRAINT event_pkey PRIMARY KEY (eid);


--
-- TOC entry 3671 (class 2606 OID 16599)
-- Name: exchangeexceptions exchangeexceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.exchangeexceptions
    ADD CONSTRAINT exchangeexceptions_pkey PRIMARY KEY (exchange, action);


--
-- TOC entry 3692 (class 2606 OID 17056)
-- Name: node node_pkey; Type: CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_pkey PRIMARY KEY (id);


--
-- TOC entry 3673 (class 2606 OID 16601)
-- Name: orderbook_asks_snap orderbook_asks_snap_pkey; Type: CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.orderbook_asks_snap
    ADD CONSTRAINT orderbook_asks_snap_pkey PRIMARY KEY (id);


--
-- TOC entry 3675 (class 2606 OID 16603)
-- Name: orderbook_bids_snap orderbook_bids_snap_pkey; Type: CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.orderbook_bids_snap
    ADD CONSTRAINT orderbook_bids_snap_pkey PRIMARY KEY (id);


--
-- TOC entry 3677 (class 2606 OID 16605)
-- Name: orderbook_snap orderbook_snap_pkey; Type: CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.orderbook_snap
    ADD CONSTRAINT orderbook_snap_pkey PRIMARY KEY (id);


--
-- TOC entry 3679 (class 2606 OID 16607)
-- Name: tickers tickers_pkey; Type: CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.tickers
    ADD CONSTRAINT tickers_pkey PRIMARY KEY (exchange, symbol);


--
-- TOC entry 3681 (class 2606 OID 16609)
-- Name: transferfees transferfees_idx_desc; Type: CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.transferfees
    ADD CONSTRAINT transferfees_idx_desc UNIQUE (exchange, currency, description);


--
-- TOC entry 3683 (class 2606 OID 16611)
-- Name: transferfees transferfees_pkey; Type: CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.transferfees
    ADD CONSTRAINT transferfees_pkey PRIMARY KEY (exchange, currency);


--
-- TOC entry 3694 (class 2606 OID 17110)
-- Name: wallet wallet_exchange_currency_value_key; Type: CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.wallet
    ADD CONSTRAINT wallet_exchange_currency_value_key UNIQUE (exchange, currency, value);


--
-- TOC entry 3696 (class 2606 OID 17108)
-- Name: wallet wallet_pkey; Type: CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.wallet
    ADD CONSTRAINT wallet_pkey PRIMARY KEY (id);


--
-- TOC entry 3685 (class 2606 OID 16613)
-- Name: walletstatus walletstatus_pkey; Type: CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.walletstatus
    ADD CONSTRAINT walletstatus_pkey PRIMARY KEY (exchange, symbol);


--
-- TOC entry 3687 (class 2606 OID 16615)
-- Name: session session_pkey; Type: CONSTRAINT; Schema: useraccesscontrol; Owner: nathaniel
--

ALTER TABLE ONLY useraccesscontrol.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- TOC entry 3690 (class 2606 OID 16617)
-- Name: sso sso_pkey; Type: CONSTRAINT; Schema: useraccesscontrol; Owner: nathaniel
--

ALTER TABLE ONLY useraccesscontrol.sso
    ADD CONSTRAINT sso_pkey PRIMARY KEY (useremail);


--
-- TOC entry 3699 (class 1259 OID 17263)
-- Name: event_transaction_tag_tagid_key; Type: INDEX; Schema: public; Owner: nathaniel
--

CREATE UNIQUE INDEX event_transaction_tag_tagid_key ON public.event USING btree (transaction_tag, tagid);


--
-- TOC entry 3688 (class 1259 OID 16620)
-- Name: uac_session_useremail_idx; Type: INDEX; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE UNIQUE INDEX uac_session_useremail_idx ON useraccesscontrol.session USING btree (((session ->> 'useremail'::text)));


--
-- TOC entry 3705 (class 2620 OID 16622)
-- Name: tickers update_datetime_ticker; Type: TRIGGER; Schema: public; Owner: nathaniel
--

CREATE TRIGGER update_datetime_ticker BEFORE UPDATE ON public.tickers FOR EACH ROW EXECUTE FUNCTION public.update_datetime();


--
-- TOC entry 3706 (class 2620 OID 16623)
-- Name: sso default_roles; Type: TRIGGER; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE TRIGGER default_roles AFTER UPDATE ON useraccesscontrol.sso FOR EACH ROW EXECUTE FUNCTION useraccesscontrol.default_roles_proc();


--
-- TOC entry 3707 (class 2620 OID 16624)
-- Name: sso default_roles_insert; Type: TRIGGER; Schema: useraccesscontrol; Owner: nathaniel
--

CREATE TRIGGER default_roles_insert AFTER INSERT ON useraccesscontrol.sso FOR EACH ROW EXECUTE FUNCTION useraccesscontrol.default_roles_proc();


--
-- TOC entry 3700 (class 2606 OID 16625)
-- Name: event event_orderbookid_fkey; Type: FK CONSTRAINT; Schema: private; Owner: nathaniel
--

ALTER TABLE ONLY private.event
    ADD CONSTRAINT event_orderbookid_fkey FOREIGN KEY (orderbookid) REFERENCES private.orderbook_snap(id) ON DELETE RESTRICT;


--
-- TOC entry 3701 (class 2606 OID 16630)
-- Name: orderbook_asks_snap orderbook_asks_snap_orderbookid_fkey; Type: FK CONSTRAINT; Schema: private; Owner: nathaniel
--

ALTER TABLE ONLY private.orderbook_asks_snap
    ADD CONSTRAINT orderbook_asks_snap_orderbookid_fkey FOREIGN KEY (orderbookid) REFERENCES private.orderbook_snap(id) ON DELETE CASCADE;


--
-- TOC entry 3704 (class 2606 OID 17057)
-- Name: node node_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.node
    ADD CONSTRAINT node_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.node(id);


--
-- TOC entry 3702 (class 2606 OID 16645)
-- Name: orderbook_asks_snap orderbook_asks_snap_orderbookid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.orderbook_asks_snap
    ADD CONSTRAINT orderbook_asks_snap_orderbookid_fkey FOREIGN KEY (orderbookid) REFERENCES public.orderbook_snap(id) ON DELETE CASCADE;


--
-- TOC entry 3703 (class 2606 OID 16650)
-- Name: orderbook_bids_snap orderbook_bids_snap_orderbookid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nathaniel
--

ALTER TABLE ONLY public.orderbook_bids_snap
    ADD CONSTRAINT orderbook_bids_snap_orderbookid_fkey FOREIGN KEY (orderbookid) REFERENCES public.orderbook_snap(id) ON DELETE CASCADE;


-- Completed on 2026-04-10 20:35:35 EDT

--
-- PostgreSQL database dump complete
--

\unrestrict ExGkTvXKbo43PAPLw2tfGLKwxIr28doLIjXm5ou6mNBAFWB4xdHb0G16hLO9sG6

