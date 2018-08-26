const Reporter = require('../Reporter.js');
const chalk = require('chalk');
const Table = require('cli-table');

module.exports = class TableReporter extends Reporter {
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
