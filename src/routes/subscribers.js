const express = require('express');
const router = express.Router();
const subscriberController = require('../controllers/subscriberController');
const upload = require('../middleware/upload');
const { requireAuth } = require('../middleware/auth'); // ADD THIS

// Public route - allow form submissions
router.post('/', subscriberController.addSubscriber);

// Protect admin routes
router.post('/import', requireAuth, upload.single('file'), subscriberController.importCSV); // ADD requireAuth
router.get('/', requireAuth, subscriberController.getSubscribers); // ADD requireAuth

module.exports = router;