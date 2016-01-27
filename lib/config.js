"use strict";

const fs = require('fs');
const Path = require('path');
const os = require('os');
const configPath = Path.join(os.homedir(), '.eshost-config.json');
let config = {};

if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

config.hosts = config.hosts || {};

exports.config = config;
exports.save = function (cb) {
  fs.writeFile(configPath, JSON.stringify(config), 'utf8', cb);
}

