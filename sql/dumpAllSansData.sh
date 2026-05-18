#!/bin/sh

F=$1

if [ -z "$F" ]; then
  F=`pwd`/schema.all.sql
fi

echo -e "dumping schema to [$F], includes funcs procs and triggers\n"
ssh -L 5432:127.0.0.1:5432 db.grandstreet.group -- "pg_dump -v -h db.grandstreet.group -U postgres rlsepp -s" > $F
