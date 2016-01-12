## ESHost

ESHost makes it easy to run and compare ECMAScript code uniformly across a number of runtimes. Support for runtimes is provided by the library [es-host-wrapper](https://github.com/bterlson/es-host-wrapper).

### Usage

```
npm install -g eshost
eshost host add <name> <type> <path to host executable> --args <optional arguments>
eshost -e "print(1)"
```

Host types are those provided by es-host-wrapper, namely:

* ch
* jsshell
* d8
* node
* browser
