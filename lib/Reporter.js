const chalk = require('chalk');

module.exports = class Reporter {
  constructor (options = {}) {
    this.options = options;
    this.source = undefined;
    this.results = [];
  }

  start(source) {
    this.source = source;

    if (this.options.showSource) {
      Reporter.printSource(source);
    }
  }

  result(host, result) {
    let resultCell = result.stdout.trim();
    if (result.error) {
      resultCell += '\n' + chalk.red(`${result.error.name}: ${result.error.message}`);
    }
    resultCell = resultCell.replace(/\r/g, '');

    this.results.push([
      host.name, resultCell
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
