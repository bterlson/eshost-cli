'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

class Config {
  constructor(configPath) {
    Object.defineProperty(this, 'configPath', {
      value: configPath
    });
    this.load();
  }

  load() {
    this.hosts = {}

    if (!fs.existsSync(this.configPath)) {
      return;
    }

    const contents = fs.readFileSync(this.configPath, 'utf8');

    if (!contents) {
      return;
    }

    const config = JSON.parse(contents);

    Object.keys(config).forEach(k => this[k] = config[k]);

    this.hosts = this.hosts || {};
  }

  save() {
    fs.writeFileSync(this.configPath, JSON.stringify(this, null, 2), 'utf8');
  }

  static defaultConfig() {
    return new Config(Config.defaultConfigPath);
  }
}

Config.defaultConfigPath = path.join(os.homedir(), '.eshost-config.json');

module.exports = Config;
