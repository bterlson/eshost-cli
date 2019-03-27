'use strict';

const fs = require('fs')
const os = require('os');
const path = require('path');

const chalk = require('chalk');
const Table = require('cli-table')

const Config = require('../lib/config')
const esh = require('eshost');

const head = [
  'name',
  'type',
  'path',
  'args',
  'tags',
];

const colWidths = head.map(h => h.length + 2);

exports.list = function list({configPath, hosts}) {
  console.log(chalk.grey('Using config ', configPath));

  const table = new Table({
    colWidths, head
  });

  const names = Object.keys(hosts);
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
      } = hosts[name];

      const row = [ name, type, path, args, tags ];
      const {colWidths: widths} = accum.options;

      // Update the stored colWidths for each cell, saving the largest/longest
      accum.options.colWidths = Array.from(widths, (width, index) => Math.max(width, String(row[index]).length + 2));

      accum.push(row);
      return accum;
    }, table).sort().toString();
  }

  console.log(output);
};

exports.add = function add(config, hostName, hostType, hostPath, hostArgs, hostTags) {
  console.log(chalk.grey('Using config ', config.configPath));

  if (config.hosts[hostName]) {
    console.log(chalk.red(`Host "${hostName}" already exists`));
    return;
  }

  if (!esh.supportedHosts.includes(hostType)) {
    console.log(
      chalk.red(
        `Host type "${hostType}" not supported. Supported host types are: ${esh.supportedHosts.join(', ')}`
      )
    );
    return;
  }

  if (hostPath && !path.isAbsolute(hostPath)) {
    hostPath = path.join(process.cwd(), hostPath);
  }

  config.hosts[hostName] = {
    type: hostType,
    path: hostPath,
    args: hostArgs,
    tags: hostTags,
  };
  config.save();
};

exports.edit = function edit(config, hostName, hostArgs, hostTags) {
  console.log(chalk.grey('Using config ', config.configPath));

  if (!config.hosts[hostName]) {
    console.log(chalk.red(`Host "${hostName}" does not exist`));
    process.exit(1);
    return;
  }

  if (hostArgs) {
    config.hosts[hostName].args = hostArgs;
  }

  if (hostTags) {
    config.hosts[hostName].tags = hostTags;
  }

  config.save();
};

exports.delete = function deleteHost(config, hostName) {
  console.log(chalk.grey('Using config ', config.configPath));

  if(config.hosts[hostName]) {
    delete config.hosts[hostName];
    config.save(err => {
      if (err) {
        console.error(err.stack);
        process.exit(1);
        return;
      }
      console.log(`Host '${hostName}' removed`);
    });
  } else {
    console.log(`Host '${hostName}' not found`);
  }
};

const JSVU_WEB_HOST_TAGS = ['jsvu','jsvu-web'];
const JSVU_PLAIN_HOST_TAGS = ['jsvu'];
const JSVU_HOST_TYPES = [
  ['ch', 'ch', JSVU_WEB_HOST_TAGS],
  ['jsc', 'jsc', JSVU_WEB_HOST_TAGS],
  ['sm', 'jsshell', JSVU_WEB_HOST_TAGS],
  ['v8', 'd8', JSVU_WEB_HOST_TAGS],
  ['xs', 'xs', JSVU_PLAIN_HOST_TAGS],
];

exports.configureJsvu = function configureJsvu(config, rootPath, hostPrefix = "") {
  if (!rootPath) {
    rootPath = os.homedir();
  }

  let jsvuRoot = path.resolve(rootPath, '.jsvu');
  if (!fs.existsSync(jsvuRoot)) {
    throw Error(`"${jsvuRoot}" not found`);
  }

  let extension = '';
  if (os.platform() === 'win32') {
    extension = '.cmd';
  }

  for (let host of JSVU_HOST_TYPES) {
    let [hostName, hostType, hostTags] = host;
    let hostPath = path.resolve(jsvuRoot, hostName + extension);

    if (!fs.existsSync(hostPath)) {
      console.log(chalk.red(`"${hostPath}" not found`));
      continue;
    }

    if (hostPrefix) {
      hostName = `${hostPrefix}-${hostName}`;
    }

    console.log(`Configuring jsvu host with name "${hostName}" (type "${hostType}") at "${hostPath}"`);
    exports.add(config, hostName, hostType, hostPath, undefined, hostTags);
  }
};
