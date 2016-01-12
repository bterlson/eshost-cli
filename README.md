## ESHost

ESHost makes it easy to run and compare ECMAScript code uniformly across a number of runtimes. Support for runtimes is provided by the library [es-host-wrapper](https://github.com/bterlson/es-host-wrapper). Every host is initialized with the [es-host-wrapper runtime API](https://github.com/bterlson/es-host-wrapper#runtime-library) available which provides a uniform way to print, create realms, and eval code. 

### Usage

```
npm install -g eshost
eshost --help
eshost host --help
eshost host --add <name> <type> <path to host executable> --args <optional arguments>
eshost -e "print(Map.length)"

## chakra-es6
0

## d8
0

## chakra
0

## spidermonkey
1

## node
0
```

Console hosts are either provided by the browser vendors or, more likely, built from source.

Host types are those provided by es-host-wrapper, namely:

* ch
* jsshell
* d8
* node
* browser
