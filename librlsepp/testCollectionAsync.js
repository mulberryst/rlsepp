let a = [1, 2, 3].map(n => n * 3);
let b = [1, 2, 3].reduce((total, n) => total + n);
let c = [1, 2, 3].filter(n => {if (n <= 2) return "wee"} );


const pipeline = [
  array => { array.pop(); return array; },
  array => array.reverse()
];

let d = pipeline.reduce((xs, f) => f(xs), [1, 2, 3]);

let e = [1, 2, 3, null, 4].filter(n => {
  if ( n != null ) 
    return n
});


//console.log(a,b,c, d, e);
console.log(c);
