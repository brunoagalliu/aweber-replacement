const Subscriber = require('../models/Subscriber');
const fs = require('fs');
const csv = require('csv-parser');

exports.importCSVWithProgress = async (req, res) => {
  const { listId } = req.body;
  const filePath = req.file.path;

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let imported = 0;
  let duplicates = 0;
  let skipped = 0;
  let total = 0;

  const sendProgress = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', async (row) => {
        total++;
        
        // Process row...
        // Send progress every 100 rows
        if (total % 100 === 0) {
          sendProgress({
            type: 'progress',
            total,
            imported,
            duplicates,
            skipped,
            percentage: 0 // Calculate if you know total rows
          });
        }
      })
      .on('end', () => {
        fs.unlinkSync(filePath);
        sendProgress({
          type: 'complete',
          total,
          imported,
          duplicates,
          skipped
        });
        res.end();
      });
  } catch (error) {
    sendProgress({ type: 'error', message: error.message });
    res.end();
  }
};