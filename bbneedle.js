Promise.promisifyAll(needle);
var options = {};

var current = Promise.resolve();
Promise.map(URLs, function (URL) {
    current = current.then(function () {
        return needle.getAsync(URL, options);
    });
    return current;
}).map(function (responseAndBody) {
    return JSON.parse(responseAndBody[1]);
}).then(function (results) {
    return processAndSaveAllInDB(results);
}).then(function () {
    console.log('All Needle requests saved');
}).catch(function (e) {
    console.log(e);
});
