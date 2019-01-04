const JSON = require('JSON')
//  , List = require('./classes.js').List
  , Dictionary = require("dictionaryjs").Dictionary
;
/*
var a = [1,2,3,'four'];
a['four'] = 'four';

console.log(a);
for (let key of a.keys()) {
  console.log("a [k,v]",key, a[key]);
}
console.log(JSON.stringify(a));
*/
//   let foo = new List(1,2,3,4)
   let foo = new Dictionary();//(1,2,3,4)
   let bar = {cool: 'kids'}
   foo['hash'] = 'a bird flies through the mountains';
   foo['hashkey'] = bar;

  console.log("foo", foo)
console.log("object keys",Object.keys(foo))
console.log("object values",Object.values(foo))
console.log(foo[0])
console.log(foo['hash'])
console.log(foo['hashkey'])
  console.log("foo", foo)
   console.log(JSON.stringify(foo));
