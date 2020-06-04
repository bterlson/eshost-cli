const Reporter = require('../Reporter.js');
const chalk = require('chalk');

const { buildTable } = require('../table');

module.exports = class TableReporter extends Reporter {
  printResults(results) {
    let table = [['Engine', 'Results'], ...results];

    console.log(buildTable(table, this.options.markdown));
  }
}
