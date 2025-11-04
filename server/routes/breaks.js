const express = require('express');
const router = express.Router();
const Break = require('../models/Break');
const WorkSession = require('../models/WorkSession');
const { authenticateToken, requireAnyRole, requireDispatcherOrAdmin, kioskAuth } = require('../middleware/auth');
const logger = require('../config/logger');
const { body, validationResult } = require('express-validator');

// GET /api/breaks/current - Get current break for logged-in user
router.get('/current', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const activeBreak = await Break.findActiveByUser(req.user.id);
    res.json(activeBreak ? activeBreak.toJSON() : null);
  } catch (error) {
    logger.error('Error fetching current break:', error);
    res.status(500).json({ error: 'Failed to fetch current break' });
  }
});

// GET /api/breaks/history - Get break history
router.get('/history', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      userId,
      includeActive = true,
      limit = 50,
      offset = 0 
    } = req.query;

    // Users can only see their own history unless they're dispatcher/admin
    const targetUserId = req.user.role === 'employee' ? req.user.id : (userId || req.user.id);

    const breaks = await Break.findAll({
      userId: targetUserId,
      startDate,
      endDate,
      includeActive: includeActive === 'true',
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json(breaks.map(b => b.toJSON()));
  } catch (error) {
    logger.error('Error fetching break history:', error);
    res.status(500).json({ error: 'Failed to fetch break history' });
  }
});

// GET /api/breaks/user/:userId - Get breaks for specific user (admin/dispatcher only)
router.get('/user/:userId', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const { startDate, endDate, limit = 50, offset = 0 } = req.query;

    const breaks = await Break.findAll({
      userId: req.params.userId,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json(breaks.map(b => b.toJSON()));
  } catch (error) {
    logger.error('Error fetching user breaks:', error);
    res.status(500).json({ error: 'Failed to fetch user breaks' });
  }
});

// POST /api/breaks/start - Start break
router.post('/start', [
  body('categoryId').isInt({ min: 1 }),
  body('note').optional().isString().trim()
], authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { categoryId, note, attendanceRecordId } = req.body;

    const breakRecord = await Break.startBreak(req.user.id, {
      categoryId,
      attendanceRecordId,
      note,
      method: 'web'
    });

    res.status(201).json(breakRecord.toJSON());
  } catch (error) {
    logger.error('Error starting break:', error);
    
    if (error.message === 'User already has an active break') {
      return res.status(409).json({ error: 'Bereits eine aktive Pause' });
    }
    
    if (error.message === 'Invalid break category') {
      return res.status(400).json({ error: 'Ungültige Pause-Kategorie' });
    }
    
    res.status(500).json({ error: 'Failed to start break' });
  }
});

// POST /api/breaks/stop - Stop break
router.post('/stop', [
  body('note').optional().isString().trim()
], authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { note } = req.body;

    const breakRecord = await Break.endBreak(req.user.id, {
      note,
      method: 'web'
    });

    res.json(breakRecord.toJSON());
  } catch (error) {
    logger.error('Error stopping break:', error);
    
    if (error.message === 'User has no active break') {
      return res.status(409).json({ error: 'Keine aktive Pause' });
    }
    
    res.status(500).json({ error: 'Failed to stop break' });
  }
});

// POST /api/breaks/kiosk/start - Kiosk start break
router.post('/kiosk/start', [
  body('categoryId').isInt({ min: 1 }),
  body('note').optional().isString().trim()
], kioskAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { categoryId, note, attendanceRecordId } = req.body;

    // Check if user has active work sessions
    const activeWorkSession = await WorkSession.findActiveByUser(req.user.id);
    if (activeWorkSession) {
      return res.status(409).json({ 
        success: false,
        error: `${req.user.first_name}, Sie müssen zuerst Ihre aktive Arbeit beenden (${activeWorkSession.order_number || activeWorkSession.category_name}).` 
      });
    }

    const breakRecord = await Break.startBreak(req.user.id, {
      categoryId,
      attendanceRecordId,
      note,
      method: 'kiosk'
    });

    res.status(201).json({
      success: true,
      message: `Pause gestartet: ${breakRecord.category_name}`,
      break: breakRecord.toJSON()
    });
  } catch (error) {
    logger.error('Error in kiosk break start:', error);
    
    if (error.message === 'User already has an active break') {
      return res.status(409).json({ 
        success: false,
        error: `${req.user.first_name}, Sie haben bereits eine aktive Pause.` 
      });
    }
    
    if (error.message === 'User must be clocked in to start a break') {
      return res.status(400).json({ 
        success: false,
        error: `${req.user.first_name}, Sie müssen zuerst einstempeln, um eine Pause zu starten.` 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Fehler beim Starten der Pause' 
    });
  }
});

// POST /api/breaks/kiosk/stop - Kiosk stop break
router.post('/kiosk/stop', [
  body('note').optional().isString().trim()
], kioskAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { note } = req.body;

    const breakRecord = await Break.endBreak(req.user.id, {
      note,
      method: 'kiosk'
    });

    const duration = breakRecord.duration_minutes;
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;

    res.json({
      success: true,
      message: `Pause beendet: ${breakRecord.category_name} (${hours}h ${minutes}min)`,
      break: breakRecord.toJSON()
    });
  } catch (error) {
    logger.error('Error in kiosk break stop:', error);
    
    if (error.message === 'User has no active break') {
      return res.status(409).json({ 
        success: false,
        error: `${req.user.first_name}, Sie haben keine aktive Pause.` 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Fehler beim Beenden der Pause' 
    });
  }
});

// POST /api/breaks/kiosk/start-simple - Start break (employee number only)
router.post('/kiosk/start-simple', async (req, res) => {
  try {
    const { employeeNumber, categoryId = 8 } = req.body; // Default to standard break category
    
    if (!employeeNumber) {
      return res.status(400).json({ 
        error: 'Personalnummer erforderlich' 
      });
    }

    // Find user by employee number
    const db = require('../config/database');
    const userResults = await db.query(
      'SELECT * FROM users WHERE employee_number = ? AND is_active = 1',
      [employeeNumber]
    );
    const users = Array.isArray(userResults) ? userResults : (userResults[0] || []);

    if (users.length === 0) {
      return res.status(401).json({ error: 'Personalnummer nicht gefunden' });
    }

    const user = users[0];

    // Check if user is present (clocked in)
    const Attendance = require('../models/Attendance');
    const currentAttendance = await Attendance.findActiveByUser(user.id);
    if (!currentAttendance) {
      return res.status(409).json({ 
        error: 'Sie müssen zuerst eingestempelt sein, um eine Pause zu starten.' 
      });
    }

    // Check if user has active work sessions
    const activeWorkSession = await WorkSession.findActiveByUser(user.id);
    if (activeWorkSession) {
      return res.status(409).json({ 
        error: `Sie müssen zuerst Ihre aktive Arbeit beenden (${activeWorkSession.order_number || activeWorkSession.category_name}).` 
      });
    }

    // Start break
    const breakRecord = await Break.startBreak(user.id, {
      categoryId: parseInt(categoryId),
      method: 'kiosk'
    });

    res.status(201).json({
      success: true,
      message: `Pause gestartet: ${breakRecord.category_name}`,
      break: breakRecord.toJSON()
    });
  } catch (error) {
    logger.error('Error in kiosk start break simple:', error);
    
    if (error.message === 'User already has an active break') {
      return res.status(409).json({ 
        error: 'Sie haben bereits eine aktive Pause.' 
      });
    }
    
    res.status(500).json({ error: 'Fehler beim Starten der Pause' });
  }
});

// POST /api/breaks/kiosk/stop-simple - Stop break (employee number only)
router.post('/kiosk/stop-simple', async (req, res) => {
  try {
    const { employeeNumber } = req.body;
    
    if (!employeeNumber) {
      return res.status(400).json({ 
        error: 'Personalnummer erforderlich' 
      });
    }

    // Find user by employee number
    const db = require('../config/database');
    const userResults = await db.query(
      'SELECT * FROM users WHERE employee_number = ? AND is_active = 1',
      [employeeNumber]
    );
    const users = Array.isArray(userResults) ? userResults : (userResults[0] || []);

    if (users.length === 0) {
      return res.status(401).json({ error: 'Personalnummer nicht gefunden' });
    }

    const user = users[0];

    // Check if user is present (clocked in)
    const Attendance = require('../models/Attendance');
    const currentAttendance = await Attendance.findActiveByUser(user.id);
    if (!currentAttendance) {
      return res.status(409).json({ 
        error: 'Sie müssen eingestempelt sein, um eine Pause zu beenden.' 
      });
    }

    // Stop break
    const breakRecord = await Break.endBreak(user.id, {
      method: 'kiosk'
    });

    const duration = breakRecord.duration_minutes;
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;

    res.json({
      success: true,
      message: `Pause beendet: ${breakRecord.category_name} (${hours}h ${minutes}min)`,
      break: breakRecord.toJSON()
    });
  } catch (error) {
    logger.error('Error in kiosk stop break simple:', error);
    
    if (error.message === 'User has no active break') {
      return res.status(409).json({ 
        error: 'Sie haben keine aktive Pause.' 
      });
    }
    
    res.status(500).json({ error: 'Fehler beim Beenden der Pause' });
  }
});

// PUT /api/breaks/:id - Update break (admin/dispatcher only)
router.put('/:id', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const breakId = req.params.id;
    const updateData = req.body;

    const updatedBreak = await Break.update(breakId, updateData);

    res.json(updatedBreak.toJSON());
  } catch (error) {
    logger.error('Error updating break:', error);
    res.status(500).json({ error: 'Failed to update break' });
  }
});

// DELETE /api/breaks/:id - Delete break (admin only)
router.delete('/:id', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    await Break.delete(req.params.id);
    res.json({ message: 'Break record deleted successfully' });
  } catch (error) {
    logger.error('Error deleting break:', error);
    res.status(500).json({ error: 'Failed to delete break record' });
  }
});

// GET /api/breaks/summary/daily/:userId/:date - Daily break summary
router.get('/summary/daily/:userId/:date', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const { userId, date } = req.params;
    const summary = await Break.getDailySummary(userId, date);
    res.json(summary);
  } catch (error) {
    logger.error('Error fetching daily break summary:', error);
    res.status(500).json({ error: 'Failed to fetch daily break summary' });
  }
});

// GET /api/breaks/active - Get all currently active breaks (public access for terminals)
router.get('/active', async (req, res) => {
  try {
    // Direct query with duration calculation
    const query = `
      SELECT b.*, u.first_name, u.last_name, u.employee_number, c.name as category_name, c.type as category_type,
             TIMESTAMPDIFF(SECOND, b.start_time, NOW()) / 60.0 as duration_minutes
      FROM break_records b
      JOIN users u ON b.user_id = u.id
      JOIN categories c ON b.category_id = c.id
      WHERE b.end_time IS NULL
      ORDER BY b.start_time ASC
    `;
    
    const db = require('../config/database');
    const activeBreaks = await db.query(query);
    
    res.json(activeBreaks.map(breakRecord => ({
      ...breakRecord,
      duration_minutes: breakRecord.duration_minutes
    })));
  } catch (error) {
    logger.error('Error fetching active breaks:', error);
    res.status(500).json({ error: 'Failed to fetch active breaks' });
  }
});

// POST /api/breaks/kiosk/current - Get current break for kiosk user
router.post('/kiosk/current', kioskAuth, async (req, res) => {
  try {
    const activeBreak = await Break.findActiveByUser(req.user.id);
    res.json({
      success: true,
      data: activeBreak ? activeBreak.toJSON() : null
    });
  } catch (error) {
    logger.error('Error fetching kiosk current break:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch current break' 
    });
  }
});

// POST /api/breaks/kiosk/today - Get today's breaks for kiosk user
router.post('/kiosk/today', kioskAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Simplified query for today's breaks
    const query = `
      SELECT b.*, c.name as category_name 
      FROM break_records b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND DATE(b.start_time) = ?
      ORDER BY b.start_time DESC
    `;
    
    const db = require('../config/database');
    const breaks = await db.query(query, [req.user.id, today]);

    res.json({
      success: true,
      data: breaks || []
    });
  } catch (error) {
    logger.error('Error fetching kiosk today breaks:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch today breaks' 
    });
  }
});

module.exports = router;