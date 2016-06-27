#!/usr/bin/env node
'use strict';

const fs = require('fs');
const esh = require('eshost');
const yargs = require('yargs');
const Config = require('../lib/config.js')
const config = Config.config;
const Path = require('path');
const chalk = require('chalk');
const hostManager = require('../lib/host-manager.js') ;

const yargv = yargs
  .usage('Usage: eshost [command] [options] [input-file]')
  .command('host', hostManager.helpText, hostManager.command)
  .describe('e', 'eval a string')
  .alias('e', 'eval')
  .describe('h', 'select hosts by name')
  .alias('h', 'host')
  .nargs('h', 1)
  .boolean('async', 'wait for realm destruction before reporting results')
  .alias('a', 'async')
  .help('help')
  .example('eshost host list')
  .example('eshost host --add d8 d8 path/to/d8')
  .example('eshost test.js')
  .example('eshost -e "1+1"')
  .example('eshost -h d8 -h chakra test.js')

const argv = yargv.argv;

let hosts;
if (Array.isArray(argv.h)) {
  hosts = argv.h;
} else if (typeof argv.h === 'string') {
  hosts = argv.h.split(',');
} else {
  hosts = Object.keys(config.hosts);
}

const command = argv._[0] === 'host' ? 'host' : null;
const file = !command ? argv._[0] : null;
const evalString = argv.e;

process.stdin.setEncoding('utf8');

if (file) {
  const contents = fs.readFileSync(file, 'utf8');
  runInEachHost(contents, hosts);
} else if (argv.e) {
  runInEachHost(`print(${argv.e})`, hosts);
} else if(!command) {
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
