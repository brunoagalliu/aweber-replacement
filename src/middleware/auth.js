const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days

// Middleware to protect routes
const requireAuth = (req, res, next) => {
  try {
    // Check for token in header or cookie
    const token = req.headers.authorization?.split(' ')[1] || 
                  req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Add user info to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Session expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({ 
      error: 'Invalid authentication token',
      code: 'INVALID_TOKEN'
    });
  }
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// Verify token (useful for frontend)
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  requireAuth,
  generateToken,
  verifyToken,
  JWT_SECRET
};