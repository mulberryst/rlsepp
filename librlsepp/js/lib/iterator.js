'use strict';
var _singleton = null;
class AsyncIterator {
  constructor(initial = null, opts = null) {
    this.index = 0
    this.collection = initial
  }
  static getInstance(data) {
    if (_singleton != null)
      return _singleton;
    try {
      _singleton = new AsyncIterator(data);
    } catch (e) {
      throw(e);
    }
    return _singleton;
  }
  static async next() {
    let s = AsyncIterator.getInstance()
    if (s.index >= s.collection.length) {
      // A conventional iterator would return a `{ done: true }`
      // object. An async iterator returns a promise that resolves
      // to `{ done: true }`
      return Promise.resolve({ done: true });
    }
    const value = s.collection[s.index++];
    return Promise.resolve({ value, done: false });
  }
}

module.exports = {
  Iterable: AsyncIterator
}
