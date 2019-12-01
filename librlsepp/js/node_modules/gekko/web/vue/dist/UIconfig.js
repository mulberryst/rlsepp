// Note: this file gets copied around, make sure you edit
// the UIconfig located at `gekko/web/vue/dist/UIconfig.js`.

// This config is used by both the frontend as well as the web server.
// see https://gekko.wizb.it/docs/installation/installing_gekko_on_a_server.html#Configuring-Gekko

const CONFIG = {
	//  this puppy is the backend run with --config config.js [no --ui]
	//  however, the port isn't opened until --ui is used instantiating the front end with seperate command
  headless: true,
  api: {
    host: '127.0.0.1',
    port: 3001,
    timeout: 120000 // 2 minutes
  },

  //  the ssl front end serving static pages will be served by nginx's proxy using ssl 443, however, this also needs to be set to 443 here for the websocket not to collide ports
  //
  ui: { 
    ssl: true,
    host: 'gekko.ewb.ai',
    port: 443,
    path: '/'
  },
  adapter: 'postgres'
}

if(typeof window === 'undefined')
  module.exports = CONFIG;
else
  window.CONFIG = CONFIG;
