const express = require('express');
const router = express.Router();
const listController = require('../controllers/listController');

router.post('/', listController.createList);
router.get('/', listController.getAllLists);
router.delete('/:id', listController.deleteList);

module.exports = router;