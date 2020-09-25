#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const chalk = require('chalk');
const esh = require('eshost');
const styles = require('ansi-styles');
const Table = require('cli-table');
const uniqueTempDir = require('unique-temp-dir');
const yargs = require('yargs');

const Config = require('../lib/config')
const DefaultReporter = require('../lib/reporters/default');
const hostManager = require('../lib/host-manager') ;
const TableReporter = require('../lib/reporters/table');

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
  .describe('color', 'specify the color to use in output, eg. --color.error red --color.header blue')
  .describe('no-color', 'do not colorize output')
  .boolean('no-color')
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
  .describe('module', 'evaluate expression as module code')
  .boolean('module')
  .alias('m', 'module')
  .describe('raw', 'evaluate raw code, with no runtime helpers')
  .boolean('raw')
  .alias('r', 'raw')
  .default('r', false, '"raw" defaults to "false"')
  .boolean('l', 'list hosts')
  .alias('l', 'list')
  .describe('add', 'add a host')
  .nargs('add', 2)
  .describe('edit', 'edit a host')
  .nargs('edit', 1)
  .describe('delete', 'delete a host')
  .nargs('delete', 1)
  .describe('delete-all', 'delete all hosts')
  .describe('args', 'set arguments for a host entry (use with --add)')
  .nargs('args', 1)
  .describe('configure-esvu', 'Configure esvu hosts in the config')
  .boolean('configure-esvu')
  .describe('esvu-prefix', '[OPTIONAL] Set the prefix of the configured hosts. If prefix is "esvu" then hosts will be configured as, e.g., "esvu-sm". By default, no prefix (e.g. "sm"). Use this flag with --configure-esvu.')
  .nargs('esvu-prefix', 1)
  .describe('esvu-root', '[OPTIONAL] Use this path containing the .esvu folder (use this option if .esvu is located somewhere other than the home directory). Use this flag with --configure-esvu.')
  .nargs('esvu-root', 1)
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
  .example('eshost --configure-esvu')
  .example('eshost --configure-esvu --esvu-prefix esvu')
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
  .fail((msg, error) => {
    if (error) {
      console.error(error.stack);
    } else {
      console.log(msg);
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
  color: { error: 'magentaBright', header: 'grey', ...(argv.color || {}) },
  showSource: argv.showSource,
  unanimous: argv.unanimous
};

if (argv.noColors) {
  reporterOptions.color = false;
}

let invalidColor = Object.values(reporterOptions.color).find(color => !styles[color]);

if (invalidColor) {
  console.log(`Invalid color or style: "${invalidColor}"\n`);
  console.log(`Choose from:\n${Object.keys(styles).map(style => `- ${style}\n`).join('')}`);
  process.exit(1);
}

let reporter;
if (argv.table) {
  reporter = new TableReporter(reporterOptions);
} else {
  reporter = new DefaultReporter(reporterOptions);
}

if (argv.list || argv.add || argv.edit || argv.delete ||
    argv['delete-all'] || argv.configureEsvu || argv.configureJsvu) {
  const message = `Using config "${config.configPath}"`;
  console.log(
    argv.noColors ? message : chalk.grey(message)
  );
}
// list available hosts
if (argv.list) {
  hostManager.list(config);
  process.exit(0);
}


// add a host
if (argv.add) {
  hostManager.add(config, argv.add[0], argv.add[1], argv._[0], argv.args, hostTags);
  console.log(`Host "${argv.add[0]}" added`);
  process.exit(0);
}

// edit a host
if (argv.edit) {
  hostManager.edit(config, argv.edit, argv.args, hostTags);
  console.log(`Host "${argv.edit}" edited`);
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
  console.log(`Host "${argv.delete}" deleted`);
  process.exit(0);
}

// delete all hosts
if (argv['delete-all']) {
  hostManager.delete(config);
  process.exit(0);
}

if (argv.configureEsvu || argv.configureJsvu) {
  const vu = argv.configureEsvu
    ? 'esvu'
    : 'jsvu';
  const vuRoot = path.join(argv[`${vu}-root`] || os.homedir(), `.${vu}`);
  const vuPrefix = argv[`${vu}-prefix`] || '';
  hostManager.configureFromVersionUpdater(config, vu, vuRoot, vuPrefix);
  hostManager.list(config);
  process.exit(0);
}

let fileArg = argv._[0];
const raw = argv.raw;
const attrs = {
  flags: {
    raw,
  }
};

process.stdin.setEncoding('utf8');

if (fileArg) {
  const file = path.join(process.cwd(), fileArg);
  const contents = fs.readFileSync(file, 'utf8');
  const attrs = {
    flags: {
      raw: true,
      module: file.endsWith('.mjs') || argv.module
    }
  };
  runInEachHost({file, contents, attrs}, hosts);
} else {
  const file = path.join(uniqueTempDir(), generateTempFileName());
  const dirname = path.dirname(file);

  try {
    fs.statSync(dirname);
  } catch (error) {
    if (error.code === 'ENOENT') {
      try {
        fs.mkdirSync(dirname);
      } catch ({}) {
        // suppressed?
      }
    }
  }

  if (argv.e) {
    let contents = `print(${argv.e})`;
    fs.writeFileSync(file, contents);
    runInEachHost({file, contents, attrs}, hosts);
  } else if (argv.x) {
    let contents = argv.x;
    fs.writeFileSync(file, contents);
    runInEachHost({file, contents, attrs}, hosts);
  } else {
    let contents = '';

    console.log('(Press <ctrl>-D to execute)');

    let rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.prompt();

    rl.on('line', line => {
      line = line.trim();

      if (line === '' && contents === '') {
        yargv.showHelp();
        process.exit(1);
      } else {
        contents += `${line}\n`;
      }
    });

    rl.on('close', async () => {
      fs.writeFileSync(file, contents);
      await runInEachHost({file, contents, attrs}, hosts);
    });
  }
}

async function runInHost(testable, host) {
  let runner;
  const {
    args: hostArguments,
    path: hostPath,
    type: hostType,
  } = host;
  const shortName = '$262';
  await esh.createAgent(hostType, {
    hostArguments,
    hostPath,
    shortName,
  }).then(r => {
    runner = r;
    return runner.evalScript(testable, {
      async: argv.async || (testable.attrs && testable.attrs.flags && testable.attrs.flags.module),
      module: argv.module || (testable.attrs && testable.attrs.flags && testable.attrs.flags.module)
    });
  }).then(result => {
    reporter.result(host, result);
    return runner.destroy();
  }).catch(e => {
    const message = `Failure attempting to eval script in agent: ${e.stack}`;
    console.error(
      argv.noColors ? message : chalk.red(message)
    );
  });
}

async function runInEachHost(testable, hosts) {
  reporter.start(testable.contents);

  await Promise.all(
    hosts.map(name => {
      const host = config.hosts[name];
      host.name = name;
      return runInHost(testable, host);
    })
  ).then(() => reporter.end());
}


function generateTempFileName() {
  const now = Date.now();
  return `f-${now}-${process.pid}-${(Math.random() * 0x100000000 + 1).toString(36)}.js`;
}
