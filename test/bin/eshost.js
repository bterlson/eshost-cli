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

  let spawnArgs = [
    './bin/eshost.js',
    // To avoid messing with a real configuration, use a test-local config
    '--config',
    Config.defaultConfigPath,
  ].concat(args);

  return new Promise((resolve, reject) => {
    let cps = cp.spawn(process.execPath, spawnArgs);
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

function resetHostConfig() {
  fs.writeFileSync(Config.defaultConfigPath, '{"hosts":{}}');
}

function toHostPath(hostpath) {
  return path.normalize(hostpath) + (isWindows ? '.exe' : '');
}

beforeEach(() => resetHostConfig());
afterEach(() => resetHostConfig());

describe('eshost --help', () => {
  it('displays help contents', () => {
    return eshost('--help').then(result => {
      assert.equal(result.stderr, '');

      assert(result.stdout.includes('Usage: eshost [options] [input-file]'));
      assert(result.stdout.includes('eshost [options] -e "input-script"'));
      assert(result.stdout.includes('eshost --list'));
      assert(result.stdout.includes('eshost --add [host name] [host type] <host path> --args <host arguments>'));
      assert(result.stdout.includes('eshost --delete [host name]'));
    });
  });
});

describe('eshost --list', () => {
  it('displays "No configured hosts" when no hosts are configured', () => {
    return eshost('--list').then(result => {
      assert.equal(result.stderr, '');
      assert(result.stdout.startsWith(`Using config  ${Config.defaultConfigPath}`));
      assert(result.stdout.includes('No configured hosts'));
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
      assert(result.stdout.startsWith(`Using config  ${Config.defaultConfigPath}`));
      assert(/\bjs\b/m.test(result.stdout));
      assert(/\bjsshell\b/m.test(result.stdout));
      assert(result.stdout.includes(toHostPath('js')));
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
      assert(result.stdout.startsWith(`Using config  ${Config.defaultConfigPath}`));
      assert(/\bjs\b/m.test(result.stdout));
      assert(/\bjsshell\b/m.test(result.stdout));
      assert(result.stdout.includes(toHostPath('js')));
      assert(/\bch\b/m.test(result.stdout));
      assert(result.stdout.includes(toHostPath('ch')));
    });
  });
});

describe('eshost --add', () => {
  it('allows adding a valid host', () => {
    return eshost('--add ch ch /path/to/ch').then(result => {
      assert.equal(result.stderr, '');
      assert(result.stdout.startsWith(`Using config  ${Config.defaultConfigPath}`));
      assert(result.stdout.includes('Host \'ch\' added'));
    });
  });

  it('disallows adding an invalid host', () => {
    return eshost('--add invalid invalid /path/to/invalid').then(result => {
      assert.equal(result.stderr, '');
      assert(result.stdout.startsWith(`Using config  ${Config.defaultConfigPath}`));
      assert(result.stdout.includes('Host type \'invalid\' not supported'));
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
          assert(/-Intl-/m.test(result.stdout));
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
          assert(/\blatest\b/m.test(result.stdout));
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
          assert(result.stdout.includes('latest,greatest'));
      });
      } else {
        return Promise.reject(`'${add}' failed`);
      }
    });
  });
});

describe('eshost --delete', () => {
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
      assert(result.stdout.startsWith(`Using config  ${Config.defaultConfigPath}`));
      assert(result.stdout.includes('Host \'ch\' deleted'));
    });
  });
});

describe('eshost --eval', () => {
  beforeEach(() => {
    fs.writeFileSync(Config.defaultConfigPath, JSON.stringify({
      hosts: {
        node: {
          type: 'node',
          path: toHostPath('node'),
          args: '--harmony'
        },
        ch: {
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

  describe('(default)', () => {
    it('evaluates code and displays the result for all hosts', () => {
      return eshost('--eval " 1 + 1 "').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### ch\n2/m.test(result.stdout));
        assert(/#### node\n2/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host', () => {
      return eshost('--eval " 1 + 1 " --host ch').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### ch\n2/m.test(result.stdout));
        assert(!/#### node\n2/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host group', () => {
      return eshost('--eval " 1 + 1 " --hostGroup ch,node').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### ch\n2/m.test(result.stdout));
        assert(/#### node\n2/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific tag', () => {
      return eshost('--eval " 1 + 1 " --tags latest').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### ch\n2/m.test(result.stdout));
        assert(!/#### node\n2/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for specific tags', () => {
      return eshost('--eval " 1 + 1 " --tags latest,greatest').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### ch\n2/m.test(result.stdout));
        assert(!/#### node\n2/m.test(result.stdout));
      });
    });
  });

  describe('(deduping)', () => {
    it('dedupes hosts, for a specific host list', () => {
      return eshost('--eval " 1 + 1 " --host ch,ch,node,node').then(result => {
        assert.equal(result.stderr, '');
        assert.equal(result.stdout.match(/#### ch\n2/gm).length, 1);
        assert.equal(result.stdout.match(/#### node\n2/gm).length, 1);
      });
    });

    it('dedupes hosts, for a specific host group list', () => {
      return eshost('--eval " 1 + 1 " --hostGroup ch,ch,node,node').then(result => {
        assert.equal(result.stderr, '');
        assert.equal(result.stdout.match(/#### ch\n2/gm).length, 1);
        assert.equal(result.stdout.match(/#### node\n2/gm).length, 1);
      });
    });
  });

  describe('--table', () => {
    it('evaluates code and displays the result for all hosts', () => {
      return eshost('--table --eval " 1 + 1 "').then(result => {
        assert.equal(result.stderr, '');
        assert(/\│.+ch.+2.+\│/.test(result.stdout));
        assert(/\│.+node.+2.+\│/.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host', () => {
      return eshost('--table --eval " 1 + 1 " --host ch').then(result => {
        assert.equal(result.stderr, '');
        assert(/\│.+ch.+2.+\│/.test(result.stdout));
        assert(!/\│.+node.+2.+\│/.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host group', () => {
      return eshost('--table --eval " 1 + 1 " --hostGroup ch,node').then(result => {
        assert.equal(result.stderr, '');
        assert(/\│.+ch.+2.+\│/.test(result.stdout));
        assert(/\│.+node.+2.+\│/.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific tag', () => {
      return eshost('--table --eval " 1 + 1 " --tags latest').then(result => {
        assert.equal(result.stderr, '');
        assert(/\│.+ch.+2.+\│/.test(result.stdout));
        assert(!/\│.+node.+2.+\│/.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for specific tags', () => {
      return eshost('--table --eval " 1 + 1 " --tags latest,greatest').then(result => {
        assert.equal(result.stderr, '');
        assert(/ch/.test(result.stdout));
        assert(!/\│.+node.+2.+\│/.test(result.stdout));
      });
    });
  });
});

describe('eshost --unanimous --eval', () => {
  beforeEach(() => {
    fs.writeFileSync(Config.defaultConfigPath, JSON.stringify({
      hosts: {
        node: {
          type: 'node',
          path: toHostPath('node'),
        },
        ch: {
          type: 'ch',
          path: toHostPath('ch'),
        },
        js: {
          type: 'jsshell',
          path: toHostPath('js'),
        }
      }
    }));
  });

  describe('(default)', () => {
    it('displays nothing when all results are unanimous', () => {
      return eshost('--unanimous --eval " 1 + 1 "').then(result => {
        assert.equal(result.stderr, '');
        assert.equal(result.stdout.trim().length, 0);
      });
    });

    it('displays results when results are varied', () => {
      return eshost('--unanimous --eval "typeof gc"').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### js\nfunction/.test(result.stdout));
        assert(/#### ch\nundefined/.test(result.stdout));
        assert(/#### node\nundefined/.test(result.stdout));
      });
    });
  });

  describe('--table', () => {
    it('displays nothing when all results are unanimous', () => {
      return eshost('--unanimous --table --eval " 1 + 1 "').then(result => {
        assert.equal(result.stderr, '');
        assert.equal(result.stdout.trim().length, 0);
      });
    });

    it('displays results when results are varied', () => {
      return eshost('--unanimous --table --eval "typeof gc"').then(result => {
        assert.equal(result.stderr, '');
        assert(/\│.+ch.+undefined.+\│/.test(result.stdout));
        assert(/\│.+js.+function.+\│/.test(result.stdout));
      });
    });
  });
});

