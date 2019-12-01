const _ = require('lodash')
  , fs = require('fs')
  , util = require('../../core/util.js')
  , dirs = util.dirs()
  , config = util.getConfig()
  , adapter = config[config.adapter]
  , log = require(dirs.core + 'log')
  , pg = require('pg')
  , pluginHelper = require(dirs.core + 'pluginUtil')
  , Pipeline = require(dirs.core + 'pipelineFactory').Pipeline
  , PGAdapter = require(dirs.gekko + adapter.path + '/PGAdapter').PGAdapter
;

class PGAwriter extends PGAdapter {
  processCandle(candle, done) {
    //let s = PGAdapter.getInstance();
    let s = this;
    s.cache.push(candle);
    if (s.cache.length > 1)
      s.writeCandles();

    done();
  };

  finalize(done) {
//    let s = PGAdapter.getInstance();
    let s = this;
    s.writeCandles();
    s.handlePool = null;
    s.handlePoolPostgres = null;
    done();
  }

  static getInstance() {
    if (_singleton == null)
      try {
        _singleton = PGAdapter.create();
      } catch(e) {
        util.die(e);
      };

    return _singleton;
  };

  constructor (settings) {
    super(settings);
  };
  done() {
    if (typeof this.candleWriterEventCallback === 'function')
      this.candleWriterEventCallback();
  }

  writeCandles() {
    log.debug("writeCandles")
    if(_.isEmpty(this.cache)){
      return;
    }

    //log.debug('Writing candles to DB!');
    _.each(this.cache, candle => {
            log.debug(candle)
      var stmt =  `
    BEGIN; 
    LOCK TABLE ${this.table} IN SHARE ROW EXCLUSIVE MODE; 
    INSERT INTO ${this.table}
    (start, open, high,low, close, vwp, volume, trades) 
    VALUES 
    (${candle.start.unix()}, ${candle.open}, ${candle.high}, ${candle.low}, ${candle.close}, ${candle.vwp}, ${candle.volume}, ${candle.trades}) 
    ON CONFLICT ON CONSTRAINT ${this.table}_start_key
    DO NOTHING; 
    COMMIT; 
    `;

      this.handlePool.connect((err,client,done) => {
        if(err) {
          util.die(err);
        }
        client.query(stmt, (err, res) => {
          done();
          if (err) {
            log.debug(err.stack)
          } else {
    //        log.debug(res)
          }
        });
      });
    });

    this.cache = [];
  } //writeCandles
  static create(settings) {
//    if (_singleton != null)
//      return _singleton;

    let self = null;
    try {
      self = new PGAwriter(settings);
    } catch (rejectedValue) {
      log.error("PGAdapter borked, ",rejectedValue);
      throw rejectedValue;
    }
//    _singleton = self;
    return self;
  };

  static createInit(candleWriterEventCB, settings) {
    let self = PGAwriter.create(settings);
    self.init(candleWriterEventCB, settings)
    return self;
  };
}

var generator = function(done, pluginMeta, pipe_config) {
  if (pipe_config == null)
    pipe_config = config;
//console.log('PGAdapter.generator',done, pluginMeta, pipe_config[config.adapter]);
  if(config.candleWriter.enabled) {
//    await PGAdapter.createInit(config);
    let adapter = null;
    try {
      adapter = PGAwriter.createInit(done, pipe_config[config.adapter]);
    } catch(e) {
      util.die(e);
    };
    return adapter; 
  }
};
module.exports = generator;
