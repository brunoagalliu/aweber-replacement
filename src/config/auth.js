const bcrypt = require('bcrypt');

// In production, store these in your database
// For now, we'll use environment variables
const ADMIN_USERS = [
  {
    id: 1,
    username: process.env.ADMIN_USERNAME || 'admin',
    // Hash this password! For demo: password123
    passwordHash: process.env.ADMIN_PASSWORD_HASH || '$2b$10$rKvFQXqL4vN5K3bYW5xmYeLqJXqX5kQy9qYvFXqL4vN5K3bYW5xmYe',
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    name: 'Administrator'
  }
];

class AuthService {
  async validateCredentials(username, password) {
    const user = ADMIN_USERS.find(u => u.username === username);
    
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      return null;
    }

    // Return user without password
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name
    };
  }

  async hashPassword(password) {
    return await bcrypt.hash(password, 10);
  }

  generateSessionToken() {
    return require('crypto').randomBytes(32).toString('hex');
  }
}

module.exports = new AuthService();