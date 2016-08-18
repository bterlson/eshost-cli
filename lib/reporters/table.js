const Reporter = require('../Reporter.js');
const chalk = require('chalk');
const Table = require('cli-table');

module.exports = class TableReporter extends Reporter {
  constructor(options) {
    super(options);
    this.results = new Table();
  }

  start(text) {
    if (this.options.showSource) {
      console.log(chalk.blue('## Source'));
      console.log(text);
      console.log("");
    }
  }

  result(host, result) {
    let resultCell = result.stdout.trim();
    if (result.error) {
      resultCell += '\n' + chalk.red(`${result.error.name}: ${result.error.message}`);
    }
    resultCell = resultCell.replace(/\r/g, '');

    if (this.options.coalesce) {
      Reporter.coalesceInto(this.results, host, resultCell);
    } else {
      this.results.push([
        host.name, resultCell
      ]);
    }
  }

  end() {
    console.log(this.results.toString());
  }
}
