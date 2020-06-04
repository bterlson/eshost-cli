'use strict';

const chalk = require('chalk');

module.exports = class Reporter {
  constructor(options = {}) {
    this.options = options;
    this.source = undefined;
    this._results = [];
  }

  start(source) {
    this.source = source;

    if (this.options.showSource) {
      Reporter.printSource(source);
    }
  }

  result({name}, {stdout, error}) {
    let resultCell = stdout.trim();
    if (error) {
      resultCell += `\n${chalk.red(`${error.name}: ${error.message}`)}`;
    }
    resultCell = resultCell.replace(/\r/g, '');

    this._results.push([
      name, resultCell
    ]);
  }

  get joinHostDelimiter() { return ''; }

  get results() {
    this._results.sort((a,b) => a[0].localeCompare(b[0]));

    const results = [];
    if (this.options.coalesce) {
      for (const [ resultString, hosts ] of Reporter.coalesce(this._results)) {
        const joinedHosts = hosts.join(this.joinHostDelimiter).trim();
        results.push([joinedHosts, resultString]);
      }
    } else {
      results.push(...this._results);
    }

    return results;
  }

  printResults(results) { }

  end() {
    if (this.options.unanimous && this.isUnanimous) {
      process.exit(0);
      // don't print anything
    } else {
      this.printResults(this.prettyResults(this.results));

      if (this.options.unanimous) {
        process.exit(1);
      }
    }
  }

  prettyResults(results) {
    if (this.options.markdown) {
      return results.map(([host, resultString]) =>
        [host, `<pre>${resultString}</pre>`.replace(/\n/g, '<br>')]);
    }
    return results;
  }

  get isUnanimous() {
    if (this._results.length === 1) {
      return true;
    }
    // Get the result string of the first result entry
    let first = this._results[0][1];

    // Compare the first result string to all result strings
    for (let [ host, result ] of this._results) {
      if (result !== first) {
        return false;
      }
    }
    return true;
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

  static printSource(source) {
    console.log(chalk.blue('## Source'));
    console.log(`${source}\n`);
  }

}
