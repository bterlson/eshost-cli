'use strict';

const { table } = require('table')
const chalk = require('chalk');

function buildTable(content, markdown=false) {
  if (!markdown) {
    content[0] = content[0].map((n) => chalk.red(n));
    return table(content);
  } else {
    return table(content, {
      border: {
        topBody: '',
        topJoin: '',
        topLeft: '',
        topRight: '',
        bottomBody: '',
        bottomJoin: '',
        bottomLeft: '',
        bottomRight: '',
        bodyLeft: '|',
        bodyRight: '|',
        bodyJoin: '|',
        joinBody: '-',
        joinLeft: '|',
        joinRight: '|',
        joinJoin: '|'
      },
      drawHorizontalLine: (index) => index === 1
    });
  }
}

module.exports = { buildTable }
