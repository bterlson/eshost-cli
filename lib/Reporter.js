const chalk = require('chalk');

module.exports = class Reporter {
  constructor (options = {}) {
    this.options = options;
  }
  start() {}
  result(host, result) {}
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

  static coalsece(records) {
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
