const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const filePath = path.join(__dirname, 'public', 'index.html');
  
  if (fs.existsSync(filePath)) {
    const html = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } else {
    res.status(404).send('File not found');
  }
};