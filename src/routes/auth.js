const express = require('express');
const router = express.Router();
const authService = require('../config/auth');
const { generateToken, requireAuth } = require('../middleware/auth');

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }

    // Validate credentials
    const user = await authService.validateCredentials(username, password);

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid username or password' 
      });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Log successful login
    console.log('✅ User logged in:', user.username);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Logout endpoint
router.post('/logout', requireAuth, (req, res) => {
  // With JWT, logout is handled client-side by removing the token
  // You could add token blacklisting here if needed
  res.json({ success: true, message: 'Logged out successfully' });
});

// Verify token / Get current user
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Change password (optional)
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

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

    // Validate current password
    const user = await authService.validateCredentials(
      req.user.username, 
      currentPassword
    );

    if (!user) {
      return res.status(401).json({ 
        error: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const newHash = await authService.hashPassword(newPassword);

    // In production, save to database
    console.log('🔐 New password hash for', user.username, ':', newHash);
    console.log('⚠️  Update this hash in your .env file as ADMIN_PASSWORD_HASH');

    res.json({ 
      success: true, 
      message: 'Password changed successfully',
      passwordHash: newHash
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;