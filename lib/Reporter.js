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

  static coalesceInto(records, host, result, resultsMap /*{result:[...hosts]}*/, sep = "\n") {
    let found = false;

    for (let record of records) {
      if (record[1] === result) {
        let hosts = resultsMap[result];
        hosts.push(host);
        hosts.sort((a,b) => a.name.localeCompare(b.name));

        let text = hosts[0].name;
        hosts.slice(1).forEach((x) => {
          text += sep + x.name;
        });
        text = text.trim();
        record[0] = text;

        found = true;
        break;
      }
    }

    if (!found) {
      resultsMap[result] = [host];
      records.push([
        host.name, result
      ]);
    }
  }

  static printSource(source) {
    console.log(chalk.blue('## Source'));
    console.log(`${source}\n`);
  }
}
