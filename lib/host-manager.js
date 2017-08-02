'use strict';

const Path = require('path');
const chalk = require('chalk');
const Table = require('cli-table')
const Config = require('../lib/config.js')
const esh = require('eshost');

const head = [
  'name',
  'type',
  'path',
  'args',
  'tags',
];

const colWidths = Array(head.length).fill(0);

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
        return Math.max(width, String(row[index]).length) + 2;
      });

      accum.push(row);
      return accum;
    }, table).toString();
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
