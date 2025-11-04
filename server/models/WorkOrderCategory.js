const db = require('../config/database');

class WorkOrderCategory {
  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT id, name, description, color, is_active, created_at, updated_at
        FROM categories 
        WHERE 1=1
      `;
      const params = [];

      if (filters.active !== undefined) {
        query += ' AND is_active = ?';
        params.push(filters.active);
      }

      query += ' ORDER BY name ASC';

      const rows = await db.query(query, params);
      return rows;
    } catch (error) {
      console.error('Error in WorkOrderCategory.findAll:', error);
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
      console.error('Error in WorkOrderCategory.findById:', error);
      throw error;
    }
  }

  static async create(categoryData) {
    try {
      const {
        name,
        description = null,
        color = '#007bff',
        is_active = true
      } = categoryData;

      const result = await db.query(
        `INSERT INTO categories 
         (name, description, color, is_active) 
         VALUES (?, ?, ?, ?)`,
        [name, description, color, is_active]
      );

      return result.insertId;
    } catch (error) {
      console.error('Error in WorkOrderCategory.create:', error);
      throw error;
    }
  }

  static async update(id, categoryData) {
    try {
      const {
        name,
        description,
        color,
        is_active
      } = categoryData;

      const result = await db.query(
        `UPDATE categories 
         SET name = ?, description = ?, color = ?, is_active = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [name, description, color, is_active, id]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in WorkOrderCategory.update:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      // Check if category is in use
      const workOrders = await db.query(
        'SELECT COUNT(*) as count FROM work_orders WHERE category_id = ?',
        [id]
      );

      if (workOrders[0].count > 0) {
        throw new Error('Kategorie kann nicht gelöscht werden, da sie in Aufträgen verwendet wird');
      }

      const result = await db.query(
        'DELETE FROM categories WHERE id = ?',
        [id]
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in WorkOrderCategory.delete:', error);
      throw error;
    }
  }

  static async getActive() {
    try {
      const rows = await db.query(
        `SELECT id, name, description, color 
         FROM categories 
         WHERE is_active = 1 
         ORDER BY name ASC`
      );
      return rows;
    } catch (error) {
      console.error('Error in WorkOrderCategory.getActive:', error);
      throw error;
    }
  }
}

module.exports = WorkOrderCategory;