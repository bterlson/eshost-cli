const Reporter = require('../Reporter.js');
const chalk = require('chalk');

module.exports = class DefaultReporter extends Reporter {
  printResults(results) {
    for (const [name, result] of results) {
      console.log(chalk.blue(`#### ${name}`));
      if (this.options.markdown)
        console.log("");
      console.log(`${result}\n`);
    }
  }
}
