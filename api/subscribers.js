const mysql = require('mysql2/promise');
const trestleService = require('../src/services/trestleService');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 20
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
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

    if (req.method === 'POST') {
      const { email, name, phone, listId } = req.body;

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

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('❌ Error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This email is already subscribed' });
    }
    
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
};