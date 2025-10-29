const List = require('../models/List');

exports.createList = async (req, res) => {
  try {
    const { name, description } = req.body;
    const listId = await List.create(name, description);
    res.status(201).json({ id: listId, message: 'List created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllLists = async (req, res) => {
  try {
    const lists = await List.getAll();
    res.json(lists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteList = async (req, res) => {
  try {
    await List.delete(req.params.id);
    res.json({ message: 'List deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};