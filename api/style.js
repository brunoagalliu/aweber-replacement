const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const css = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');
  res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.status(200).send(css);
};