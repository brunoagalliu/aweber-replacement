const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const listRoutes = require('./routes/lists');
const subscriberRoutes = require('./routes/subscribers');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory
const uploadDir = process.env.VERCEL ? path.join(os.tmpdir(), 'uploads') : 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware - ORDER MATTERS!
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// IMPORTANT: Body parsers MUST come before routes
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Static files
app.use(express.static('public'));

// Increase timeout
app.use((req, res, next) => {
  req.setTimeout(600000);
  res.setTimeout(600000);
  next();
});

// Log all requests (helpful for debugging)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/subscribers', subscriberRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Make sure we always return JSON
  res.status(500).json({ 
    error: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Only start server in development
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📝 Login at http://localhost:${PORT}/login.html`);
  });
}

module.exports = app;