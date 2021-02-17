'use strict';

const assert = require('assert');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const tokenize = require('yargs/lib/tokenize-arg-string');

const Config = require('../../lib/config');

// To avoid messing with a real configuration, use a test-local config
Config.defaultConfigPath = path.join(__dirname, '../config/.eshost-config.json');

console.log("Engines installed");
console.log("--------------------------------------------------------");
console.log(process.env.ESHOST_ESVU_PATH);
console.log(process.env.ESHOST_CHAKRA_PATH);
console.log(process.env.ESHOST_ENGINE262_PATH);
console.log(process.env.ESHOST_JSC_PATH);
console.log(process.env.ESHOST_JS_PATH);
console.log(process.env.ESHOST_NODE_PATH);
console.log(process.env.ESHOST_V8_PATH);
console.log(process.env.ESHOST_XS_PATH);
console.log("--------------------------------------------------------");

const hosts = [
  ['chakra', { hostPath: process.env.ESHOST_CHAKRA_PATH }],
  ['engine262', { hostPath: process.env.ESHOST_ENGINE262_PATH }],
  ['jsc', { hostPath: process.env.ESHOST_JSC_PATH }],
  ['sm', { hostPath: process.env.ESHOST_JS_PATH }],
  ['node', { hostPath: process.env.ESHOST_NODE_PATH }],
  ['v8', { hostPath: process.env.ESHOST_V8_PATH }],
  ['xs', { hostPath: process.env.ESHOST_XS_PATH }],
];

const hostsByType = hosts.reduce((accum, [type, config]) => {
  accum[type] = config;
  return accum;
}, {});

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

function toHostPath(type) {
  return path.normalize(hostsByType[type].hostPath);
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
      assert(result.stdout.startsWith(`Using config "${Config.defaultConfigPath}"`));
      assert(result.stdout.includes('No configured hosts'));
    });
  });

  it('displays host table when there is one host configured', () => {
    fs.writeFileSync(Config.defaultConfigPath, JSON.stringify({
      hosts: {
        js: {
          type: 'sm',
          path: toHostPath('sm')
        }
      }
    }));

    return eshost('--list').then(result => {
      assert.equal(result.stderr, '');
      /*
      │ js   │ sm │ /path/to/js │      │      │
      */
      assert(result.stdout.startsWith(`Using config "${Config.defaultConfigPath}"`));
      assert(/\bjs\b/m.test(result.stdout));
      assert(/\bsm\b/m.test(result.stdout));
      assert(result.stdout.includes(toHostPath('sm')));
    });
  });

  it('displays host table when there is more than one host configured', () => {
    fs.writeFileSync(Config.defaultConfigPath, JSON.stringify({
      hosts: {
        js: {
          type: 'sm',
          path: toHostPath('sm')
        },
        node: {
          type: 'node',
          path: toHostPath('node')
        }
      }
    }));

    return eshost('--list').then(result => {
      assert.equal(result.stderr, '');
      /*
      │ js   │ sm │ /path/to/js   │      │      │
      ├──────┼─────────┼───────────────┼──────┼──────┤
      │ node │ node    │ /path/to/node │      │      │
      */
      assert(result.stdout.startsWith(`Using config "${Config.defaultConfigPath}"`));
      assert(/\bjs\b/m.test(result.stdout));
      assert(/\bsm\b/m.test(result.stdout));
      assert(result.stdout.includes(toHostPath('sm')));
      assert(/\bnode\b/m.test(result.stdout));
      assert(result.stdout.includes(toHostPath('node')));
    });
  });
});

describe('eshost --add', () => {
  it('allows adding a valid host', () => {
    return eshost('--add node node /path/to/node').then(result => {
      assert.equal(result.stderr, '');
      assert(result.stdout.startsWith(`Using config "${Config.defaultConfigPath}"`));
      assert(result.stdout.includes('Host "node" added'));
    });
  });

  it('disallows adding an invalid host', () => {
    return eshost('--add invalid invalid /path/to/invalid').then(result => {
      assert.equal(result.stderr, '');
      assert(result.stdout.startsWith(`Using config "${Config.defaultConfigPath}"`));
      assert(result.stdout.includes('Host type "invalid" not supported'));
    });
  });

  it('allows adding a valid host with --args', () => {
    let add = '--add ch ch /path/to/ch --args "-Intl-"';
    return eshost(add).then(result => {
      assert.equal(result.stderr, '');

      if (result.stdout.includes('Host "ch" added')) {
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

      if (result.stdout.includes('Host "ch" added')) {
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

      if (result.stdout.includes('Host "ch" added')) {
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
          type: 'sm',
          path: toHostPath('sm')
        },
        node: {
          type: 'node',
          path: toHostPath('node')
        }
      }
    }));

    return eshost('--delete node').then(result => {
      assert.equal(result.stderr, '');
      assert(result.stdout.startsWith(`Using config "${Config.defaultConfigPath}"`));
      assert(result.stdout.includes('Host "node" deleted'));
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
        v8: {
          type: 'v8',
          path: toHostPath('v8'),
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
        assert(/#### v8\n2/m.test(result.stdout));
        assert(/#### node\n2/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host', () => {
      return eshost('--eval " 1 + 1 " --host v8').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### v8\n2/m.test(result.stdout));
        assert(!/#### node\n2/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host group', () => {
      return eshost('--eval " 1 + 1 " --hostGroup v8,node').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### v8\n2/m.test(result.stdout));
        assert(/#### node\n2/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific tag', () => {
      return eshost('--eval " 1 + 1 " --tags latest').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### v8\n2/m.test(result.stdout));
        assert(!/#### node\n2/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for specific tags', () => {
      return eshost('--eval " 1 + 1 " --tags latest,greatest').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### v8\n2/m.test(result.stdout));
        assert(!/#### node\n2/m.test(result.stdout));
      });
    });
  });

  describe('(deduping)', () => {
    it('dedupes hosts, for a specific host list', () => {
      return eshost('--eval " 1 + 1 " --host v8,v8,node,node').then(result => {
        assert.equal(result.stderr, '');
        assert.equal(result.stdout.match(/#### v8\n2/gm).length, 1);
        assert.equal(result.stdout.match(/#### node\n2/gm).length, 1);
      });
    });

    it('dedupes hosts, for a specific host group list', () => {
      return eshost('--eval " 1 + 1 " --hostGroup v8,v8,node,node').then(result => {
        assert.equal(result.stderr, '');
        assert.equal(result.stdout.match(/#### v8\n2/gm).length, 1);
        assert.equal(result.stdout.match(/#### node\n2/gm).length, 1);
      });
    });
  });

  describe('--table', () => {
    it('evaluates code and displays the result for all hosts', () => {
      return eshost('--table --eval " 1 + 1 "').then(result => {
        assert.equal(result.stderr, '');
        assert(/\│.+v8.+2.+\│/.test(result.stdout));
        assert(/\│.+node.+2.+\│/.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host', () => {
      return eshost('--table --eval " 1 + 1 " --host v8').then(result => {
        assert.equal(result.stderr, '');
        assert(/\│.+v8.+2.+\│/.test(result.stdout));
        assert(!/\│.+node.+2.+\│/.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host group', () => {
      return eshost('--table --eval " 1 + 1 " --hostGroup v8,node').then(result => {
        assert.equal(result.stderr, '');
        assert(/\│.+v8.+2.+\│/.test(result.stdout));
        assert(/\│.+node.+2.+\│/.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific tag', () => {
      return eshost('--table --eval " 1 + 1 " --tags latest').then(result => {
        assert.equal(result.stderr, '');
        assert(/\│.+v8.+2.+\│/.test(result.stdout));
        assert(!/\│.+node.+2.+\│/.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for specific tags', () => {
      return eshost('--table --eval " 1 + 1 " --tags latest,greatest').then(result => {
        assert.equal(result.stderr, '');
        assert(/v8/.test(result.stdout));
        assert(!/\│.+node.+2.+\│/.test(result.stdout));
      });
    });
  });
});

describe('eshost --unanimous --eval', () => {
  beforeEach(() => {
    fs.writeFileSync(Config.defaultConfigPath, JSON.stringify({
      hosts: {
        ch: {
          type: 'chakra',
          path: toHostPath('chakra'),
        },
        js: {
          type: 'sm',
          path: toHostPath('sm'),
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
      // Using "gc" because that's guaranteed to be present in sm by default
      // and guaranteed to be absent from chakra by default.
      return eshost('--unanimous --eval "typeof gc"').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### js\nfunction/.test(result.stdout));
        assert(/#### ch\nundefined/.test(result.stdout));
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
      // Using "gc" because that's guaranteed to be present in sm by default
      // and guaranteed to be absent from chakra by default.
      return eshost('--unanimous --table --eval "typeof gc"').then(result => {
        assert.equal(result.stderr, '');
        assert(/ch.+undefined/.test(result.stdout));
        assert(/js.+function/.test(result.stdout));
      });
    });
  });
});

describe('eshost [input-file]', () => {
  beforeEach(() => {
    fs.writeFileSync(Config.defaultConfigPath, JSON.stringify({
      hosts: {
        node: {
          type: 'node',
          path: toHostPath('node'),
        },
        engine262: {
          type: 'engine262',
          path: toHostPath('engine262'),
          tags: [
            'latest',
            'greatest'
          ]
        }
      }
    }));
  });

  describe('script.js', () => {
    it('evaluates code and displays the result for all hosts', () => {
      return eshost('test/bin/fixtures/script.js').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### node/m.test(result.stdout));
        assert(/#### engine262/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host', () => {
      return eshost('--host engine262 test/bin/fixtures/script.js').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
        assert(!/#### node\ntrue\n\n/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host group', () => {
      return eshost('--hostGroup engine262 test/bin/fixtures/script.js').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
        assert(!/#### node\ntrue\n\n/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific tag', () => {
      return eshost('--tags latest test/bin/fixtures/script.js').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
        assert(!/#### node\ntrue\n\n/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for specific tags', () => {
      return eshost('--tags latest,greatest test/bin/fixtures/script.js').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
        assert(!/#### node\ntrue\n\n/m.test(result.stdout));
      });
    });
  });

  describe('absolute path to script.js', () => {
    it('evaluates code and displays the result for all hosts', () => {
      return eshost(`${__dirname}/fixtures/script.js`).then(result => {
        assert.equal(result.stderr, '');
        assert(/#### node/m.test(result.stdout));
        assert(/#### engine262/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host', () => {
      return eshost(`--host engine262 ${__dirname}/fixtures/script.js`).then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
        assert(!/#### node\ntrue\n\n/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host group', () => {
      return eshost(`--hostGroup engine262 ${__dirname}/fixtures/script.js`).then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
        assert(!/#### node\ntrue\n\n/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific tag', () => {
      return eshost(`--tags latest ${__dirname}/fixtures/script.js`).then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
        assert(!/#### node\ntrue\n\n/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for specific tags', () => {
      return eshost(`--tags latest,greatest ${__dirname}/fixtures/script.js`).then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
        assert(!/#### node\ntrue\n\n/m.test(result.stdout));
      });
    });
  });

  describe('module.mjs', () => {
    it('evaluates code and displays the result for all hosts', () => {
      return eshost('test/bin/fixtures/module.mjs').then(result => {
        assert(/#### node/m.test(result.stdout));
        assert(/#### engine262/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host', () => {
      return eshost('--host engine262 test/bin/fixtures/module.mjs').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host group', () => {
      return eshost('--hostGroup engine262 test/bin/fixtures/module.mjs').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific tag', () => {
      return eshost('--tags latest test/bin/fixtures/module.mjs').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for specific tags', () => {
      return eshost('--tags latest,greatest test/bin/fixtures/module.mjs').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
      });
    });
  });

  describe('module.js', () => {
    it('evaluates code and displays the result for all hosts', () => {
      return eshost('-m test/bin/fixtures/module.js').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### node/m.test(result.stdout));
        assert(/#### engine262/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host', () => {
      return eshost('-m --host engine262 test/bin/fixtures/module.js').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host group', () => {
      return eshost('-m --hostGroup engine262 test/bin/fixtures/module.js').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific tag', () => {
      return eshost('-m --tags latest test/bin/fixtures/module.js').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for specific tags', () => {
      return eshost('-m --tags latest,greatest test/bin/fixtures/module.js').then(result => {
        assert.equal(result.stderr, '');
        assert(/#### engine262\ntrue/m.test(result.stdout));
      });
    });
  });

  describe('--table', () => {
    it('evaluates code and displays the result for all hosts', () => {
      return eshost('--table test/bin/fixtures/module.mjs').then(result => {
        assert.equal(result.stderr, '');
        assert(/\│.+engine262.+\│/.test(result.stdout));
        assert(/\│.+node.+\│/.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific host group', () => {
      return eshost('--table test/bin/fixtures/module.mjs --hostGroup engine262,node').then(result => {
        assert.equal(result.stderr, '');
        assert(/\│.+engine262.+\│/.test(result.stdout));
        assert(/\│.+node.+\│/.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for a specific tag', () => {
      return eshost('--table test/bin/fixtures/module.mjs --tags latest').then(result => {
        assert.equal(result.stderr, '');
        assert(/\│.+engine262.+\│/.test(result.stdout));
        assert(!/\│.+node.+\│/.test(result.stdout));
      });
    });

    it('evaluates code and displays the result for specific tags', () => {
      return eshost('--table test/bin/fixtures/module.mjs --tags latest,greatest').then(result => {
        assert.equal(result.stderr, '');
        assert(/engine262/.test(result.stdout));
        assert(!/\│.+node.+\│/.test(result.stdout));
      });
    });
  });
});
