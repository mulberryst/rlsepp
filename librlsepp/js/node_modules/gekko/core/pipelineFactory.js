/*

  A pipeline implements a full Gekko Flow based on a config and 
  a mode. The mode is an abstraction that tells Gekko what market
  to load (realtime, backtesting or importing) while making sure
  all enabled plugins are actually supported by that market.

  Read more here:
  https://gekko.wizb.it/docs/internals/architecture.html

*/


var util = require('./util');
var dirs = util.dirs();

var _ = require('lodash');

var log = require(dirs.core + 'log');
const async = require('async')
  , JSON = require('JSON')
//  , Promise = require('bluebird')
;

class Pipeline {
  constructor(settings) {
    _.bindAll(this);

    this.mode = settings.mode;
    this.config = {...settings.config};

    // all plugins
    this.plugins = [];
    // all emitting plugins
    this.emitters = {};
    // all plugins interested in candles
    this.candleConsumers = [];

    // prepare a GekkoStream
    this.GekkoStream = null;
    // utility to check and load plugins.
    this.pluginHelper = null;
    this.pluginHelperPromise = null;
    // meta information about every plugin that tells Gekko
    // something about every available plugin
    this.pluginParameters = null;
    // meta information about the events plugins can broadcast
    // and how they should hooked up to consumers.
    this.subscriptions = null;

    this.market = null;
  }
  init() {
    this.GekkoStream = require(dirs.core + 'gekkoStream');
    this.pluginHelper = require(dirs.core + 'pluginUtil');
    this.pluginHelperPromise = require(dirs.core + 'pluginAsyncHelper');
    this.pluginParameters = require(dirs.gekko + 'plugins');
    this.subscriptions = require(dirs.gekko + 'subscriptions');

    this.market = null;
    log.info('Setting up Gekko instance in', this.mode, 'mode');
    log.info('');
  }
}

class PipelineFactory {

 //let result = await Promise.all(_.map(responseJson, addEnabledProperty)); 
  // Instantiate each enabled plugin
  // 
  /*
  static loadPlugins(self) {
    let plugins = [];
    var current = Promise.resolve();
    Promise.map(Object.keys(self.pluginParameters), (param) => {
      let p = self.pluginParameters[param];
      let pc = self.config[p.slug];
      if (pc && pc.enabled) {
        current = current.then( () => {
          return self.pluginHelper.load( p , self.config, self.mode);
        });
        return current;
      }
    }).map( (plugin) => {
      console.log("plugin",plugin);
      plugins.push(plugin);
      return plugin;
    }).then((plugin) => {
      console.log("plugin",plugin);
      return plugin;
    }).catch(e => log.error(e));
    return plugins;
  }
  */
  static loadPlugins(self) {
    var promises = Object.keys(self.pluginParameters).map((param) => {
      let p = self.pluginParameters[param];
      let pc = self.config[p.slug];
      if (pc && pc.enabled) {

        const plugin = self.pluginHelperPromise.load( p , self.config, self.mode ).then(
           (res) => {
             return res;
           }).catch((e) => {
             let trace = new Error(e);
             log.error(e, e.fullStack)
           });
        return plugin;

      }
    });
    return promises;
  }

  /*
  static loadPlugins(self) {
//     return new Promise((resolve, reject) => {
    let p = Object.keys(self.pluginParameters).filter( async (param) => {
        let r = null;
        try {
          //this is returning a promise from async
          r = await self.pluginHelper.load(
            self.pluginParameters[param] , self.config, self.mode
          )
        } catch(e) {

        };
      if (r != null) {
        console.log(r);
        return r;
      }
      })
    console.log(p);
    return p;
  }
  */

  // Some plugins emit their own events, store
  // a reference to those plugins.
  static referenceEmitters(self) {
//    var self = this;
    _.each(self.plugins, function(plugin) {
      if(plugin.meta.emits)
        self.emitters[plugin.meta.slug] = plugin;
    });

    //next();
  }

  // Subscribe all plugins to other emitting plugins
  static subscribePlugins(self) {
//    var self = this;
    // events broadcasted by plugins
    var pluginSubscriptions = _.filter(
      self.subscriptions,
      sub => sub.emitter !== 'market'
    );

    // some events can be broadcasted by different
    // plugins, however the pipeline only allows a single
    // emitting plugin for each event to be enabled.
    _.each(
      pluginSubscriptions.filter(s => _.isArray(s.emitter)),
      subscription => {
        // cache full list
        subscription.emitters = subscription.emitter;
        var singleEventEmitters = subscription.emitter
          .filter(
            s => _.size(self.plugins.filter(p => p.meta.slug === s))
          );

        if(_.size(singleEventEmitters) > 1) {
          var error = `Multiple plugins are broadcasting`;
          error += ` the event "${subscription.event}" (${singleEventEmitters.join(',')}).`;
          error += 'This is unsupported.'
          util.die(error);
        } else {
          subscription.emitter = _.first(singleEventEmitters);
        }
      }
    );

    // subscribe interested plugins to
    // emitting plugins
    _.each(self.plugins, function(plugin) {
      _.each(pluginSubscriptions, function(sub) {

        if(plugin[sub.handler]) {
          // if a plugin wants to listen
          // to something disabled
          if(!self.emitters[sub.emitter]) {
            if(!plugin.meta.greedy) {

              let emitterMessage;
              if(sub.emitters) {
                emitterMessage = 'all of the emitting plugins [ ';
                emitterMessage += sub.emitters.join(', ');
                emitterMessage += ' ] are disabled.';
              } else {
                emitterMessage += 'the emitting plugin (' + sub.emitter;
                emitterMessage += ')is disabled.'
              }

              log.error([
                plugin.meta.name,
                'wanted to listen to event',
                sub.event + ',',
                'however',
                emitterMessage,
                plugin.meta.name + ' might malfunction because of it.'
              ].join(' '));
            }
            return;
          }

          // attach handler
          self.emitters[sub.emitter]
            .on(sub.event,
              plugin[
                sub.handler
              ])
        }

      });
    });

    // events broadcasted by the market
    var marketSubscriptions = _.filter(
      self.subscriptions,
      {emitter: 'market'}
    );

    // subscribe plugins to the market
    _.each(self.plugins, function(plugin) {
      _.each(marketSubscriptions, function(sub) {

        if(plugin[sub.handler]) {
          if(sub.event === 'candle')
            self.candleConsumers.push(plugin);
        }

      });
    });

    //next();
  }

  static prepareMarket(self) {
    if(self.mode === 'backtest' && self.config.backtest.daterange === 'scan')
      require(dirs.core + 'prepareDateRange')();
    /*
    if(self.mode === 'backtest' && self.config.backtest.daterange === 'scan')
      require(dirs.core + 'prepareDateRange')(next);
    else
      next();
      */
  }

  static setupMarket(self) {
    // load a market based on the config (or fallback to mode)
    let marketType;
    if(self.config.market)
      marketType = config.market.type;
    else
      marketType = self.mode;

    var Market = require(dirs.markets + marketType);

    self.market = new Market(self.config);
  }

  static subscribePluginsToMarket(self) {
//    var self = this;
    // events broadcasted by the market
    var marketSubscriptions = _.filter(
      self.subscriptions,
      {emitter: 'market'}
    );

    _.each(self.plugins, function(plugin) {
      _.each(marketSubscriptions, function(sub) {

        if(sub.event === 'candle')
          // these are handled via the market stream
          return;

        if(plugin[sub.handler]) {
          self.market.on(sub.event, plugin[sub.handler]);
        }

      });
    });

  }

  static create(settings) {
//    console.log('funkyAsync',settings);
    var self = null;
    try {
      self = new Pipeline(settings);
    } catch (rejectedValue) {
      log.error("pipelineFactory.createInit borked, ",rejectedValue);
      return util.die(rejectedValue, true);
    }
//    console.log('postFunky', self.config);
    return self;
  }

  static async createInit(settings) {
//    console.log('funkyAsync',settings);
    let self = PipelineFactory.create(settings);
//    console.log('postFunky',self.config);
    self.init();


    /*
    try {
      await PipelineFactory.loadPlugins(self);
    } catch (e) {
      util.die("createInit: "+e, true);
    }
    */

//    const p = await Promise.all(PipelineFactory.loadPlugins(self));
//    self.plugins = 
//    const p =  await Promise.all(PipelineFactory.loadPlugins(self));
//    console.log(JSON.stringify(p));
    self.plugins =  PipelineFactory.loadPlugins(self);
//    console.log("plugins: ", self.plugins);
    PipelineFactory.referenceEmitters(self);
    PipelineFactory.subscribePlugins(self);
    PipelineFactory.prepareMarket(self);
    PipelineFactory.setupMarket(self);
    PipelineFactory.subscribePluginsToMarket(self);

    var gekkoStream = new self.GekkoStream(self.plugins);

    self.market
      .pipe(gekkoStream)

    // convert JS objects to JSON string
    // .pipe(new require('stringify-stream')())
    // output to standard out
    // .pipe(process.stdout);

    self.market.on('end', gekkoStream.finalize);
    return self;
  }
}

module.exports = {
  Pipeline: Pipeline,
  PipelineFactory: PipelineFactory
}
