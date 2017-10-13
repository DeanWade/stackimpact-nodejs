'use strict';

const crypto = require('crypto');

class Utils {
  constructor(agent) {
    let self = this;

    self.agent = agent;
  }


  millis() {
    return Date.now();
  }


  hrmillis() {
    const t = process.hrtime();
    return t[0] * 1e3 + t[1] / 1e6;
  }


  timestamp() {
      return Math.floor(Date.now() / 1000);
  }


  generateUuid() {
      return crypto.randomBytes(16).toString('hex');
  }


  generateSha1(text) {
    let h = crypto.createHash('sha1');
    h.update(text);
    return h.digest('hex');
  }
}

exports.Utils = Utils;
