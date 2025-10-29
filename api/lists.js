const mysql = require('mysql2/promise');
//require('dotenv').config();

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Get all lists
      const [lists] = await pool.execute('SELECT * FROM lists ORDER BY created_at DESC');
      return res.json(lists);
    }

    if (req.method === 'POST') {
      // Create list
      const { name, description } = req.body;
      const [result] = await pool.execute(
        'INSERT INTO lists (name, description) VALUES (?, ?)',
        [name, description]
      );
      return res.status(201).json({ id: result.insertId, message: 'List created successfully' });
    }

    if (req.method === 'DELETE') {
      // Delete list
      const id = req.url.split('/').pop();
      await pool.execute('DELETE FROM lists WHERE id = ?', [id]);
      return res.json({ message: 'List deleted successfully' });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};