#!/bin/sh
TOP=$PWD
cd node_modules/gekko/exchange && npm install .
git clone ssh://devel@grumman/git/librlsepp.git

cd $TOP && ./makesymlinks.sh
