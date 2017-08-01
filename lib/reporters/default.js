const Reporter = require('../Reporter.js');
const chalk = require('chalk');

module.exports = class DefaultReporter extends Reporter {
  constructor (options) {
    super(options);
    this.results = [];
    this.resultsMap = {};
  }
  start(text) {
    if (this.options.showSource) {
      console.log(chalk.blue('## Source'));
      console.log(text);
      console.log("");
    }
  }
  result(host, result) {
    let resultString = result.stdout.trim();
    if (result.error) {
      resultString += chalk.red(`${result.error.name}: ${result.error.message}`);
    }

    if (this.options.coalesce) {
      Reporter.coalesceInto(this.results, host, resultString, this.resultsMap, ", ");
    } else {
      printHostResult(host.name, resultString);
    }
  }
  end() {
    if (this.options.coalesce) {
      this.results.forEach(row => {
        printHostResult(row[0], row[1]);
      })
    }
  }
}

function printHostResult(name, result) {
  console.log(chalk.blue(`#### ${name}`));
  console.log(result);
  console.log("");
}
