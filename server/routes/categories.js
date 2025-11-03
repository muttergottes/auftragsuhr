const express = require('express');
const Category = require('../models/Category');
const { authenticateToken, requireAnyRole, requireDispatcherOrAdmin, kioskAuth } = require('../middleware/auth');
const router = express.Router();

// POST /api/categories/kiosk/all - Kiosk get all active categories
router.post('/kiosk/all', kioskAuth, async (req, res) => {
  try {
    // Get all active categories for kiosk usage
    const categories = await Category.findAll({ active: 1 });
    
    // Separate work and break categories - only work and break types allowed
    const workCategories = categories.filter(cat => 
      cat.type === 'work' && cat.is_productive === 1
    );
    const breakCategories = categories.filter(cat => 
      cat.type === 'break' && cat.is_productive === 0
    );
    
    res.json({ 
      data: {
        workCategories,
        breakCategories,
        allCategories: categories
      },
      message: 'Kategorien erfolgreich geladen'
    });
  } catch (error) {
    console.error('Error fetching kiosk categories:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { type, active } = req.query;
    const categories = await Category.findAll({ type, active });
    res.json({ data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Kategorien' });
  }
});

router.get('/:id', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }
    res.json({ data: category });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Kategorie' });
  }
});

router.post('/', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const { name, type = 'other', color = '#6c757d', is_active = 1, is_productive = 1, auto_break = 0, max_duration_minutes = null } = req.body;
    
    // Direct database query to avoid model issues
    const db = require('../config/database');
    const result = await db.query(
      `INSERT INTO categories (name, type, color, is_active, is_productive, auto_break, max_duration_minutes) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, type, color, is_active, is_productive, auto_break, max_duration_minutes]
    );
    
    res.status(201).json({ 
      message: 'Kategorie erfolgreich erstellt',
      categoryId: result.insertId 
    });
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Kategorie mit diesem Namen existiert bereits' });
    }
    res.status(500).json({ error: 'Fehler beim Erstellen der Kategorie' });
  }
});

router.put('/:id', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const categoryData = req.body;
    console.log('Updating category ID:', req.params.id, 'with data:', categoryData);
    
    const success = await Category.update(req.params.id, categoryData);
    if (!success) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }
    res.json({ message: 'Kategorie erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Kategorie' });
  }
});

router.delete('/:id', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const success = await Category.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Kategorie nicht gefunden' });
    }
    res.json({ message: 'Kategorie erfolgreich gelöscht' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Kategorie' });
  }
});

// GET /api/categories/free-work - Get free work categories for kiosk (no auth required)
router.get('/free-work', async (req, res) => {
  try {
    const categories = await Category.findAll({ 
      type: 'work', 
      active: 1,
      is_productive: 1 
    });
    
    res.json({ 
      data: categories,
      message: 'Freie Arbeitskategorien erfolgreich geladen'
    });
  } catch (error) {
    console.error('Error fetching free work categories:', error);
    res.status(500).json({ error: 'Fehler beim Laden der freien Arbeitskategorien' });
  }
});

module.exports = router;