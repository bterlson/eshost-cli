module.exports = class Reporter {
  constructor (options = {}) {
    this.options = options;
  }
  start(){}
  result(host, result) { }
  end(){}

  static coalesceInto(table, host, result, sep = "\n") {
    let found = false;

    for (let row of table) {
      if (row[1] === result) {
        row[0] += sep + host.name;
        found = true;
        break;
      }
    }

    if (!found) {
      table.push([
        host.name, result
      ]);
    }
  }
}
