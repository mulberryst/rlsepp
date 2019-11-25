const util = require('util') 

let exchanges = ["yobit", "livecoin", "gemini"]
  let itPath = function*() {
    yield* [...exchanges]
  }

//let exIt = ( function* => yield* [...exchanges])

//var funcName = (params) => params + 2
//funcName(2);
// 4

let e =itPath()
let first = e
e = itPath()
console.log("from "+util.inspect(first, false, null, true)+" to " + e)
for (let e of itPath()) console.log(e)


//function* fibonacci() { // a generator function
//let fibonacci = function*=>  { // a generator function
let fibonacci = (function *(){
  let [prev, curr] = [0, 1];
  while (true) {
    [prev, curr] = [curr, prev + curr];
    yield curr;
  }
})

for (const n of fibonacci()) {
  console.log(n);
  // truncate the sequence at 1000
  if (n >= 1000) {
    break;
  }
}


const nums = [1, 2, 3];

let index = 0;
const asyncIterator = {
  next: () => {
    if (index >= init.length) {
      // A conventional iterator would return a `{ done: true }`
      // object. An async iterator returns a promise that resolves
      // to `{ done: true }`
      return Promise.resolve({ done: true });
    }
    const value = init[index++];
    return Promise.resolve({ value, done: false });
  }
};

const asyncIterable = {
  // Note that async iterables use `Symbol.asyncIterator`, **not**
  // `Symbol.iterator`.
  [Symbol.asyncIterator]: () => asyncIterator
};

/***************************************
 *  void main(int argc, char** argv) {
 ***************************************/
main().catch(error => console.error(error.stack));

async function main() {
  // To be concise, just get the `next()` function
  const { next } = asyncIterable[Symbol.asyncIterator]();

  // Use a `for` loop with `await` to exhaust the iterable. Once
  // `next()` resolves to a promise with `done: true`, exit the
  // loop.
  for (let { value, done } = await next(); !done; { value, done } = await next()) {
    console.log(value); // Prints "1", "2", "3"
  }
}
