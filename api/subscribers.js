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
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Parse query parameters
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
      // Add subscriber with Trestle validation
      const { email, name, phone, listId } = req.body;

      // Basic validation
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Clean phone number
      const cleanPhone = phone.replace(/\D/g, '');
      
      if (cleanPhone.length < 10) {
        return res.status(400).json({ error: 'Invalid phone number' });
      }

      // 🤖 TRESTLE BOT DETECTION
      console.log('🔍 Validating phone with Trestle:', cleanPhone);
      
      const validation = await trestleService.validatePhone(cleanPhone, {
        email: email,
        name: name,
        ip: req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'],
        user_agent: req.headers['user-agent']
      });

      console.log('📊 Trestle validation result:', {
        score: validation.score,
        isBot: validation.isBot,
        riskLevel: validation.riskLevel
      });

      // Block if bot score is 70 or higher
      if (validation.isBot) {
        await trestleService.logBotAttempt({
          email,
          phone: cleanPhone,
          score: validation.score,
          ip: req.headers['x-forwarded-for']?.split(',')[0]
        });

        return res.status(403).json({ 
          error: 'Submission blocked due to suspicious activity',
          message: 'Your submission could not be processed. Please contact support if you believe this is an error.',
          code: 'BOT_DETECTED'
        });
      }

      // Check if phone is valid
      if (!validation.isValid) {
        return res.status(400).json({ 
          error: 'Invalid phone number',
          message: 'The phone number provided is not valid. Please check and try again.'
        });
      }

      // Insert subscriber
      const [result] = await pool.execute(
        `INSERT INTO subscribers (
          email, name, phone, date_added, stop_status, ip_address, 
          misc, ad_tracking
        )
        VALUES (?, ?, ?, NOW(), 0, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [
          email, 
          name || null, 
          cleanPhone,
          req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || null,
          JSON.stringify({ trestle_score: validation.score, risk_level: validation.riskLevel }),
          `trestle_validated_${validation.score}`
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

      console.log('✅ Subscriber added successfully:', email, '| Trestle score:', validation.score);

      return res.status(201).json({ 
        id: subscriberId, 
        message: 'Subscriber added successfully',
        email: email,
        validation: {
          score: validation.score,
          verified: true
        }
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This email is already subscribed' });
    }
    
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
};