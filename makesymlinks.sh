#!/bin/sh
CWD=$PWD
ln -s /home/nathaniel/src/git/blockchain/ccxt .
ln -s $CWD/ccxt/examples/js/arbitrage-pairs.js $CWD/ccxt/
ln -s $CWD/ccxt/examples/js/balances.js $CWD/ccxt/
#for i in `find librlsepp/js/lib -type f`; do echo $i; ln -s $CWD/$i $CWD/librlsepp/lib; done
#for i in `find librlsepp/perl/lib -type f`; do echo $i; ln -s $CWD/$i $CWD/librlsepp/lib; done
#for i in `find librlsepp/js/bin -type f`; do echo $i; ln -s `pwd`/$i librlsepp/bin; done
#for i in `find librlsepp/perl/bin -type f`; do echo $i; ln -s `pwd`/$i librlsepp/bin; done
#ln -s $CWD/librlsepp/lib $CWD/lib
#ln -s $CWD/librlsepp/etc/configMove.js config/default.js
