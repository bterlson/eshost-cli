'use strict';

const chalk = require('chalk');

module.exports = class Reporter {
  constructor(options = {}) {
    this.options = options;
    this.source = undefined;
    this.results = [];
  }

  start(source) {
    this.source = source;

    if (this.options.showSource) {
      this.printSource(source);
    }
  }

  result({name}, {stdout, error}) {
    let resultCell = stdout.trim();
    if (error) {
      resultCell += this.options.color
        ? `\n${chalk[this.options.color.error](`${error.name}: ${error.message}`)}`
        : `\n${error.name}: ${error.message}`;
    }
    resultCell = resultCell.replace(/\r/g, '');

    this.results.push([
      name, resultCell
    ]);
  }

  end() {}

  get isUnanimous() {
    if (this.results.length === 1) {
      return true;
    }
    // Get the result string of the first result entry
    let first = this.results[0][1];

    // Compare the first result string to all result strings
    for (let [ host, result ] of this.results) {
      if (result !== first) {
        return false;
      }
    }
    return true;
  }

  printSource(source) {
    const header = '## Source';
    console.log(
      this.options.color
        ? chalk[this.options.color.header](header)
        : header
    );
    console.log(`${source}\n`);
  }

  static coalesce(records) {
    const resultsMap = new Map();
    for (const [ name, resultString ] of records) {
      if (!resultsMap.has(resultString)) {
        resultsMap.set(resultString, []);
      }
      resultsMap.get(resultString).push(name);
    }
    return [...resultsMap];
  }
}
