const Reporter = require('../Reporter.js');
const chalk = require('chalk');
const Table = require('cli-table');

module.exports = class TableReporter extends Reporter {
  constructor(options) {
    super(options);
    this.source = undefined;
    this.results = [];
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

    this.results.push([
      host.name, resultCell
    ]);
  }

  end() {
    if (this.options.unanimous && this.isUnanimous) {
      process.exit(0);
      // don't print anything
    } else {
      this.results.sort((a,b) => a[0].localeCompare(b[0]));

      const table = new Table();
      if (this.options.coalesce) {
        for (const [ resultString, hosts ] of Reporter.coalsece(this.results)) {
          const joinedHosts = hosts.join("\n").trim();
          table.push([joinedHosts, resultString]);
        }
      } else {
        table.push(...this.results);
      }

      console.log(table.toString());

      if (this.options.unanimous) {
        process.exit(1);
      }
    }
  }
}
