const _ = require('lodash');

const cache = {};

module.exports = {
  set: (name, val) => {
    cache[name] = val;
    return true;
  },
  get: name => {
    if(_.has(cache, name))
      return cache[name];
  },
  get_set: (name, val) => {
    if(_.has(cache, name)) {
      if (typeof cache[name] === 'undefined')
        cache[name] = val;
      return cache[name];
    } else {
      cache[name] = val;
      return true;
    }
  }
}
