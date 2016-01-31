#!/usr/bin/env node
"use strict";

const fs = require('fs');
const esh = require('es-host-wrapper');
const yargs = require('yargs');
const Table = require('cli-table')
const Config = require('../lib/config.js')
const config = Config.config;
const Path = require('path');
const chalk = require('chalk');

const cmdConfigs = {
  host: {
    args: {
      type: 'string',
      requiresArg: true
    },
    add: {
      alias: 'a',
      describe: 'add a host',
      array: true
    },
    list: {
      alias: 'l',
      describe: 'list current hosts',
      boolean: true
    },
    delete: {
      alias: 'd',
      describe: 'remove a host',
      boolean: true
    }
  }
};

const cmdLists = Object.keys(cmdConfigs).reduce((accum, cmd) => {
  accum[cmd] = Object.keys(cmdConfigs[cmd]).sort();
  return accum;
}, {});

function hostCommand(yargs) {
  const argv = yargs
    .options(cmdConfigs.host)
    .help('help')
    .argv;

  if (argv.list) {
    var table = new Table({
      head: ['name', 'type', 'path', 'args']
    });

    Object.keys(config.hosts).forEach(name => {
      const host = config.hosts[name];
      table.push([name, host.type, host.path, host.args || ""]);
    })

    console.log(table.toString());
  } else if (argv.add) {
    const name = argv.add[0];
    const type = argv.add[1];
    let path = argv.add[2];
    let args = argv.args || "";
    args = args.trim();

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
  } else if (argv.delete) {
    const name = argv._[1];

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
}

const argv = yargs
  .usage('Usage: eshost [command] [options] [input-file]')
  .command('host', `${cmdLists.host.join('/')} hosts`, hostCommand)
  .describe('e', 'eval a string')
  .alias('e', 'eval')
  .describe('H', 'select a host name to run')
  .alias('H', 'host')
  .help('help')
  .argv;

const hosts = argv.H ? [].concat(argv.H) : Object.keys(config.hosts);

if (argv._[0] !== undefined && argv._[0] !== 'host') {
  const file = fs.readFileSync(argv._[0], 'utf8');

  runInEachHost(file, hosts);
} else if (argv.e) {
  runInEachHost(argv.e, hosts);
}

function runInHost(host, code) {
  const runner = esh.getRunner(host.path, host.type, host.args);

  runner.exec(code).then(function (result) {
    printHostResult(host.name, result);
    console.log("");
  });
}

function runInEachHost(code, hosts) {
  hosts.forEach(name => {
    const host = config.hosts[name];
    host.name = name;

    runInHost(host, code);
  });
}

function printHostResult(name, result) {
  console.log(chalk.blue(`#### ${name}`));
  console.log(result.stdout.trim());

  if (result.error) {
    console.log(chalk.red(`${result.error.name}: ${result.error.message}`));
  }
}
