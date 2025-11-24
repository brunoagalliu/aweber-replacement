const authService = require('../src/config/auth');
const { generateToken, verifyToken } = require('../src/middleware/auth');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Parse request body if it's POST
    let body = {};
    if (req.method === 'POST' && req.body) {
      body = req.body;
    }

    // Get the path after /api/auth
    const path = req.url.replace(/^\/api\/auth/, '').split('?')[0] || '/';

    // Route handling
    if (path === '/login' && req.method === 'POST') {
      return await handleLogin(req, res, body);
    }

    if (path === '/logout' && req.method === 'POST') {
      return await handleLogout(req, res);
    }

    if (path === '/me' && req.method === 'GET') {
      return await handleMe(req, res);
    }

    if (path === '/change-password' && req.method === 'POST') {
      return await handleChangePassword(req, res, body);
    }

    // Route not found
    return res.status(404).json({ error: 'Route not found' });

  } catch (error) {
    console.error('Auth API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

// Login handler
async function handleLogin(req, res, body) {
  const { username, password } = body;

  if (!username || !password) {
    return res.status(400).json({ 
      error: 'Username and password are required' 
    });
  }

  const user = await authService.validateCredentials(username, password);

  if (!user) {
    return res.status(401).json({ 
      error: 'Invalid username or password' 
    });
  }

  const token = generateToken(user);

  console.log('✅ User logged in:', user.username);

  return res.status(200).json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name
    }
  });
}

// Logout handler
async function handleLogout(req, res) {
  return res.status(200).json({ 
    success: true, 
    message: 'Logged out successfully' 
  });
}

// Get current user handler
async function handleMe(req, res) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'NO_TOKEN'
    });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ 
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }

  return res.status(200).json({
    success: true,
    user: decoded
  });
}

// Change password handler
async function handleChangePassword(req, res, body) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required' 
    });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ 
      error: 'Invalid token' 
    });
  }

  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ 
      error: 'Current and new password are required' 
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ 
      error: 'New password must be at least 8 characters' 
    });
  }

  const user = await authService.validateCredentials(
    decoded.username, 
    currentPassword
  );

  if (!user) {
    return res.status(401).json({ 
      error: 'Current password is incorrect' 
    });
  }

  const newHash = await authService.hashPassword(newPassword);

  console.log('🔐 New password hash for', user.username, ':', newHash);
  console.log('⚠️  Update this hash in your .env file as ADMIN_PASSWORD_HASH');

  return res.status(200).json({ 
    success: true, 
    message: 'Password changed successfully',
    passwordHash: newHash
  });
}