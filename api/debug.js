module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.json({
      env_check: {
        DB_HOST: process.env.DB_HOST ? '✅ Set' : '❌ Missing',
        DB_USER: process.env.DB_USER ? '✅ Set' : '❌ Missing',
        DB_PASSWORD: process.env.DB_PASSWORD ? '✅ Set' : '❌ Missing',
        DB_NAME: process.env.DB_NAME ? '✅ Set' : '❌ Missing',
        DB_PORT: process.env.DB_PORT ? '✅ Set' : '❌ Missing',
      },
      note: 'Remove this file after debugging'
    });
  };