const mysql = require('mysql2/promise');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // Try to connect
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Test query
    const [rows] = await connection.execute('SELECT 1 as test');
    
    // Get list count
    const [lists] = await connection.execute('SELECT COUNT(*) as count FROM lists');
    
    // Get subscriber count
    const [subscribers] = await connection.execute('SELECT COUNT(*) as count FROM subscribers');

    await connection.end();

    res.status(200).json({
      success: true,
      message: '✅ Database connection successful!',
      test_query: rows[0],
      stats: {
        lists: lists[0].count,
        subscribers: subscribers[0].count
      },
      connection_info: {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ Database connection failed',
      error: error.message,
      code: error.code,
      errno: error.errno
    });
  }
};