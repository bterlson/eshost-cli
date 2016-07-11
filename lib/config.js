'use strict';

const fs = require('fs');
const Path = require('path');
const os = require('os');

class Config {
  constructor (path) {
    Object.defineProperty(this, 'configPath', { value: path });
    this.load();
  }

  load() {
    this.hosts = {}

    if (!fs.existsSync(this.configPath)) return;

    const contents = fs.readFileSync(this.configPath, 'utf8');
    if (!contents) return;

    const config = JSON.parse(contents);
    Object.keys(config).forEach(k => this[k] = config[k]);

    this.hosts = this.hosts || {};
  }

  save(cb) {
    fs.writeFileSync(this.configPath, JSON.stringify(this, null, 2), 'utf8');
  }

  static defaultConfig() {
    return new Config(Config.defaultConfigPath);
  }
}

Config.defaultConfigPath = Path.join(os.homedir(), '.eshost-config.json');

module.exports = Config;
