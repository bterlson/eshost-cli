#!/usr/bin/env node
'use strict';

const fs = require('fs');
const esh = require('eshost');
const yargs = require('yargs');
const Config = require('../lib/config.js')
const Path = require('path');
const chalk = require('chalk');

const hostManager = require('../lib/host-manager.js') ;
const Table = require('cli-table');
const DefaultReporter = require('../lib/reporters/default.js');
const TableReporter = require('../lib/reporters/table.js');

const usage = `
Usage: eshost [options] [input-file]
       eshost [options] -e "input-script"
       eshost --list
       eshost --add [host name] [host type] <host path> --args <host arguments>
       eshost --delete [host name]
`.trim();

const yargv = yargs
  .strict()
  .usage(usage)
  .describe('e', 'eval an expression and print the result')
  .alias('e', 'eval')
  .describe('x', 'execute a multi-statement program')
  .alias('x', 'execute')
  .describe('h', 'select hosts by name (glob syntax is supported as well)')
  .alias('h', 'host')
  .describe('g', 'select host groups by host type')
  .alias('g', 'hostGroup')
  .nargs('g', 1)
  .describe('tags', 'select hosts by tag')
  .nargs('tags', 1)
  .describe('c', 'select a config file')
  .alias('c', 'config')
  .describe('table', 'output in a table')
  .boolean('table')
  .alias('table', 't')
  .describe('coalesce', 'coalesce like output into a single entry')
  .boolean('coalesce')
  .alias('coalesce', 's')
  .describe('showSource', 'show input source')
  .boolean('showSource')
  .alias('showSource', 'i')
  .describe('unanimous', 'If all engines agree, exit(0) with no output, otherwise print and exit(1); implies --coalesce')
  .boolean('unanimous')
  .alias('unanimous', 'u')
  .nargs('h', 1)
  .describe('async', 'wait for realm destruction before reporting results')
  .boolean('async')
  .alias('a', 'async')
  .boolean('l', 'list hosts')
  .alias('l', 'list')
  .describe('add', 'add a host')
  .nargs('add', 2)
  .describe('edit', 'edit a host')
  .nargs('edit', 1)
  .describe('delete', 'delete a host')
  .nargs('delete', 1)
  .describe('args', 'set arguments for a host entry (use with --add)')
  .nargs('args', 1)
  .describe('configure-jsvu', 'Configure jsvu hosts in the config')
  .boolean('configure-jsvu')
  .describe('jsvu-prefix', '[OPTIONAL] Set the prefix of the configured hosts. If prefix is "jsvu" then hosts will be configured as, e.g., "jsvu-sm". By default, no prefix (e.g. "sm"). Use this flag with --configure-jsvu.')
  .nargs('jsvu-prefix', 1)
  .describe('jsvu-root', '[OPTIONAL] Use this path containing the .jsvu folder (use this option if .jsvu is located somewhere other than the home directory). Use this flag with --configure-jsvu.')
  .nargs('jsvu-root', 1)
  .help('help')
  .example('eshost --list')
  .example('eshost --add d8 d8 path/to/d8 --args "--harmony"')
  .example('eshost --add ch ch path/to/ch --tags latest')
  .example('eshost --add ch ch path/to/ch --tags latest,greatest')
  .example('eshost --configure-jsvu')
  .example('eshost --configure-jsvu --jsvu-prefix jsvu')
  .example('eshost test.js')
  .example('eshost -e "1+1"')
  .example('eshost -its -x "for (let i=0; i<10; ++i) { print(i) }"')
  .example('eshost -h d8 -h chakra test.js')
  .example('eshost -h d8,sm test.js')
  .example('eshost -g node,ch test.js')
  .example('eshost -h d8 -g node test.js')
  .example('eshost -h ch-*,node test.js')
  .example('eshost -h ch-1.?.? test.js')
  .example('eshost --tags latest test.js')
  .example('eshost --unanimous test.js')
  .fail(function (msg, err) {
    if (err) {
      console.error(err.stack);
    } else {
      console.error(msg);
    }
    process.exit(1);
  });

const argv = yargv.argv;

// --unanimous implies --coalesce
if (argv.unanimous) {
  argv.coalesce = true;
}

let config;
if (argv.c) {
  config = new Config(argv.c);
} else {
  config = Config.defaultConfig();
}

let hosts = [];
if (Array.isArray(argv.h)) {
  hosts = argv.h;
} else if (typeof argv.h === 'string') {
  hosts = argv.h.split(',');
}

// Add host glob matches to hosts
let newHosts = [];
for (let host of hosts) {
  if (host.indexOf('*') >= 0 || host.indexOf('?') >= 0) {
    let re = '^' + host
      .replace(/\./g, '\\.') // escape . with /\./
      .replace(/\*/g, '.*')  // change * to /.*/ for matches
      .replace(/\?/g, '.')   // change ? to /./ for matches
      + '$';
    let matcher = new RegExp(re);
    for (let hostName of Object.keys(config.hosts)) {
      if (matcher.test(hostName)) {
        newHosts.push(hostName);
      }
    }
  } else {
    newHosts.push(host);
  }
  hosts = newHosts;
}

let hostGroups;
if (Array.isArray(argv.g)) {
  hostGroups = argv.g;
} else if (typeof argv.g === 'string') {
  hostGroups = argv.g.split(',');
}

if (hostGroups) {
  for (let group of hostGroups) {
    for (let hostName of Object.keys(config.hosts)) {
      let hostType = config.hosts[hostName].type;
      if (group === hostType) {
        hosts.push(hostName);
      }
    }
  }
}

let hostTags;
if (Array.isArray(argv.tags)) {
  hostTags = argv.tags;
} else if (typeof argv.tags === 'string') {
  hostTags = argv.tags.split(',');
}

if (hostTags) {
  function includesAnyOf(a, b) {
    for (let x of a) {
      if (b.includes(x)) {
        return true;
      }
    }
    return false;
  }

  for (let hostName of Object.keys(config.hosts)) {
    let tags = config.hosts[hostName].tags;
    if (tags && includesAnyOf(tags, hostTags)) {
      hosts.push(hostName);
    }
  }
}

// if hosts is still empty, get all hosts from config
if (hosts.length === 0) {
  hosts = Object.keys(config.hosts);
}

hosts = [ ... new Set(hosts) ]; // take unique elements

let reporterOptions = {
  coalesce: argv.coalesce,
  showSource: argv.showSource,
  unanimous: argv.unanimous
};

let reporter;
if (argv.table) {
  reporter = new TableReporter(reporterOptions);
} else {
  reporter = new DefaultReporter(reporterOptions);
}

// list available hosts
if (argv.list) {
  hostManager.list(config);
  process.exit(0);
}

// add a host
if (argv.add) {
  hostManager.add(config, argv.add[0], argv.add[1], argv._[0], argv.args, hostTags);
  console.log(`Host '${argv.add[0]}' added`);
  process.exit(0);
}

// edit a host
if (argv.edit) {
  hostManager.edit(config, argv.edit, argv.args, hostTags);
  console.log(`Host '${argv.edit}' edited`);
  process.exit(0);
}

if (argv.args) {
  // at this point in execution, implies (argv.args && !(argv.add || argv.edit))
  console.error('Use --args with --add or --edit');
  process.exit(1);
}

// delete a host
if (argv.delete) {
  hostManager.delete(config, argv.delete);
  console.log(`Host '${argv.delete}' deleted`);
  process.exit(0);
}

if (argv['configure-jsvu']) {
  hostManager.configureJsvu(config, argv['jsvu-root'], argv['jsvu-prefix']);
}

const file = argv._[0];

process.stdin.setEncoding('utf8');

if (file) {
  const contents = fs.readFileSync(file, 'utf8');
  runInEachHost(contents, hosts);
} else if (argv.e) {
  runInEachHost(`print(${argv.e})`, hosts);
} else if (argv.x) {
  runInEachHost(argv.x, hosts);
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
  let promise;
  if (host.custom) {
    promise = esh.createCustomAgent(host.path, { hostArguments: host.args, hostPath: host.path });
  } else {
    promise = esh.createAgent(host.type, { hostArguments: host.args, hostPath: host.path });
  }
  let runner;
  return promise
  .then(r => {
    runner = r;
    return runner.evalScript(code, { async: argv.async });
  })
  .then(function (result) {
    reporter.result(host, result);
    return runner.destroy();
  })
  .catch(e => {
    console.error(chalk.red('Failure attempting to eval script in agent: ' + e.stack));
  })
}

function runInEachHost(code, hosts) {
  reporter.start(code);
  let promises = hosts.map(name => {
    const host = config.hosts[name];
    host.name = name;

    return runInHost(host, code);
  });

  Promise.all(promises).then(() => reporter.end());
}
