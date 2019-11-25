var _ = require('lodash');
var async = require('async');
var Emitter = require('./emitter');

var util = require(__dirname + '/util');

var log = require(util.dirs().core + 'log');

var config = util.getConfig();
var pluginDir = util.dirs().plugins;
var gekkoMode = util.gekkoMode();

var inherits = function (ctor, superCtor) { 
  
   if (ctor === undefined || ctor === null) 
     throw new ERR_INVALID_ARG_TYPE('ctor', 'Function', ctor); 
  
   if (superCtor === undefined || superCtor === null) 
     throw new ERR_INVALID_ARG_TYPE('superCtor', 'Function', superCtor); 
  
   if (superCtor.prototype === undefined) { 
     throw new ERR_INVALID_ARG_TYPE('superCtor.prototype', 
                                    'Function', superCtor.prototype); 
   } 
   ctor.super_ = superCtor; 
//  ctor.prototype.__proto__ = Object.create(superCtor.prototype)
   Object.setPrototypeOf(ctor.prototype, superCtor.prototype); 
//     ctor.prototype = Object.create(superCtor.prototype);
   } 
var inherits = require('util').inherits;

  var pluginHelper = {
    // Checks whether we can load a module

    // @param Object plugin
    //    plugin config object
    // @return String
    //    error message if we can't
    //    use the module.
    cannotLoad: function(plugin) {

      // verify plugin dependencies are installed
      if(_.has(plugin, 'dependencies'))
        var error = false;

        _.each(plugin.dependencies, function(dep) {
          try {
            var a = require(dep.module);
          }
          catch(e) {
            log.error('ERROR LOADING DEPENDENCY', dep.module);

            if(!e.message) {
              log.error(e);
              util.die();
            }

            if(!e.message.startsWith('Cannot find module'))
              return util.die(e);

            error = [
              'The plugin',
              plugin.slug,
              'expects the module',
              dep.module,
              'to be installed.',
              'However it is not, install',
              'it by running: \n\n',
              '\tnpm install',
              dep.module + '@' + dep.version
            ].join(' ');
          }
        });

      return error;
    },
    // loads a plugin
    // 
    // @param Object plugin
    //    plugin config object
    // @param Function next
    //    callback
    load: async function(plugin, pipe_config, gekkoMode) {
      return new Promise((resolve, reject) => {

        plugin.config = pipe_config[plugin.slug];

        if(!plugin.config || !plugin.config.enabled) {
          reject("pluginHelper.load: missing config or not enabled for "+plugin.slug);
          return;
        }

        if(plugin.modes.indexOf(gekkoMode) == -1) {
          log.warn(
            'The plugin',
            plugin.name,
            'does not support the mode',
            gekkoMode + '.',
            'It has been disabled.'
          )
          reject("pluginHelper.load "+plugin.slug);
          return;
        }

        log.info('Setting up:');
        log.info('\t', plugin.name);
        log.info('\t', plugin.description);

        var cannotLoad = pluginHelper.cannotLoad(plugin);
        if(cannotLoad) {
          reject("pluginHelper.load cannotLoad"+plugin.slug);
          return;
        }

        if(plugin.path)
          var Constructor = require(pluginDir + plugin.path(pipe_config));
        else
          var Constructor = require(pluginDir + plugin.slug);

        let instance = null;
        inherits(Constructor, Emitter);
        instance = new Constructor(plugin);
        Emitter.call(instance);

        instance.meta = plugin;

        if(!plugin.silent)
          log.info('\n');
        resolve(instance);
        return;
      })
    }
  }

  module.exports = pluginHelper;
