'use strict';

const Path = require('path');
const chalk = require('chalk');
const Table = require('cli-table')
const Config = require('../lib/config.js')
const esh = require('eshost');

exports.list = function list(config) {
  console.log(chalk.grey('Using config ', config.configPath));

  var table = new Table({
    head: ['name', 'type', 'path', 'args']
  });

  Object.keys(config.hosts).forEach(name => {
    const host = config.hosts[name];
    table.push([name, host.type, host.path || '', host.args || '']);
  })

  console.log(table.toString());
}

exports.add = function add(config, name, type, path, args) {
  console.log(chalk.grey('Using config ', config.configPath));

  if(config.hosts[name]) {
    console.log(chalk.red(`Host '${name}' already exists`));
    return;
  }

  if(esh.supportedHosts.indexOf(type) === -1) {
    console.log(
      chalk.red(
        `Host type '${type}' not supported. Supported host types are: ${esh.supportedHosts.join(', ')}`
      )
    );
    return;
  }

  if(path && !Path.isAbsolute(path)) {
    path = Path.join(process.cwd(), path);
  }

  config.hosts[name] = { type, path, args };
  config.save();
}

exports.delete = function deleteHost(config, name) {
  console.log(chalk.grey('Using config ', config.configPath));

  if(config.hosts[name]) {
    delete config.hosts[name];
    config.save(function (err) {
      if (err) {
        console.error(err.stack);
        process.exit(1);
        return;
      }
      console.log(`Host '${name}' removed`);
    });
  } else {
    console.log(`Host '${name}' not found`);
  }
}
