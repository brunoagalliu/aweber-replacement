const express = require('express');
const router = express.Router();
const listController = require('../controllers/listController');
const { requireAuth } = require('../middleware/auth');

// Protect all list routes
router.use(requireAuth);

router.post('/', listController.createList);
router.get('/', listController.getAllLists);
router.delete('/:id', listController.deleteList);

module.exports = router;