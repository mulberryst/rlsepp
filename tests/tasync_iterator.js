const Iterable = require('./librlsepp/js/lib/iterator').Iterable
  , IxDictionary = require('./librlsepp/js/lib/ixdictionary')
;

const asyncIterator = {
  next: () => Promise.reject(new Error('Oops!'))
};

const asyncIterable = {
  [Symbol.asyncIterator]: () => asyncIterator
};

main().catch(error => console.error(error.stack))
  .then( () => main().catch(error => console.error(error.stack)))

async function main() {
  let data = ['ab', 'cd', 'ef']

  let it = new IxDictionary(data)

  it[3] = 'gh'
  for (let [f,t] of it.Iterable('fromToRoundRobin')) console.log(f+'=>'+t)
  for await (let [f,t] of it.Iterable('fromToRoundRobin')) console.log(f+'=>'+t)

  for (let e of it) console.log(e)
  for await (let e of it) console.log(e)
//  it.iterable(it.itFromTo, it.aitFromTo)
//  it[Symbol.asyncIterator] = () => it.aitFromTo()

  try {
//    for await (const value of it) console.log(value)
//    await it.asyncForEach((f,t) => console.log(f+"->"+t))

    for await (let [f,t] of it.Iterable('fromTo')) console.log(f+"->"+t)
  } catch (error) {
    throw error
    // Prints "Caught: Oops!"
    console.log('Caught:', error.message);
  }
}
