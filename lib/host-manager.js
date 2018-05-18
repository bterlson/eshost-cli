'use strict';

const Path = require('path');
const chalk = require('chalk');
const Table = require('cli-table')
const Config = require('../lib/config.js')
const os = require('os');
const fs = require('fs')
const esh = require('eshost');

const head = [
  'name',
  'type',
  'path',
  'args',
  'tags',
];

const colWidths = head.map(h => h.length + 2);

exports.list = function list(config) {
  console.log(chalk.grey('Using config ', config.configPath));

  const table = new Table({
    colWidths, head
  });

  const names = Object.keys(config.hosts);
  let output;

  if (!names.length) {
    output = 'No configured hosts';
  } else {
    output = names.reduce((accum, name) => {
      const {
        type,
        path = '',
        args = '',
        tags = ''
      } = config.hosts[name];

      const row = [ name, type, path, args, tags ];
      const {colWidths: widths} = accum.options;

      // Update the stored colWidths for each cell, saving the largest/longest
      accum.options.colWidths = Array.from(widths, (width, index) => {
        return Math.max(width, String(row[index]).length + 2);
      });

      accum.push(row);
      return accum;
    }, table).sort().toString();
  }

  console.log(output);
};

exports.add = function add(config, name, type, path, args, tags) {
  console.log(chalk.grey('Using config ', config.configPath));

  if (config.hosts[name]) {
    console.log(chalk.red(`Host '${name}' already exists`));
    return;
  }

  if (esh.supportedHosts.indexOf(type) === -1) {
    console.log(
      chalk.red(
        `Host type '${type}' not supported. Supported host types are: ${esh.supportedHosts.join(', ')}`
      )
    );
    return;
  }

  if (path && !Path.isAbsolute(path)) {
    path = Path.join(process.cwd(), path);
  }

  config.hosts[name] = { type, path, args, tags };
  config.save();
}

exports.edit = function edit(config, name, args, tags) {
  console.log(chalk.grey('Using config ', config.configPath));

  if (!config.hosts[name]) {
    console.log(chalk.red(`Host '${name}' does not exist`));
    process.exit(1);
    return;
  }

  if (args) {
    config.hosts[name].args = args;
  }

  if (tags) {
    config.hosts[name].tags = tags;
  }

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

const JSVU_HOST_TYPES = [
  ['ch', 'ch'],
  ['jsc', 'jsc'],
  ['sm', 'jsshell'],
  ['v8', 'd8'],
  ['xs', 'xs'],
];

exports.configureJSVU = function configureJSVU(config, rootPath, hostPrefix = "") {
  if (!rootPath) {
    rootPath = os.homedir();
  }

  let jsvuRoot = Path.resolve(rootPath, '.jsvu');
  if (!fs.existsSync(jsvuRoot)) {
    throw Error(`'${jsvuRoot}' not found`);
  }

  let extention = '';
  if (os.platform() === 'win32') {
    extention = '.cmd';
  }

  for (let host of JSVU_HOST_TYPES) {
    let [hostName, hostType] = host;
    let hostPath = Path.resolve(jsvuRoot, hostName + extention);

    if (!fs.existsSync(hostPath)) {
      console.log(chalk.red(`'${hostPath}' not found`));
      continue;
    }

    if (hostPrefix) {
      hostName = `${hostPrefix}-${hostName}`;
    }

    console.log(`Configuring JSVU host with name '${hostName}' (type '${hostType}') at '${hostPath}'`);
    exports.add(config, hostName, hostType, hostPath);
  }
}
