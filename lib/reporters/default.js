const Reporter = require('../Reporter.js');
const chalk = require('chalk');

module.exports = class DefaultReporter extends Reporter {
  end() {
    if (this.options.unanimous && this.isUnanimous) {
      process.exit(0);
      // don't print anything
    } else {
      this.results.sort((a,b) => a[0].localeCompare(b[0]));
      if (this.options.coalesce) {
        for (const [ resultString, hosts ] of Reporter.coalsece(this.results)) {
          const joinedHosts = hosts.join(", ").trim();
          printHostResult(joinedHosts, resultString);
        }

        if (this.options.unanimous) {
          process.exit(1);
        }
      } else {
        this.results.forEach(row => {
          printHostResult(row[0], row[1]);
        });
      }
    }
  }
}

function printHostResult(name, result) {
  console.log(chalk.blue(`#### ${name}`));
  console.log(`${result}\n`);
}
