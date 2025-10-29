const mysql = require('mysql2/promise');
require('dotenv').config();

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
      // Get all subscribers or by list
      const { listId } = req.query || {};
      
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
      // Add subscriber
      const { email, name, phone, listId } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Insert subscriber
      const [result] = await pool.execute(
        `INSERT INTO subscribers (email, name, phone, date_added, stop_status, ip_address)
         VALUES (?, ?, ?, NOW(), 0, ?)
         ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
        [email, name || null, phone || null, req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null]
      );

      const subscriberId = result.insertId;

      // Add to list if specified
      if (listId) {
        await pool.execute(
          'INSERT IGNORE INTO list_subscribers (subscriber_id, list_id) VALUES (?, ?)',
          [subscriberId, listId]
        );
      }

      return res.status(201).json({ 
        id: subscriberId, 
        message: 'Subscriber added successfully' 
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'This email is already subscribed' });
    }
    
    res.status(500).json({ error: error.message });
  }
};