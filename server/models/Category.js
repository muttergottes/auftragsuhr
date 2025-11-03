const db = require('../config/database');

class Category {
  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT id, name, type, color, is_active, is_productive, 
               auto_break, max_duration_minutes, created_at, updated_at
        FROM categories 
        WHERE 1=1
      `;
      const params = [];

      if (filters.type) {
        query += ' AND type = ?';
        params.push(filters.type);
      }

      if (filters.active !== undefined) {
        query += ' AND is_active = ?';
        params.push(filters.active);
      }

      query += ' ORDER BY name ASC';

      const rows = await db.query(query, params);
      return rows;
    } catch (error) {
      console.error('Error in Category.findAll:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const rows = await db.query(
        'SELECT * FROM categories WHERE id = ?',
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error in Category.findById:', error);
      throw error;
    }
  }

  static async create(categoryData) {
    try {
      const name = categoryData.name;
      const type = categoryData.type || 'other';
      const color = categoryData.color || '#6c757d';
      const is_active = categoryData.is_active !== undefined ? categoryData.is_active : 1;
      const is_productive = categoryData.is_productive !== undefined ? categoryData.is_productive : 1;
      const auto_break = categoryData.auto_break !== undefined ? categoryData.auto_break : 0;
      const max_duration_minutes = categoryData.max_duration_minutes || null;

      const result = await db.query(
        `INSERT INTO categories 
         (name, type, color, is_active, is_productive, auto_break, max_duration_minutes) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, type, color, is_active, is_productive, auto_break, max_duration_minutes]
      );

      return result.insertId;
    } catch (error) {
      console.error('Error in Category.create:', error);
      throw error;
    }
  }

  static async update(id, categoryData) {
    try {
      const {
        name,
        type,
        color,
        is_active,
        is_productive,
        auto_break,
        max_duration_minutes
      } = categoryData;

      // Convert undefined to null for MySQL
      const cleanedData = {
        name: name || null,
        type: type || 'other',
        color: color || '#6c757d',
        is_active: is_active !== undefined ? (is_active ? 1 : 0) : 1,
        is_productive: is_productive !== undefined ? (is_productive ? 1 : 0) : 1,
        auto_break: auto_break !== undefined ? (auto_break ? 1 : 0) : 0,
        max_duration_minutes: max_duration_minutes || null
      };

      const result = await db.query(
        `UPDATE categories 
         SET name = ?, type = ?, color = ?, is_active = ?, 
             is_productive = ?, auto_break = ?, max_duration_minutes = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          cleanedData.name, 
          cleanedData.type, 
          cleanedData.color, 
          cleanedData.is_active, 
          cleanedData.is_productive, 
          cleanedData.auto_break, 
          cleanedData.max_duration_minutes, 
          id
        ]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in Category.update:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const result = await db.query(
        'DELETE FROM categories WHERE id = ?',
        [id]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in Category.delete:', error);
      throw error;
    }
  }

  static async getWorkCategories() {
    try {
      const rows = await db.query(
        `SELECT id, name, type, color 
         FROM categories 
         WHERE type = 'work' AND is_active = 1 
         ORDER BY name ASC`
      );
      return rows;
    } catch (error) {
      console.error('Error in Category.getWorkCategories:', error);
      throw error;
    }
  }

  static async getBreakCategories() {
    try {
      const rows = await db.query(
        `SELECT id, name, type, color, max_duration_minutes 
         FROM categories 
         WHERE type = 'break' AND is_active = 1 
         ORDER BY name ASC`
      );
      return rows;
    } catch (error) {
      console.error('Error in Category.getBreakCategories:', error);
      throw error;
    }
  }
}

module.exports = Category;