# eshost-cli

[![Travis Build Status](https://travis-ci.org/bterlson/eshost-cli.svg?branch=master)](https://travis-ci.org/bterlson/eshost-cli)
[![Appveyor Build Status](https://ci.appveyor.com/api/projects/status/github/bterlson/eshost-cli?branch=master&svg=true)](https://ci.appveyor.com/project/bterlson/eshost-cli)


eshost-cli makes it easy to run and compare ECMAScript code uniformly across a number of runtimes. Support for runtimes is provided by the library [eshost](https://github.com/bterlson/eshost). Every host is initialized with the [eshost runtime API](https://github.com/bterlson/eshost#runtime-library) available which provides a uniform way to print, create realms, and eval code. 

See eshost's [supported hosts](https://github.com/bterlson/eshost#supported-hosts) for a list of hosts, download/build locations, and other information.

## Usage

See `--help` output for the full details. Basic usage:

* Add hosts using `eshost --add <host name> <host type> <host path> --args <optional arguments>`.
* Automatically configure [`esvu`](https://github.com/devsnek/esvu)-installed hosts using `eshost --configure-esvu`.
* Automatically configure [`jsvu`](https://github.com/GoogleChromeLabs/jsvu)-installed hosts using `eshost --configure-jsvu`.
* Evaluate a *single* expression using `-e`: `eshost -e "[1,2,3].length"`.
* Execute a multi-statement program using `-x`: `eshost -x "foo = 42; print(foo);"`
* Execute a script using `eshost path/to/script.js`.
* Execute an expression or multi-statement program as module code using `-m`: 
  - `eshost -me "foo = 42"` (this example should result in errors!)
  - `eshost -mx "foo = 42; print(foo);"` (this example should result in errors!)
* Execute a source file as module code by saving the file with an `.mjs` extension: `eshost file.mjs`; or by using the `-m` option: `eshost -m file.js`

### Install and Configure Hosts

#### Linux and macOS

Manually, using `esvu`:

```sh
npm install esvu -g;
export PATH="${HOME}/.esvu/bin:${PATH}";

esvu --engines=all;

export ESHOST_PATH_CHAKRA=`which chakra`;
export ESHOST_PATH_ENGINE262=`which engine262`;
export ESHOST_PATH_HERMES=`which hermes`;
export ESHOST_PATH_JAVASCRIPTCORE=`which javascriptcore`;
export ESHOST_PATH_QUICKJS=`which qjs-for-eshost`;
export ESHOST_PATH_SPIDERMONKEY=`which spidermonkey`;
export ESHOST_PATH_V8=`which v8`;
export ESHOST_PATH_XS=`which xs`;

npm install -g eshost-cli;

eshost --add "chakra" ch $ESHOST_PATH_CHAKRA;
eshost --add "engine262" engine262 $ESHOST_PATH_ENGINE262;
eshost --add "hermes" hermes $ESHOST_PATH_HERMES;
eshost --add "javascriptcore" jsc $ESHOST_PATH_JAVASCRIPTCORE;
eshost --add "quickjs" qjs $ESHOST_PATH_QUICKJS;
eshost --add "spidermonkey" jsshell $ESHOST_PATH_SPIDERMONKEY;
eshost --add "v8" d8 $ESHOST_PATH_V8;
eshost --add "xs" xs $ESHOST_PATH_XS;
```

Manually, using `jsvu`: 

```sh
# Engine262
git clone https://github.com/devsnek/engine262.git;
cd engine262 && npm install && npm run build && npm link;
cd ~/

# Everything else...
npm install -g jsvu;
export PATH="${HOME}/.jsvu:${PATH}";

jsvu --engines=chakra,hermes,javascriptcore,spidermonkey,v8,xs

export ESHOST_PATH_CHAKRA=`which chakra`;
export ESHOST_PATH_ENGINE262=`which engine262`;
export ESHOST_PATH_HERMES=`which hermes`;
export ESHOST_PATH_JAVASCRIPTCORE=`which javascriptcore`;
export ESHOST_PATH_QUICKJS=`which qjs-for-eshost`;
export ESHOST_PATH_SPIDERMONKEY=`which spidermonkey`;
export ESHOST_PATH_V8=`which v8`;
export ESHOST_PATH_XS=`which xs`;

npm install -g eshost-cli;

eshost --add "chakra" ch $ESHOST_PATH_CHAKRA;
eshost --add "engine262" engine262 $ESHOST_PATH_ENGINE262;
eshost --add "hermes" hermes $ESHOST_PATH_HERMES;
eshost --add "javascriptcore" jsc $ESHOST_PATH_JAVASCRIPTCORE;
eshost --add "quickjs" qjs $ESHOST_PATH_QUICKJS;
eshost --add "spidermonkey" jsshell $ESHOST_PATH_SPIDERMONKEY;
eshost --add "v8" d8 $ESHOST_PATH_V8;
eshost --add "xs" xs $ESHOST_PATH_XS;
```

##### This will install QuickJS on macOS

```sh
if [ "$(uname)" = Darwin ]; then wget https://bellard.org/quickjs/quickjs-2021-03-27.tar.xz; tar -xf quickjs-2021-03-27.tar.xz;
cd quickjs-2021-03-27 && make; if [ -f "$PWD/run-test262" ]; then ln -s $PWD/run-test262 /usr/local/bin/qjs-for-eshost; fi; fi;
```



#### Windows



Manually, using `jsvu`: 

```batch
git clone https://github.com/devsnek/engine262.git
cd .\engine262
npm install
npm run build
npm link
set NPM_GLOBAL_MODULE_PATH=%APPDATA%\npm\
set PATH=%PATH;%NPM_GLOBAL_MODULE_PATH%
where engine262

npm install jsvu

jsvu --os=win64 --engines="chakra,spidermonkey,v8,xs"

set PATH=%PATH;%USERPROFILE%\.jsvu\
set ESHOST_CHAKRA=%USERPROFILE%\.jsvu\chakra.cmd
set ESHOST_ENGINE262=%NPM_GLOBAL_MODULE_PATH%\engine262.cmd
set ESHOST_SPIDERMONKEY=%USERPROFILE%\.jsvu\spidermonkey.cmd
set ESHOST_V8=%USERPROFILE%\.jsvu\v8.cmd
set ESHOST_XS=%USERPROFILE%\.jsvu\xs.cmd

npm install -g eshost-cli;

eshost --add "chakra" ch %ESHOST_CHAKRA%
eshost --add "engine262" engine262 %ESHOST_ENGINE262%
eshost --add "spidermonkey" jsshell %ESHOST_SPIDERMONKEY%
eshost --add "v8" d8 %ESHOST_V8%
eshost --add "xs" xs %ESHOST_XS%
```

### Examples

```console
$ npm install -g eshost-cli
$ eshost --help
$ eshost --add <name> <type> <path to host executable> --args <optional arguments>
$ eshost -e "Map.length"
#### chakra
0

#### engine262
0

#### javascriptcore
0

#### spidermonkey
0

#### v8
0

#### xs
0
```


```console
$ eshost --configure-esvu --esvu-prefix esvu
$ eshost --tags esvu-web -itsx "let a = 40+2; print(a)"

## Source
let a = 40+2; print(a)

┌──────────┬────┐
│ esvu-ch  │ 42 │
│ esvu-jsc │    │
│ esvu-sm  │    │
│ esvu-v8  │    │
└──────────┴────┘
```

```console
$ eshost --configure-jsvu --jsvu-prefix jsvu
$ eshost --tags jsvu-web -itsx "let a = 40+2; print(a)"

## Source
let a = 40+2; print(a)

┌──────────┬────┐
│ jsvu-ch  │ 42 │
│ jsvu-jsc │    │
│ jsvu-sm  │    │
│ jsvu-v8  │    │
└──────────┴────┘
```

### Rules For Module Code

Files containing the imported modules must be located in the same directory that the "entry point" file is located. Please read and accept the following examples.

1. Executing a program with module dependencies, where the entry point is a ".mjs" file: 

    ```sh
    mkdir entry-point-mjs;
    cd entry-point-mjs;
    echo "export var a = 1;" >> export.mjs
    echo "import {a} from './export.mjs'; print(a);" >> import.mjs

    eshost --host="engine262,javascriptcore,spidermonkey,v8,xs" import.mjs
    #### engine262
    1

    #### javascriptcore
    1

    #### spidermonkey
    1

    #### v8
    1

    #### xs
    1
    ```

2. Executing a program with module dependencies, where the entry point is a ".js" file (Notice the use of the `-m` flag, **this is required for ".js" files**): 

    ```sh
    mkdir entry-point-js;
    cd entry-point-js;
    echo "export var a = 1;" >> export.mjs
    echo "import {a} from './export.mjs'; print(a);" >> import.js

    eshost --host="engine262,javascriptcore,spidermonkey,v8,xs" -m import.js
    #### engine262
    1

    #### javascriptcore
    1

    #### spidermonkey
    1

    #### v8
    1

    #### xs
    1
    ```

**Executing a multi-line program with module dependencies is not yet supported. Support is in progress.**


## Managing Hosts

You can `--list`, `--add`, `--edit`, and `--delete` hosts. Adding a host requires a name, type, and path to the runtime executable. You can optionally pass arguments using `--args`. The same host can be added multiple times with different `--args` which makes it easy to compare the output of runtimes given different options (e.g. by turning language features on and off).

Console hosts are either provided by the browser vendors or, more likely, built from source. [The `jsvu` CLI](https://github.com/GoogleChromeLabs/jsvu) makes it easy to install and update the most common JavaScript engine binaries.

Host types are [those provided by eshost](https://github.com/bterlson/eshost#eshostcreateagenttype-string-options---agent), namely:

### Shells

| Host Type | All Acceptable `type` Values |
| ---- | -------------------- |
| ChakraCore | `chakra`, `ch` |
| Engine262 | `engine262` |
| JavaScriptCore | `javascriptcore`, `jsc` |
| Nashorn | `nashorn` |
| Node | `node` |
| QuickJS | `qjs` <sup>1</sup> |
| SpiderMonkey | `jsshell`, `spidermonkey`, `sm` |
| V8 | `d8`, `v8` |
| XS | `xs` |

* 1: **DO NOT USE `~/.jsvu/quickjs` WITH ESHOST-CLI**. The main `quickjs` binary does not support the [eshost runtime API](https://github.com/bterlson/eshost#runtime-library). For more, see [Install and Configure Hosts](#install-and-configure-hosts).

### Browsers

| Host Type | All Acceptable `type` Values |
| ---- | -------------------- |
| chrome | `chrome` |
| edge | `edge` |
| firefox | `firefox` |
| safari | `safari` |
