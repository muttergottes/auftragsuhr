const express = require('express');
const { body, validationResult } = require('express-validator');
const WorkOrderCategory = require('../models/WorkOrderCategory');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get all work order categories
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { active } = req.query;
    
    // Direct database query to avoid model issues
    const db = require('../config/database');
    let query = `
      SELECT id, name, color, is_active, created_at, updated_at
      FROM categories 
      WHERE 1=1
    `;
    const params = [];

    if (active !== undefined) {
      query += ' AND is_active = ?';
      params.push(active === 'true' ? 1 : 0);
    }

    query += ' ORDER BY name ASC';

    const categories = await db.query(query, params);
    console.log('Raw categories from DB:', categories);
    console.log('Categories type:', typeof categories);
    console.log('Categories is array:', Array.isArray(categories));
    console.log('Categories length:', categories?.length);
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching work order categories:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Abrufen der Auftragskategorien'
    });
  }
});

// Get active work order categories (for selects)
router.get('/active', authenticateToken, async (req, res) => {
  try {
    // Direct database query to avoid model issues
    const db = require('../config/database');
    const categories = await db.query(
      `SELECT id, name, color 
       FROM categories 
       WHERE is_active = 1 
       ORDER BY name ASC`
    );
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching active work order categories:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Abrufen der aktiven Auftragskategorien'
    });
  }
});

// Get single work order category
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const category = await WorkOrderCategory.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Auftragskategorie nicht gefunden'
      });
    }

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching work order category:', error);
    res.status(500).json({
      success: false,
      error: 'Fehler beim Abrufen der Auftragskategorie'
    });
  }
});

// Create work order category (Admin/Dispatcher only)
router.post('/', 
  authenticateToken,
  requireRole(['admin', 'dispatcher']),
  [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name ist erforderlich und darf max. 100 Zeichen haben'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Beschreibung darf max. 500 Zeichen haben'),
    body('color')
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage('Farbe muss ein gültiger Hex-Code sein'),
    body('is_active')
      .optional()
      .isBoolean()
      .withMessage('is_active muss ein Boolean sein')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validierungsfehler',
          details: errors.array()
        });
      }

      const { name, color = '#007bff', is_active = true } = req.body;
      
      // Direct database implementation for reliability
      const db = require('../config/database');
      const result = await db.query(
        `INSERT INTO categories (name, color, is_active) 
         VALUES (?, ?, ?)`,
        [name, color, is_active ? 1 : 0]
      );
      
      const categoryId = result.insertId;

      res.status(201).json({
        success: true,
        message: 'Auftragskategorie erfolgreich erstellt',
        data: { id: categoryId, name, color, is_active }
      });
    } catch (error) {
      console.error('Error creating work order category:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          error: 'Eine Auftragskategorie mit diesem Namen existiert bereits'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Fehler beim Erstellen der Auftragskategorie'
      });
    }
  }
);

// Update work order category (Admin/Dispatcher only)
router.put('/:id',
  authenticateToken,
  requireRole(['admin', 'dispatcher']),
  [
    body('name')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name ist erforderlich und darf max. 100 Zeichen haben'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Beschreibung darf max. 500 Zeichen haben'),
    body('color')
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage('Farbe muss ein gültiger Hex-Code sein'),
    body('is_active')
      .optional()
      .isBoolean()
      .withMessage('is_active muss ein Boolean sein')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validierungsfehler',
          details: errors.array()
        });
      }

      const { name, color, is_active } = req.body;
      
      // Direct database implementation for reliability
      const db = require('../config/database');
      const result = await db.query(
        `UPDATE categories 
         SET name = ?, color = ?, is_active = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [name, color, is_active ? 1 : 0, req.params.id]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Auftragskategorie nicht gefunden'
        });
      }

      // Get the updated category
      const updated = await db.query(
        'SELECT * FROM categories WHERE id = ?',
        [req.params.id]
      );

      res.json({
        success: true,
        data: updated[0],
        message: 'Auftragskategorie erfolgreich aktualisiert'
      });
    } catch (error) {
      console.error('Error updating work order category:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          error: 'Eine Auftragskategorie mit diesem Namen existiert bereits'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Fehler beim Aktualisieren der Auftragskategorie'
      });
    }
  }
);

// Delete work order category (Admin only)
router.delete('/:id',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      // Direct database implementation for reliability
      const db = require('../config/database');
      
      // Check if category is in use
      const workOrders = await db.query(
        'SELECT COUNT(*) as count FROM work_orders WHERE category_id = ?',
        [req.params.id]
      );

      if (workOrders[0].count > 0) {
        return res.status(400).json({
          success: false,
          error: 'Kategorie kann nicht gelöscht werden, da sie in Aufträgen verwendet wird'
        });
      }
      
      const result = await db.query(
        'DELETE FROM categories WHERE id = ?',
        [req.params.id]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Auftragskategorie nicht gefunden'
        });
      }

      res.json({
        success: true,
        message: 'Auftragskategorie erfolgreich gelöscht'
      });
    } catch (error) {
      console.error('Error deleting work order category:', error);

      res.status(500).json({
        success: false,
        error: 'Fehler beim Löschen der Auftragskategorie'
      });
    }
  }
);

module.exports = router;