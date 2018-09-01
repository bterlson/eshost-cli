const Reporter = require('../Reporter.js');
const chalk = require('chalk');
const Table = require('cli-table');

module.exports = class TableReporter extends Reporter {
  constructor(options) {
    super(options);
    this.source = undefined;
    this.results = new Table();
    this.resultsMap = {};
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

    if (this.options.coalesce) {
      Reporter.coalesceInto(this.results, host, resultCell, this.resultsMap);
    } else {
      this.results.push([
        host.name, resultCell
      ]);
    }
  }

  end() {
    if (this.options.unanimous && this.isUnanimous) {
      process.exit(0);
      // don't print anything
    } else {
      console.log(this.results.toString());

      if (this.options.unanimous) {
        process.exit(1);
      }
    }
  }
}
