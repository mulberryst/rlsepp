const _ = require('lodash');
const Aigle = require('aigle');
Aigle.mixin(_);

async function asyncFunc(foo)  {
  return Promise.resolve(foo);
}

// example 1
const array = [1, 2, 3];

(async function main() {
const result = await Aigle.map(array, asyncFunc);
// example 2
const result2 = await Aigle.chain(array)
  .map(asyncFunc)
  .sum()
  .value();
// or
const result3 = await Aigle.resolve(array)
  .map(asyncFunc)
  .sum();

console.log(result);
console.log(result2);
console.log(result3);
})();
