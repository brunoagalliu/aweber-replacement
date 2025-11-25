const pool = require('../src/config/database');
const trestleService = require('../src/services/trestleService');
const Subscriber = require('../src/models/Subscriber');
const fs = require('fs');
const csv = require('csv-parser');
const multer = require('multer');
const path = require('path');
const os = require('os');

// Helper to parse request body
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Helper function to parse AWeber date format
function parseAWeberDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2})(am|pm)/i);
    if (!match) return null;
    
    let [, month, day, year, hour, minute, ampm] = match;
    year = '20' + year;
    hour = parseInt(hour);
    if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12;
    if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
    
    return `${year}-${month}-${day} ${hour.toString().padStart(2, '0')}:${minute}:00`;
  } catch (error) {
    console.error('Date parsing error:', error);
    return null;
  }
}

// Configure multer for file uploads
const uploadDir = path.join(os.tmpdir(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname.replace(/^\/api\/subscribers/, '');

    // GET /api/subscribers - Get all subscribers or by list
    if (req.method === 'GET' && path === '') {
      const listId = url.searchParams.get('listId');
      
      let query = 'SELECT * FROM subscribers ORDER BY date_added DESC';
      let params = [];
      
      if (listId) {
        query = `SELECT s.* FROM subscribers s
                 JOIN list_subscribers ls ON s.id = ls.subscriber_id
                 WHERE ls.list_id = ?
                 ORDER BY s.date_added DESC`;
        params = [listId];
      }
      
      const [subscribers] = await pool.execute(query, params);
      return res.json(subscribers);
    }

    // POST /api/subscribers - Add single subscriber
    if (req.method === 'POST' && path === '') {
      // Parse body for JSON requests
      let body;
      const contentType = req.headers['content-type'] || '';
      
      if (contentType.includes('application/json')) {
        if (typeof req.body === 'string') {
          body = JSON.parse(req.body);
        } else if (req.body) {
          body = req.body;
        } else {
          body = await parseBody(req);
        }
      } else {
        return res.status(400).json({ 
          error: 'Content-Type must be application/json' 
        });
      }

      const { email, name, phone, listId } = body;

      // Basic validation
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      // Basic email format check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Clean phone number
      const cleanPhone = phone.replace(/\D/g, '');
      
      if (cleanPhone.length < 10) {
        return res.status(400).json({ error: 'Invalid phone number' });
      }

      // Get IP address
      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || 
                       req.headers['x-real-ip'] || 
                       null;

      // 🔒 VERIFY PHONE WITH TRESTLE
      const verification = await trestleService.verifyPhone(cleanPhone, ipAddress);

      console.log('📊 Phone verification:', {
        phone: cleanPhone,
        botScore: verification.botScore,
        isBot: verification.isBot,
        verified: verification.verified
      });

      // Block if bot score is 70 or higher
      if (verification.isBot) {
        console.log('🤖 BOT DETECTED - Blocking submission:', {
          email,
          phone: cleanPhone,
          score: verification.botScore,
          ip: ipAddress
        });

        return res.status(403).json({ 
          error: 'Phone verification failed',
          message: 'We could not verify your phone number. Please try again or contact support.',
          code: 'BOT_DETECTED'
        });
      }

      // Block if phone is invalid
      if (!verification.valid) {
        return res.status(400).json({ 
          error: 'Invalid phone number',
          message: 'The phone number provided is not valid.'
        });
      }

      // Insert subscriber
      const [result] = await pool.execute(
        `INSERT INTO subscribers (
          email, name, phone, date_added, stop_status, ip_address, misc
        )
        VALUES (?, ?, ?, NOW(), 0, ?, ?)
        ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [
          email, 
          name || null, 
          cleanPhone,
          ipAddress,
          JSON.stringify({ 
            trestle_score: verification.botScore,
            phone_type: verification.phoneType,
            carrier: verification.carrier,
            verified_at: new Date().toISOString()
          })
        ]
      );

      const subscriberId = result.insertId;

      // Add to list if specified
      if (listId) {
        await pool.execute(
          'INSERT IGNORE INTO list_subscribers (subscriber_id, list_id) VALUES (?, ?)',
          [subscriberId, listId]
        );
      }

      console.log('✅ Subscriber added:', email, '| Bot score:', verification.botScore);

      return res.status(201).json({ 
        id: subscriberId, 
        message: 'Subscriber added successfully',
        email: email,
        verified: true
      });
    }

    // POST /api/subscribers/import - Import CSV
    if (req.method === 'POST' && path === '/import') {
      return new Promise((resolve) => {
        upload.single('file')(req, res, async (err) => {
          if (err) {
            console.error('❌ Multer error:', err);
            return res.status(400).json({ error: err.message });
          }

          const startTime = Date.now();

          try {
            console.log('📥 Import request received');
            console.log('Body:', req.body);
            console.log('File:', req.file);

            // Check if file exists
            if (!req.file) {
              console.error('❌ No file uploaded');
              return res.status(400).json({ 
                error: 'No file uploaded. Please select a CSV file.' 
              });
            }

            const { listId } = req.body;
            const filePath = req.file.path;
            
            console.log('📂 File path:', filePath);
            console.log('📋 List ID:', listId);

            // Check if file exists on disk
            if (!fs.existsSync(filePath)) {
              console.error('❌ File not found on disk:', filePath);
              return res.status(400).json({ 
                error: 'Uploaded file not found' 
              });
            }

            let imported = 0;
            let duplicates = 0;
            let skipped = 0;
            let total = 0;
            let batch = [];
            const BATCH_SIZE = 500;

            console.log('🚀 Starting ultra-fast CSV import from:', filePath);

            const processedEmails = [];
            let headerLogged = false;

            await new Promise((resolveCSV, rejectCSV) => {
              fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                  try {
                    // Log headers and first row for debugging
                    if (!headerLogged) {
                      console.log('📋 CSV Columns detected:', Object.keys(row));
                      console.log('📋 First row raw data:', JSON.stringify(row, null, 2));
                      headerLogged = true;
                    }

                    total++;
                    
                    const email = row.Email || row.email || row.EMAIL;
                    
                    if (!email || email.trim() === '') {
                      skipped++;
                      if (total <= 5) {
                        console.log(`⏭️ Row ${total} skipped - no email`);
                      }
                      return;
                    }

                    // Try multiple possible column names for phone
                    const phone = row.Phone || row.phone || row.PHONE || 
                                 row['Cell Number'] || row['cell number'] || 
                                 row['Phone Number'] || row['phone number'] ||
                                 row['Custom Cell Number'] || row['custom Cell Number'] || '';

                    const subscriberData = {
                      email: email.trim(),
                      name: row.Name || row.name || '',
                      date_added: parseAWeberDate(row['Date Added']) || null,
                      stop_time: parseAWeberDate(row['Stop Time']) || null,
                      stop_status: parseInt(row['Stop Status']) || 0,
                      misc: row.Misc || '',
                      ad_tracking: row['Ad Tracking'] || '',
                      ip_address: row['IP Address'] || '',
                      web_form_url: row['Web Form URL'] || '',
                      country: row.Country || '',
                      region: row.Region || '',
                      city: row.City || '',
                      postal_code: row['Postal Code'] || '',
                      latitude: row.Latitude ? parseFloat(row.Latitude) : null,
                      longitude: row.Longitude ? parseFloat(row.Longitude) : null,
                      dma_code: row['DMA Code'] || '',
                      area_code: row['Area Code'] || '',
                      tags: row.Tags || '',
                      phone: phone ? phone.toString().replace(/\D/g, '') : ''
                    };

                    // Debug first 3 rows
                    if (total <= 3) {
                      console.log(`\n📞 Row ${total} phone debug:`);
                      console.log('  - Phone value extracted:', phone);
                      console.log('  - Phone after cleaning:', subscriberData.phone);
                      console.log('  - Email:', subscriberData.email);
                    }

                    batch.push(subscriberData);
                    processedEmails.push(subscriberData.email);
                  } catch (rowError) {
                    console.error(`❌ Error processing row ${total}:`, rowError);
                    skipped++;
                  }
                })
                .on('end', () => resolveCSV())
                .on('error', (error) => rejectCSV(error));
            });

            console.log(`📊 Total rows read: ${total}, Valid: ${batch.length}, Skipped: ${skipped}`);

            // Show sample of data being imported
            if (batch.length > 0) {
              console.log('\n📋 Sample of data to import (first record):');
              console.log(JSON.stringify(batch[0], null, 2));
            }

            // Process all batches
            const batches = [];
            for (let i = 0; i < batch.length; i += BATCH_SIZE) {
              batches.push(batch.slice(i, i + BATCH_SIZE));
            }

            console.log(`⚡ Processing ${batches.length} batches of up to ${BATCH_SIZE} records each...`);

            for (let i = 0; i < batches.length; i++) {
              try {
                const result = await Subscriber.bulkCreate(batches[i]);
                imported += result.affectedRows;
                duplicates += result.duplicates;
                
                if ((i + 1) % 10 === 0 || i === batches.length - 1) {
                  console.log(`✅ Processed batch ${i + 1}/${batches.length} - Total imported: ${imported}, Duplicates: ${duplicates}`);
                }
              } catch (error) {
                console.error(`❌ Error in batch ${i + 1}:`, error.message);
                skipped += batches[i].length;
              }
            }

            // Add all subscribers to the list in one go
            if (listId && processedEmails.length > 0) {
              console.log(`🔗 Adding ${processedEmails.length} subscribers to list ${listId}...`);
              try {
                await Subscriber.bulkAddToList(processedEmails, listId);
                console.log('✅ List associations complete');
              } catch (error) {
                console.error('❌ Error adding to list:', error.message);
              }
            }

            // Clean up
            try {
              fs.unlinkSync(filePath);
            } catch (err) {
              console.error('Error deleting file:', err);
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`🎉 Import complete in ${duration}s - Imported: ${imported}, Duplicates: ${duplicates}, Skipped: ${skipped}`);
            
            return res.json({ 
              message: 'Import completed',
              imported,
              duplicates,
              skipped,
              total,
              duration: `${duration}s`
            });

          } catch (error) {
            console.error('💥 Import error:', error);
            return res.status(500).json({ 
              error: error.message || 'Import failed'
            });
          }
        });
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('❌ Error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This email is already subscribed' });
    }
    
    return res.status(500).json({ 
      error: 'An error occurred. Please try again.',
      details: error.message
    });
  }
};