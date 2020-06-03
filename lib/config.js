'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

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

    for (const hostName in this.hosts) {
      const host = this.hosts[hostName];

      if (typeof host !== 'object' || host === null) {
        continue;
      }

      host.path = this.resolvePath(host.path);
    }
  }

  resolvePath(input) {
    if (input.startsWith('~/')) {
      return path.join(os.homedir(), input.slice(2));
    } else if (input === '~') {
      return os.homedir();
    } else if (!path.isAbsolute(input)) {
      return path.join(path.dirname(this.configPath), input);
    } else {
      return input;
    }
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
