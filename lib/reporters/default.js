const Reporter = require('../Reporter.js');
const chalk = require('chalk');

module.exports = class DefaultReporter extends Reporter {
  constructor(options) {
    super(options);
    this.source = undefined;
    this.results = [];
    this.resultsMap = {};
  }
  start(source) {
    this.source = source;
  }
  result(host, result) {
    let resultString = result.stdout.trim();
    if (result.error) {
      resultString += chalk.red(`${result.error.name}: ${result.error.message}`);
    }

    if (this.options.coalesce) {
      Reporter.coalesceInto(this.results, host, resultString, this.resultsMap, ", ");
    } else {
      Reporter.addTo(host.name, resultString);
    }
  }
  end() {
    if (this.options.coalesce) {
      if (this.options.quorum && this.results.length == 1) {
        process.exit(0);
        // don't print anything
      } else {
        if (this.options.showSource) {
          Reporter.printSource(this.source);
        }

        this.results.forEach(row => {
          printHostResult(row[0], row[1]);
        })

        if (this.options.quorum) {
          process.exit(1);
        }
      }
    }
  }
}

function printHostResult(name, result) {
  console.log(chalk.blue(`#### ${name}`));
  console.log(result);
  console.log("");
}
