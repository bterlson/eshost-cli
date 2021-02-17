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

exports.list = ({configPath, hosts}) => {
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

exports.add = (config, hostName, hostType, hostPath, hostArgs, hostTags) => {
  if (config.hosts[hostName]) {
    console.log(chalk.red(`Host "${hostName}" already exists`));
    return;
  }

  if (!esh.supportedHosts.includes(hostType)) {
    console.log(
      chalk.red(
        `Host type "${hostType}" not supported. Supported host types are: "${esh.supportedHosts.join(", ")}"`
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

exports.edit = (config, hostName, hostArgs, hostTags) => {
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

exports.delete = (config, hostName) => {
  if (!hostName) {
    Object.keys(config.hosts).forEach(hostName => exports.delete(config, hostName));
  } else {
    if (config.hosts[hostName]) {
      delete config.hosts[hostName];
      config.save();
      console.log(`Host "${hostName}" removed`);
    } else {
      console.log(`Host "${hostName}" not found`);
    }
  }
};

const VU_BIN_PATH = {
  esvu: 'bin',
  jsvu: '',
};

const VU_HOST_DETAILS = {
  /*
      hostName
      binaryName
      hostType
      hostTags
  */
  esvu: {
    ch: ['ChakraCore', 'chakra', 'ch', ['web']],
    engine262: ['engine262', 'engine262', 'engine262', ['']],
    graaljs: ['GraalJS', 'graaljs', 'graaljs', ['']],
    hermes: ['Hermes', 'hermes', 'hermes', ['']],
    jsc: ['JavaScriptCore', 'jsc', 'jsc', ['web']],
    jsshell: ['SpiderMonkey', 'sm', 'jsshell', ['web']],
    qjs: ['QuickJS', 'quickjs-run-test262', 'qjs', ['embedded']],
    v8: ['V8', 'v8', 'd8', ['web']],
    xs: ['Moddable XS', 'xs', 'xs', ['embedded']],
  },
  jsvu: {
    chakra: ['ChakraCore', 'chakra', 'ch', ['web']],
    hermes: ['Hermes', 'hermes', 'hermes', ['']],
    javascriptcore: ['JavaScriptCore', 'jsc', 'jsc', ['web']],
    // This version of quickjs does not include the necessary
    // host defined environment extensions to execute code in
    // eshost.
    quickjs: ['QuickJS', 'quickjs', ['']],
    spidermonkey: ['SpiderMonkey', 'sm', 'jsshell', ['web']],
    v8: ['V8', 'v8', 'd8', ['web']],
    xs: ['Moddable XS', 'xs', 'xs', ['embedded']],
  }
};

exports.configureFromVersionUpdater = (config, vu, vuRoot, hostPrefix = '') => {
  if (!fs.existsSync(vuRoot)) {
    throw Error(`Version Updater "${vu}" config root "${vuRoot}" not found`);
  }

  const status = require(path.join(vuRoot, 'status.json'));
  const engines = status[vu === 'esvu' ? 'selectedEngines' : 'engines'];

  let extension = '';
  if (os.platform() === 'win32') {
    extension = '.cmd';
  }

  for (let engine of engines) {
    if (!VU_HOST_DETAILS[vu] ||
        (VU_HOST_DETAILS[vu] && !VU_HOST_DETAILS[vu][engine])) {
      continue;
    }

    let [
      hostName,
      binaryName,
      hostType,
      hostTags
    ] = VU_HOST_DETAILS[vu][engine];

    if (!hostName) {
      continue;
    }

    const hostPath = path.resolve(
      vuRoot, VU_BIN_PATH[vu], binaryName + extension
    );

    if (!fs.existsSync(hostPath)) {
      console.log(chalk.red(`"${hostName}" could not be configured because ${hostPath} was not found.`));
      continue;
    }
    const version = status[engine] || (status.installed[engine] && status.installed[engine].version);

    if (hostPrefix) {
      hostName = `${hostPrefix}-${hostName}`;
    }

    hostTags.unshift(version);

    console.log(`Configuring ${vu} host with name "${hostName}" (type "${hostType}") at "${hostPath}"`);
    exports.add(config, hostName, hostType, hostPath, undefined, hostTags.filter(Boolean));
  }
};

