// Gekko uses a custom event emitter within the GekkoStream (the plugins) to guarantee
// the correct order of events that are triggered by eachother. Turns sync events from
// LIFO into a FIFO stack based model.
//
// More details here: https://forum.gekko.wizb.it/thread-56579.html

const util = require('util');
const events = require('events');
const NativeEventEmitter = events.EventEmitter;

class GekkoEventEmitter extends NativeEventEmitter {
  constructor () { 
    super(); 
    this.defferedEvents = [];
  }

// push to stack
  deferredEmit(name, payload) {
    this.defferedEvents.push({name, payload});
  }

  // resolve FIFO
  broadcastDeferredEmit() {
    if(this.defferedEvents.length === 0)
      return false;

    const event = this.defferedEvents.shift();

    this.emit(event.name, event.payload);
    return true;
  }
}

Object.setPrototypeOf(GekkoEventEmitter.prototype, NativeEventEmitter.prototype);
module.exports = {
  GekkoEventEmitter: GekkoEventEmitter
}
