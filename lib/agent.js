'use strict';

const pkg = require(__dirname + '/../package.json');
const os = require('os');
const Utils = require('./utils').Utils;
const ApiRequest = require('./api_request').ApiRequest;
const Config = require('./config').Config;
const ConfigLoader = require('./config_loader').ConfigLoader;
const MessageQueue = require('./message_queue').MessageQueue;
const ProcessReporter = require('./reporters/process_reporter').ProcessReporter;
const CPUReporter = require('./reporters/cpu_reporter').CpuReporter;
const AllocationReporter = require('./reporters/allocation_reporter').AllocationReporter;
const AsyncReporter = require('./reporters/async_reporter').AsyncReporter;
const ErrorReporter = require('./reporters/error_reporter').ErrorReporter;

class Agent {

  constructor() {
    let self = this;

    self.SAAS_DASHBOARD_ADDRESS = 'https://agent-api.stackimpact.com';

    self.version = pkg.version;

    self.addon = undefined;

    self.agentStarted = false;
    self.agentDestroyed = false;

    self.runTs = undefined;
    self.runId = undefined;

    self.utils = new Utils(self);
    self.apiRequest = new ApiRequest(self);
    self.config = new Config(self);
    self.configLoader = new ConfigLoader(self);
    self.messageQueue = new MessageQueue(self);
    self.processReporter = new ProcessReporter(self);
    self.cpuReporter = new CPUReporter(self);
    self.allocationReporter = new AllocationReporter(self);
    self.asyncReporter = new AsyncReporter(self);
    self.errorReporter = new ErrorReporter(self);

    self.options = undefined;

    self.profilerLock = false;
  }


  getOption(name, defaultVal) {
    let self = this;

    if (!self.options || !self.options[name]) {
      return defaultVal;
    }
    else {
      return self.options[name];
    }
  }


  start(opts) {
    let self = this;

    self.options = opts;

    if (!self.minVersion(4, 0, 0)) {
      throw new Error('Supported Node.js version 4.0.0 or higher');
    }

    // disable CPU profiler by default starting 7.0 until the memory leak is fixed.
    if (opts.cpuProfilerDisabled === undefined && self.minVersion(7, 0, 0)) {
      opts.cpuProfilerDisabled = true;
    }

    // disable allocation profiler by default until it's the V8 API's are stable.
    if (opts.allocationProfilerDisabled === undefined) {
      opts.allocationProfilerDisabled = true;
    }

    try {
      self.addon = require('../build/Release/stackimpact-addon.node');
      if (!self.addon || !self.addon.readHeapStats()) {
        throw new Error('Error loading the addon');
      }
    }
    catch(err) {
      self.exception(err);
      return;
    }

    if (self.agentDestroyed) {
      self.log('Destroyed agent cannot be started');
      return;
    }

    if (self.agentStarted) {
      return;
    }

    if (!self.options['dashboardAddress']) {
      self.options['dashboardAddress'] = self.SAAS_DASHBOARD_ADDRESS;
    }

    if (!self.options['agentKey']) {
      throw new Error('missing option: agentKey');
    }

    if (!self.options['appName']) {
      throw new Error('missing option: appName');
    }

    if (!self.options['hostName']) {
      self.options['hostName'] = os.hostname();
    }    

    self.runId = self.utils.generateUuid();
    self.runTs = self.utils.timestamp();

    self.apiRequest.start();
    self.configLoader.start();
    self.messageQueue.start();
    self.processReporter.start();
    self.cpuReporter.start();
    self.allocationReporter.start();
    self.asyncReporter.start();
    self.errorReporter.start();


    function exitHandler() { 
      if (!self.agentStarted || self.agentDestroyed) {
        return;
      }

      try {
        self.messageQueue.flush();
        self.destroy();
      }
      catch(err) {
        self.exception(err);
      }
    }

    process.once('exit', exitHandler);

    self.agentStarted = true;
    self.log('Agent started');
  }


  destroy() {
    let self = this;  

    if (!self.agentStarted) {
      self.log('Agent has not been started');
      return;
    }

    if (self.agentDestroyed) {
      return;
    }

    self.processReporter.destroy();
    self.cpuReporter.destroy();
    self.allocationReporter.destroy();
    self.asyncReporter.destroy();
    self.errorReporter.destroy();
    self.configLoader.destroy();
    self.messageQueue.destroy();

    self.agentDestroyed = true;
    self.log('Agent destroyed');
  }


  minVersion(major, minor, patch) {
    let m = process.version.match(/v?(\d+)\.(\d+)\.(\d+)/);
    return parseInt(m[1]) >= major && parseInt(m[2]) >= minor && parseInt(m[3]) >= patch;
  }


  logPrefix() {
    let self = this;  

    function pad(num) {
      return (num < 10 ? '0' + num : '' + num);
    }

    let d = new Date();
    return `[${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${d.getMilliseconds()}] StackImpact ${self.version}:`;
  }


  log(message) {
    let self = this;  

    if (self.getOption('debug')) {
      console.log(self.logPrefix(), message);
    }
  }


  error(message) {
    let self = this;  

    if (self.getOption('debug')) {
      console.error(self.logPrefix(), message);
    }
  }


  exception(err) {
    let self = this;  

    if (self.getOption('debug')) {
      console.error(self.logPrefix(), err.message);
      console.error(self.logPrefix(), err.stack);
    }
  }


  setTimeout(func, t) {
    let self = this;  

    return setTimeout(() => {
      try {
        func.call(this);
      }
      catch (err) {
        self.exception(err);
      }
    }, t);
  }


  setInterval(func, t) {
    let self = this;  

    return setInterval(() => {
      try {
        func.call(this);
      }
      catch (err) {
        self.exception(err);
      }
    }, t);
  }
}

exports.Agent = Agent;

