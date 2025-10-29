const db = require('../config/database');

class List {
  static async create(name, description) {
    const [result] = await db.execute(
      'INSERT INTO lists (name, description) VALUES (?, ?)',
      [name, description]
    );
    return result.insertId;
  }

  static async getAll() {
    const [rows] = await db.execute('SELECT * FROM lists ORDER BY created_at DESC');
    return rows;
  }

  static async getById(id) {
    const [rows] = await db.execute('SELECT * FROM lists WHERE id = ?', [id]);
    return rows[0];
  }

  static async delete(id) {
    await db.execute('DELETE FROM lists WHERE id = ?', [id]);
  }
}

module.exports = List;