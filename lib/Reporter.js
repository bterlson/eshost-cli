const chalk = require('chalk');

module.exports = class Reporter {
  constructor (options = {}) {
    this.options = options;
  }
  start(){}
  result(host, result) { }
  end(){}

  static coalesceInto(table, host, result, resultsMap /*{result:[...hosts]}*/, sep = "\n") {
    let found = false;

    for (let row of table) {
      if (row[1] === result) {
        let hosts = resultsMap[result];
        hosts.push(host);
        hosts.sort((a,b) => a.name.localeCompare(b.name));

        let text = hosts[0].name;
        hosts.slice(1).forEach((x) => {
          text += sep + x.name;
        });
        text = text.trim();
        row[0] = text;

        found = true;
        break;
      }
    }

    if (!found) {
      resultsMap[result] = [host];
      table.push([
        host.name, result
      ]);
    }
  }

  static addTo(hostName, result) {
    table.push([
      hostName, result
    ]);
  }

  static printSource(source) {
    console.log(chalk.blue("## Source"));
    console.log(source);
    console.log("");
  }
}
