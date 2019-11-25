const array1 = [1, 4, 9, 16];
// pass a function to map
const map1 = array1.map(x => {
    return x * 2
});
let removeMe = 9
array1.splice(array1.indexOf(removeMe), 1)
console.log(array1);
console.log(map1);
