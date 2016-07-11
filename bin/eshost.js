#!/usr/bin/env node
'use strict';

const fs = require('fs');
const esh = require('eshost');
const yargs = require('yargs');
const Config = require('../lib/config.js')
const Path = require('path');
const chalk = require('chalk');
const hostManager = require('../lib/host-manager.js') ;

const usage = `
Usage: eshost [options] [input-file]
       eshost --list
       eshost --add [host name] [host type] <host path> <host arguments>
       eshost --delete [host name]
`.trim();

const yargv = yargs
  .strict()
  .usage(usage)
  .describe('e', 'eval a string')
  .alias('e', 'eval')
  .describe('h', 'select hosts by name')
  .alias('h', 'host')
  .describe('c', 'select a config file')
  .alias('c', 'config')
  .nargs('h', 1)
  .boolean('async', 'wait for realm destruction before reporting results')
  .alias('a', 'async')
  .boolean('l', 'list hosts')
  .alias('l', 'list')
  .describe('add', 'add a host')
  .nargs('add', 2)
  .describe('delete', 'delete a host')
  .nargs('delete', 1)
  .describe('args', 'set arguments for a host entry')
  .nargs('args', 1)
  .help('help')
  .example('eshost --list')
  .example('eshost --add d8 d8 path/to/d8 --args "--harmony"')
  .example('eshost test.js')
  .example('eshost -e "1+1"')
  .example('eshost -h d8 -h chakra test.js')
  .fail(function (msg, err) {
    if (err) {
      console.error(err.stack);
    } else {
      console.error(msg);
    }
    process.exit(1);
  });

const argv = yargv.argv;

let config;
if (argv.c) {
  config = new Config(argv.c);
} else {
  config = Config.defaultConfig();
}

let hosts;
if (Array.isArray(argv.h)) {
  hosts = argv.h;
} else if (typeof argv.h === 'string') {
  hosts = argv.h.split(',');
} else {
  hosts = Object.keys(config.hosts);
}

// list available hosts
if (argv.list) {
  hostManager.list(config);
  process.exit(0);
}

// add a host
if (argv.add) {
  hostManager.add(config, argv.add[0], argv.add[1], argv._[0], argv.args);
  console.log(`Host '${argv.add[0]}' added`);
  process.exit(0);
} else {
  if (argv.args) {
    console.error('Use --args with --add');
    process.exit(1);
  }
}

// delete a host
if (argv.delete) {
  hostManager.delete(config, argv.delete);
  console.log(`Host '${argv.delete}' deleted`);
  process.exit(0);
}

const file = argv._[0];
const evalString = argv.e;

process.stdin.setEncoding('utf8');

if (file) {
  const contents = fs.readFileSync(file, 'utf8');
  runInEachHost(contents, hosts);
} else if (argv.e) {
  runInEachHost(`print(${argv.e})`, hosts);
} else {
  let script = '';

  // check for stdin
  process.stdin.on('readable', function() {
    const chunk = process.stdin.read();

    if (chunk === null && script === '') {
      yargv.showHelp();
      process.exit(1);
    } else if (chunk !== null) {
      script += chunk;
    }
  });

  process.stdin.on('end', function () {
    runInEachHost(script, hosts);
  });
}

function runInHost(host, code) {
  let runner;
  esh.createAgent(host.type, { hostArguments: host.args, hostPath: host.path })
  .then(r => {
    runner = r;
    return runner.evalScript(code, { async: argv.async });
  })
  .then(function (result) {
    printHostResult(host.name, result);

    return runner.destroy();
  })
  .catch(e => {
    console.error(chalk.red('Failure attempting to eval script in agent: ' + e.message));
  })
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
  console.log("");
}
