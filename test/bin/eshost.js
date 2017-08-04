'use strict';

const assert = require('assert');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const tokenize = require('yargs/lib/tokenize-arg-string');

const Config = require('../../lib/config');

const isWindows = process.platform === 'win32' ||
  process.env.OSTYPE === 'cygwin' ||
  process.env.OSTYPE === 'msys';

const hosts = [
  ['jsshell', { hostPath: 'js' }],
  ['ch', { hostPath: 'ch' }],
  ['node', { hostPath: 'node' }],
  ['d8', { hostPath: 'd8' }],
  ['jsc', { hostPath: 'jsc' }],
];

if (isWindows) {
  hosts.forEach(record => {
    record[1].hostPath += '.exe';
  });
}


function eshost(command = []) {
  let args = [];

  if (Array.isArray(command)) {
    args.push(...command);
  } else {
    if (typeof command === 'string') {
      args.push(...tokenize(command));
    }
  }

  return new Promise((resolve, reject) => {
    let cps = cp.spawn('./bin/eshost.js', args);
    let stdout = '';
    let stderr = '';

    cps.stdout.on('data', buffer => { stdout += buffer; });
    cps.stderr.on('data', buffer => { stderr += buffer; });
    cps.on('close', () => {
      cps = null;
      resolve({ stderr, stdout });
    });

    cps.on('error', error => {
      reject(error);
    });
  });
}

let originalHostConfig;
let nohosts = '{"hosts":{}}';
try {
  if (fs.existsSync(Config.defaultConfigPath)) {
    originalHostConfig = fs.readFileSync(Config.defaultConfigPath, 'utf-8');
  } else {
    originalHostConfig = nohosts;
  }
} catch (error) {
  originalHostConfig = nohosts;
}

function restoreOriginalHostConfig() {
  fs.writeFileSync(Config.defaultConfigPath, originalHostConfig);
}

function emptyHostConfig() {
  fs.writeFileSync(Config.defaultConfigPath, '{"hosts":{}}');
}

function toLines(result) {
  return (result || '').split('\n').map(value => value.trim()).filter(Boolean);
}

function toHostPath(hostpath) {
  return path.normalize(hostpath) + (isWindows ? '.exe' : '');
}

before(function() {
  restoreOriginalHostConfig();
});

describe('eshost --help', () => {
  it('displays help contents', () => {
    return eshost('--help').then(result => {
      assert.equal(result.stderr, '');

      assert.ok(result.stdout.includes('Usage: eshost [options] [input-file]'));
      assert.ok(result.stdout.includes('eshost [options] -e "input-script"'));
      assert.ok(result.stdout.includes('eshost --list'));
      assert.ok(result.stdout.includes('eshost --add [host name] [host type] <host path> --args <host arguments>'));
      assert.ok(result.stdout.includes('eshost --delete [host name]'));
    });
  });
});

describe('eshost --list', () => {

  beforeEach(function() {
    emptyHostConfig();
  });

  after(function() {
    restoreOriginalHostConfig();
  });

  it('displays "No configured hosts" when no hosts are configured', () => {
    return eshost('--list').then(result => {
      assert.equal(result.stderr, '');
      assert.ok(result.stdout.startsWith(`Using config  ${Config.defaultConfigPath}`));
      assert.ok(result.stdout.includes('No configured hosts'));
    });
  });

  it('displays host table when there is one host configured', () => {
    fs.writeFileSync(Config.defaultConfigPath, JSON.stringify({
      hosts: {
        js: {
          type: 'jsshell',
          path: toHostPath('js')
        }
      }
    }));

    return eshost('--list').then(result => {
      assert.equal(result.stderr, '');
      /*
      │ js   │ jsshell │ /path/to/js │      │      │
      */
      assert.ok(result.stdout.startsWith(`Using config  ${Config.defaultConfigPath}`));
      assert.ok(/\bjs\b/m.test(result.stdout));
      assert.ok(/\bjsshell\b/m.test(result.stdout));
      assert.ok(result.stdout.includes(toHostPath('js')));
    });
  });

  it('displays host table when there is more than one host configured', () => {
    fs.writeFileSync(Config.defaultConfigPath, JSON.stringify({
      hosts: {
        js: {
          type: 'jsshell',
          path: toHostPath('js')
        },
        ch: {
          type: 'ch',
          path: toHostPath('ch')
        }
      }
    }));

    return eshost('--list').then(result => {
      assert.equal(result.stderr, '');
      /*
      │ js   │ jsshell │ /path/to/js │      │      │
      ├──────┼─────────┼─────────────┼──────┼──────┤
      │ ch   │ ch      │ /path/to/ch │      │      │
      */
      assert.ok(result.stdout.startsWith(`Using config  ${Config.defaultConfigPath}`));
      assert.ok(/\bjs\b/m.test(result.stdout));
      assert.ok(/\bjsshell\b/m.test(result.stdout));
      assert.ok(result.stdout.includes(toHostPath('js')));
      assert.ok(/\bch\b/m.test(result.stdout));
      assert.ok(result.stdout.includes(toHostPath('ch')));
    });
  });
});

describe('eshost --add', () => {

  beforeEach(function() {
    emptyHostConfig();
  });

  after(function() {
    restoreOriginalHostConfig();
  });

  it('allows adding a valid host', () => {
    emptyHostConfig()
    return eshost('--add ch ch /path/to/ch').then(result => {
      assert.equal(result.stderr, '');
      assert.ok(result.stdout.startsWith(`Using config  ${Config.defaultConfigPath}`));
      assert.ok(result.stdout.includes('Host \'ch\' added'));
    });
  });

  it('disallows adding an invalid host', () => {
    return eshost('--add invalid invalid /path/to/invalid').then(result => {
      assert.equal(result.stderr, '');
      assert.ok(result.stdout.startsWith(`Using config  ${Config.defaultConfigPath}`));
      assert.ok(result.stdout.includes('Host type \'invalid\' not supported'));
    });
  });

  it('allows adding a valid host with --args', () => {
    let add = '--add ch ch /path/to/ch --args "-Intl-"';
    return eshost(add).then(result => {
      assert.equal(result.stderr, '');

      if (result.stdout.includes('Host \'ch\' added')) {
        return eshost('--list').then(result => {
          assert.equal(result.stderr, '');
          /*
          │ ch   │ ch   │ /path/to/ch │ -Intl- │      │
           */
          assert.ok(/-Intl-/m.test(result.stdout));
        });
      } else {
        return Promise.reject(`'${add}' failed`);
      }
    });
  });

  it('allows adding a valid host with --tags (1)', () => {
    let add = '--add ch ch /path/to/ch --tags latest';
    return eshost(add).then(result => {
      assert.equal(result.stderr, '');

      if (result.stdout.includes('Host \'ch\' added')) {
        return eshost('--list').then(result => {
          assert.equal(result.stderr, '');
          /*
          │ ch   │ ch   │ /usr/local/bin/ch │      │ latest │
           */
          assert.ok(/\blatest\b/m.test(result.stdout));
        });
      } else {
        return Promise.reject(`'${add}' failed`);
      }
    });
  });

  it('allows adding a valid host with --tags (>1)', () => {
    let add = '--add ch ch /path/to/ch --tags latest,greatest';
    return eshost(add).then(result => {
      assert.equal(result.stderr, '');

      if (result.stdout.includes('Host \'ch\' added')) {
        return eshost('--list').then(result => {
          assert.equal(result.stderr, '');
          /*
          │ ch   │ ch   │ /usr/local/bin/ch │      │ latest,greatest │
           */
          assert.ok(result.stdout.includes('latest,greatest'));
      });
      } else {
        return Promise.reject(`'${add}' failed`);
      }
    });
  });
});

describe('eshost --delete', () => {
  after(function() {
    restoreOriginalHostConfig();
  });

  it('allows deleting a host', () => {
    fs.writeFileSync(Config.defaultConfigPath, JSON.stringify({
      hosts: {
        js: {
          type: 'jsshell',
          path: toHostPath('js')
        },
        ch: {
          type: 'ch',
          path: toHostPath('ch')
        }
      }
    }));

    return eshost('--delete ch').then(result => {
      assert.equal(result.stderr, '');
      assert.ok(result.stdout.startsWith(`Using config  ${Config.defaultConfigPath}`));
      assert.ok(result.stdout.includes('Host \'ch\' deleted'));
    });
  });
});

describe('eshost --eval', () => {

  before(function() {
    fs.writeFileSync(Config.defaultConfigPath, JSON.stringify({
      hosts: {
        'node': {
          type: 'node',
          path: toHostPath('node'),
          args: '--harmony'
        },
        'ch': {
          type: 'ch',
          path: toHostPath('ch'),
          tags: [
            'latest',
            'greatest'
          ]
        }
      }
    }));
  });

  after(function() {
    restoreOriginalHostConfig();
  });

  it('evaluates code and displays the result for all hosts', () => {
    return eshost('--eval " 1 + 1 "').then(result => {
      assert.equal(result.stderr, '');
      assert.deepEqual(toLines(result.stdout), [
        '#### node',
        '2',
        '#### ch',
        '2',
      ]);
    });
  });

  it('evaluates code and displays the result for a specific host', () => {
    return eshost('--eval " 1 + 1 " --host ch').then(result => {
      assert.equal(result.stderr, '');
      assert.deepEqual(toLines(result.stdout), [
        '#### ch',
        '2',
      ]);
    });
  });

  it('evaluates code and displays the result for a specific host group', () => {
    return eshost('--eval " 1 + 1 " --hostGroup ch,node').then(result => {
      assert.equal(result.stderr, '');
      assert.deepEqual(toLines(result.stdout), [
        '#### node',
        '2',
        '#### ch',
        '2',
      ]);
    });
  });

  it('evaluates code and displays the result for a specific tag', () => {
    return eshost('--eval " 1 + 1 " --tags latest').then(result => {
      assert.equal(result.stderr, '');
      assert.deepEqual(toLines(result.stdout), [
        '#### ch',
        '2',
      ]);
    });
  });

  it('evaluates code and displays the result for specific tags', () => {
    return eshost('--eval " 1 + 1 " --tags latest,greatest').then(result => {
      assert.equal(result.stderr, '');
      assert.deepEqual(toLines(result.stdout), [
        '#### ch',
        '2',
      ]);
    });
  });
});
