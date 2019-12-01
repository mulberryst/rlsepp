'use strict'
const isArray = function (a) {
    return Array.isArray(a);
};

const isObject = function (o) {
   if(o === undefined || o === null){
      return false;
   }
  return o === Object(o) && !isArray(o) && typeof o !== 'function';
};

const isIterable = function (obj){
   if(obj === undefined || obj === null){
      return false;
   }
   return typeof obj[Symbol.iterator] === 'function' 
}

const isAsyncIterable = function (obj){
   if(obj === undefined || obj === null){
      return false;
   }
   return typeof obj[Symbol.asyncIterator] === 'function' 
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array)
  }
}

const sortBy = (array, key, descending = false) => {
     descending = descending ? -1 : 1
     return array.sort ((a, b) => ((a[key] < b[key]) ? -descending : ((a[key] > b[key]) ? descending : 0)))
}

function formatUSD(x) {
  return Number.parseFloat(x).toFixed(2);
}
function formatBTC(x) {
  return Number.parseFloat(x).toFixed(8);
}
function formatCrypto(x) {
  if (Number.parseFloat(x) > 0)
    return Number.parseFloat(x).toFixed(8);
  else
    return x
}

module.exports = { 
  isArray, 
  isObject, 
  isIterable, 
  isAsyncIterable,
  asyncForEach,
  sortBy,
  formatUSD,
  formatBTC,
  formatCrypto
}

