#!/bin/sh
CWD=$PWD
#for i in `find librlsepp/js/lib -type f`; do echo $i; ln -s $CWD/$i $CWD/librlsepp/lib; done
#for i in `find librlsepp/perl/lib -type f`; do echo $i; ln -s $CWD/$i $CWD/librlsepp/lib; done
#for i in `find librlsepp/js/bin -type f`; do echo $i; ln -s `pwd`/$i librlsepp/bin; done
#for i in `find librlsepp/perl/bin -type f`; do echo $i; ln -s `pwd`/$i librlsepp/bin; done
#ln -s $CWD/librlsepp/lib $CWD/lib
ln -s node_modules/ccxt/examples/js/arbitrage-pairs.js .
ln -s node_modules/ccxt/examples/js/balances.js .
#ln -s $CWD/librlsepp/etc/configMove.js config/default.js
