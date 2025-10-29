const Subscriber = require('../models/Subscriber');
const fs = require('fs');
const csv = require('csv-parser');

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

exports.addSubscriber = async (req, res) => {
  try {
    const { email, name, phone, listId } = req.body;
    
    // Validation
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const subscriberData = {
      email: email.trim(),
      name: name ? name.trim() : '',
      phone: phone ? phone.replace(/\D/g, '') : '',
      date_added: new Date(),
      stop_status: 0,
      ip_address: req.ip || req.connection.remoteAddress || '',
      web_form_url: req.headers.referer || ''
    };
    
    console.log('📝 Adding new subscriber:', subscriberData.email, 'to list:', listId);
    
    const subscriberId = await Subscriber.create(subscriberData);
    
    if (listId) {
      await Subscriber.addToList(subscriberId, listId);
      console.log('✅ Subscriber added to list', listId);
    }
    
    res.status(201).json({ 
      id: subscriberId, 
      message: 'Subscriber added successfully',
      email: subscriberData.email
    });
  } catch (error) {
    console.error('Error adding subscriber:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This email is already subscribed' });
    }
    
    res.status(500).json({ error: 'Failed to add subscriber. Please try again.' });
  }
};

exports.importCSV = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { listId } = req.body;
    const filePath = req.file.path;
    
    let imported = 0;
    let duplicates = 0;
    let skipped = 0;
    let total = 0;
    let batch = [];
    const BATCH_SIZE = 500;

    console.log('🚀 Starting ultra-fast CSV import from:', filePath);

    const processedEmails = [];
    let headerLogged = false;

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
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
            console.log(`⏭️ Row ${total} skipped - no email`);
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
            phone: phone ? phone.toString().replace(/\D/g, '') : '' // Clean phone number
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
        })
        .on('end', () => resolve())
        .on('error', (error) => reject(error));
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
    
    res.json({ 
      message: 'Import completed',
      imported,
      duplicates,
      skipped,
      total,
      duration: `${duration}s`
    });

  } catch (error) {
    console.error('💥 Import error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getSubscribers = async (req, res) => {
  try {
    const { listId } = req.query;
    const subscribers = listId 
      ? await Subscriber.getByListId(listId)
      : await Subscriber.getAll();
    res.json(subscribers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};