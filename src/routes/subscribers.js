const express = require('express');
const router = express.Router();
const subscriberController = require('../controllers/subscriberController');
const upload = require('../middleware/upload');

router.post('/', subscriberController.addSubscriber);
router.post('/import', upload.single('file'), subscriberController.importCSV);
router.get('/', subscriberController.getSubscribers);

module.exports = router;