'use strict';

const Path = require('path');
const chalk = require('chalk');
const Table = require('cli-table')
const Config = require('../lib/config.js')
const config = Config.config;
const esh = require('eshost');

exports.helpText = 'add/list/delete hosts';

const options = {
  args: {
    type: 'string',
    requiresArg: true
  },
  add: {
    alias: 'a',
    describe: 'add a host',
    nargs: 3,
    requiresArg: true
  },
  list: {
    alias: 'l',
    describe: 'list current hosts',
    boolean: true
  },
  delete: {
    alias: 'd',
    describe: 'remove a host',
    requiresArg: true
  }
};

exports.command = function (yargs) {
  const yargv = yargs
    .options(options)
    .help('help')

  const argv = yargv.argv;

  console.log(chalk.grey('Using config ', Config.configPath));

  if (argv.list) {
    return list();
  } else if (argv.add) {
    return add(
      argv.add[0],
      argv.add[1],
      argv.add[2],
      argv.args || '');
  } else if (argv.delete) {
    return deleteHost(argv.delete);
  } else {
    yargv.showHelp();
  }
}

function list() {
  var table = new Table({
    head: ['name', 'type', 'path', 'args']
  });

  Object.keys(config.hosts).forEach(name => {
    const host = config.hosts[name];
    table.push([name, host.type, host.path, host.args || '']);
  })

  console.log(table.toString());
}

function add(name, type, path, args) {
  if(config.hosts[name]) {
    console.log(chalk.red(`Host '${name}' already exists`));
    return;
  }

  if(esh.supportedHosts.indexOf(type) === -1) {
    console.log(
      chalk.red(
        `Host '${type}' not supported. Supported hosts are: ${esh.supportedHosts.join(', ')}`
      )
    );
    return;
  }

  if(!Path.isAbsolute(path)) {
    path = Path.join(process.cwd(), path);
  }

  config.hosts[name] = { type, path, args };
  Config.save(function (err) {
    if (err) {
      console.error(err);
      process.exit(1);
      return;
    }
    console.log(`Host '${name}' added`);
  });
}

function deleteHost(name) {
  if(config.hosts[name]) {
    delete config.hosts[name];
    Config.save(function (err) {
      if (err) {
        console.error(err);
        process.exit(1);
        return;
      }
      console.log(`Host '${name}' removed`);
    });
  } else {
    console.log(`Host '${name}' not found`);
  }
}
