"use strict";

const fs = require('fs');
const Path = require('path');
const configPath = Path.join(__dirname, '../local-config.js');
let config = {};

if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

config.hosts = config.hosts || {};

exports.config = config;
exports.save = function () {
  fs.writeFileSync(configPath, JSON.stringify(config), 'utf8');
}

