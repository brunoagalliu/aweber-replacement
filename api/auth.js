const authRoutes = require('../src/routes/auth');

module.exports = (req, res) => {
  // Handle auth routes
  authRoutes(req, res);
};