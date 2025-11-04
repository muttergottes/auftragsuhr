const express = require('express');
const router = express.Router();

console.log('WORK SESSIONS ROUTER MODULE LOADED');

// Simple test route
router.get('/test-debug', (req, res) => {
  console.log('WORK SESSIONS TEST ROUTE HIT');
  res.json({ message: 'workSessions router is working' });
});

const WorkSession = require('../models/WorkSession');
const { authenticateToken, requireAnyRole, requireDispatcherOrAdmin, kioskAuth } = require('../middleware/auth');
const logger = require('../config/logger');
const { body, validationResult } = require('express-validator');

// GET /api/work-sessions/current - Get current session for logged-in user
router.get('/current', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const activeSession = await WorkSession.findActiveByUser(req.user.id);
    res.json(activeSession ? activeSession.toJSON() : null);
  } catch (error) {
    logger.error('Error fetching current work session:', error);
    res.status(500).json({ error: 'Failed to fetch current work session' });
  }
});

// GET /api/work-sessions/history - Get work sessions history
router.get('/history', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      userId,
      workOrderId,
      includeActive = true,
      limit = 50,
      offset = 0,
      allUsers = false
    } = req.query;

    // For workOrderId queries (viewing order details), don't filter by user
    // Users can only see their own history unless they're dispatcher/admin, except when viewing order details
    // If allUsers=true (for admin maintenance view), only admins/dispatchers can see all users
    let targetUserId = null;
    
    if (allUsers === 'true' && req.user.role !== 'employee') {
      // Admin/dispatcher requesting all users - no user filter
      targetUserId = userId || null; // Still allow filtering by specific user if provided
    } else if (!workOrderId) {
      targetUserId = req.user.role === 'employee' ? req.user.id : (userId || req.user.id);
    } else if (userId) {
      // If workOrderId is provided and userId is specified, only admins/dispatchers can filter by specific user
      targetUserId = req.user.role === 'employee' ? null : userId;
    }

    // Direct database query with simplified approach
    const db = require('../config/database');
    
    // Query with category information for proper filtering
    let query = `
      SELECT ws.*, 
             c.name as category_name, 
             c.type as category_type,
             c.color as category_color,
             c.is_productive
      FROM work_sessions ws 
      LEFT JOIN categories c ON ws.category_id = c.id 
      WHERE 1=1
    `;
    const params = [];
    
    if (targetUserId) {
      query += ' AND ws.user_id = ?';
      params.push(targetUserId);
    }
    
    if (workOrderId) {
      query += ' AND ws.work_order_id = ?';
      params.push(workOrderId);
    }
    
    if (startDate) {
      query += ' AND DATE(ws.start_time) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(ws.start_time) <= ?';
      params.push(endDate);
    }
    
    if (includeActive !== 'true') {
      query += ' AND ws.end_time IS NOT NULL';
    }
    
    query += ' ORDER BY ws.start_time DESC';
    
    if (limit) {
      query += ` LIMIT ${parseInt(limit)}`;
    }
    
    if (offset && parseInt(offset) > 0) {
      query += ` OFFSET ${parseInt(offset)}`;
    }

    console.log('Work-sessions query:', query, 'params:', params);
    
    const sessions = await db.query(query, params);
    
    // If we have sessions, get user names for display
    if (sessions && sessions.length > 0) {
      const userIds = [...new Set(sessions.map(s => s.user_id))];
      const userQuery = `SELECT id, first_name, last_name, employee_number FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`;
      const users = await db.query(userQuery, userIds);
      const userMap = users.reduce((map, user) => {
        map[user.id] = user;
        return map;
      }, {});
      
      // Add user info to sessions
      sessions.forEach(session => {
        const user = userMap[session.user_id];
        if (user) {
          session.first_name = user.first_name;
          session.last_name = user.last_name;
          session.employee_number = user.employee_number;
        }
      });
    }
    
    res.json(sessions || []);
  } catch (error) {
    console.error('Error fetching work sessions history:', error);
    logger.error('Error fetching work sessions history:', error);
    res.status(500).json({ error: 'Failed to fetch work sessions history' });
  }
});

// GET /api/work-sessions/active - Get active work sessions (public access for terminals)
router.get('/active', async (req, res) => {
  try {
    const activeSessions = await WorkSession.getAllActive();
    res.json(activeSessions.map(s => s.toJSON()));
  } catch (error) {
    logger.error('Error fetching active work sessions:', error);
    res.status(500).json({ error: 'Failed to fetch active work sessions' });
  }
});

// POST /api/work-sessions/start - Start work session
router.post('/start', [
  body('workOrderId').isInt({ min: 1 }),
  body('taskDescription').optional().isString().trim(),
  body('hourlyRate').optional().isFloat({ min: 0 })
], authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { workOrderId, categoryId, taskDescription, hourlyRate, note } = req.body;

    const session = await WorkSession.startSession(req.user.id, {
      workOrderId,
      categoryId,
      taskDescription,
      hourlyRate,
      note,
      method: 'web'
    });

    res.status(201).json(session.toJSON());
  } catch (error) {
    logger.error('Error starting work session:', error);
    
    if (error.message === 'User already has an active work session') {
      return res.status(409).json({ error: 'Bereits eine aktive Arbeitssitzung' });
    }
    
    if (error.message === 'Work order not found') {
      return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    }
    
    if (error.message === 'Work order is not active') {
      return res.status(400).json({ error: 'Auftrag ist nicht aktiv' });
    }
    
    res.status(500).json({ error: 'Failed to start work session' });
  }
});

// POST /api/work-sessions/stop - Stop work session
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

    const session = await WorkSession.endSession(req.user.id, {
      note,
      method: 'web'
    });

    res.json(session.toJSON());
  } catch (error) {
    logger.error('Error stopping work session:', error);
    
    if (error.message === 'User has no active work session') {
      return res.status(409).json({ error: 'Keine aktive Arbeitssitzung' });
    }
    
    res.status(500).json({ error: 'Failed to stop work session' });
  }
});

// POST /api/work-sessions/kiosk/start - Kiosk start work session or activity
router.post('/kiosk/start', (req, res, next) => {
  console.log('=== WORK SESSIONS KIOSK START ROUTE REACHED ===');
  console.log('Request body:', req.body);
  console.log('Headers:', req.headers);
  next();
}, kioskAuth, async (req, res) => {
  console.log('KIOSK START ROUTE REACHED WITH USER:', req.user);
  try {
    const errors = validationResult(req);
    console.log('VALIDATION ERRORS:', errors.array());
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { workOrderId, categoryId, taskDescription, note } = req.body;

    // Either workOrderId or categoryId is required, but not both
    if (!workOrderId && !categoryId) {
      return res.status(400).json({ 
        success: false,
        error: 'Entweder Auftrag oder Aktivität muss ausgewählt werden' 
      });
    }

    if (workOrderId && categoryId) {
      return res.status(400).json({ 
        success: false,
        error: 'Auftrag und Aktivität können nicht gleichzeitig ausgewählt werden' 
      });
    }

    console.log('STARTING SESSION WITH:', { workOrderId, categoryId, taskDescription, userId: req.user.id });
    const session = await WorkSession.startSession(req.user.id, {
      workOrderId,
      categoryId,
      taskDescription,
      note,
      method: 'kiosk'
    });
    console.log('SESSION STARTED:', session);

    const message = workOrderId 
      ? `Auftrag gestartet: ${session.order_number}`
      : `Aktivität gestartet: ${session.category_name}`;

    res.status(201).json({
      success: true,
      message,
      session: session.toJSON()
    });
  } catch (error) {
    console.error('KIOSK START ERROR:', error);
    logger.error('Error in kiosk work session start:', error);
    
    if (error.message === 'User already has an active work session') {
      return res.status(409).json({ 
        success: false,
        error: `${req.user.first_name}, Sie arbeiten bereits an einem Auftrag oder einer Aktivität.` 
      });
    }
    
    if (error.message === 'User must be clocked in to start work session') {
      return res.status(400).json({ 
        success: false,
        error: `${req.user.first_name}, Sie müssen zuerst einstempeln.` 
      });
    }
    
    if (error.message === 'User cannot start work session while on break') {
      return res.status(400).json({ 
        success: false,
        error: `${req.user.first_name}, Sie müssen zuerst die Pause beenden.` 
      });
    }

    if (error.message === 'Invalid activity category') {
      return res.status(400).json({ 
        success: false,
        error: 'Ungültige Aktivitätskategorie' 
      });
    }

    if (error.message === 'Category is required for activity sessions') {
      return res.status(400).json({ 
        success: false,
        error: 'Kategorie ist erforderlich für Aktivitäten' 
      });
    }
    
    console.error('UNEXPECTED ERROR IN KIOSK START:', error);
    console.error('ERROR MESSAGE:', error.message);
    console.error('ERROR STACK:', error.stack);
    res.status(500).json({ 
      success: false,
      error: 'Fehler beim Starten der Arbeitssitzung' 
    });
  }
});

// POST /api/work-sessions/kiosk/stop - Kiosk stop work session
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

    const session = await WorkSession.endSession(req.user.id, {
      note,
      method: 'kiosk'
    });

    const duration = Math.round(session.duration_minutes);
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;

    const message = session.work_order_id 
      ? `Auftrag beendet: ${session.order_number} (${hours}h ${minutes}min)`
      : `Aktivität beendet: ${session.category_name} (${hours}h ${minutes}min)`;

    res.json({
      success: true,
      message,
      session: session.toJSON()
    });
  } catch (error) {
    logger.error('Error in kiosk work session stop:', error);
    
    if (error.message === 'User has no active work session') {
      return res.status(409).json({ 
        success: false,
        error: `${req.user.first_name}, Sie arbeiten an keinem Auftrag.` 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Fehler beim Beenden der Arbeitssitzung' 
    });
  }
});

// POST /api/work-sessions/kiosk/current - Get current session for kiosk user
router.post('/kiosk/current', kioskAuth, async (req, res) => {
  try {
    const activeSession = await WorkSession.findActiveByUser(req.user.id);
    res.json({
      success: true,
      data: activeSession ? activeSession.toJSON() : null
    });
  } catch (error) {
    logger.error('Error fetching kiosk current session:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch current session' 
    });
  }
});

// POST /api/work-sessions/kiosk/today - Get today's work sessions for kiosk user
router.post('/kiosk/today', kioskAuth, async (req, res) => {
  try {
    console.log('=== KIOSK TODAY SESSIONS REQUEST ===');
    console.log('User ID:', req.user.id);
    const today = new Date().toISOString().split('T')[0];
    console.log('Today date:', today);
    
    // Use direct database query for kiosk today sessions
    const query = `
      SELECT ws.*, 
             c.name as category_name, 
             c.type as category_type,
             c.color as category_color,
             wo.order_number,
             wo.description as order_description
      FROM work_sessions ws 
      LEFT JOIN categories c ON ws.category_id = c.id 
      LEFT JOIN work_orders wo ON ws.work_order_id = wo.id
      WHERE ws.user_id = ? AND DATE(ws.start_time) = ?
      ORDER BY ws.start_time DESC
    `;
    
    const db = require('../config/database');
    const sessions = await db.query(query, [req.user.id, today]);

    console.log('Sessions found:', sessions.length);
    console.log('Sessions data:', sessions.map(s => ({ id: s.id, start_time: s.start_time })));

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('=== KIOSK TODAY SESSIONS ERROR ===');
    console.error('Error details:', error);
    console.error('Stack:', error.stack);
    logger.error('Error fetching kiosk today work sessions:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch today work sessions',
      details: error.message
    });
  }
});

// POST /api/work-sessions/kiosk/start-order - Start work session with order (employee number only)
router.post('/kiosk/start-order', async (req, res) => {
  try {
    const { employeeNumber, orderNumber } = req.body;
    
    if (!employeeNumber || !orderNumber) {
      return res.status(400).json({ 
        error: 'Personalnummer und Auftragsnummer erforderlich' 
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

    // Find work order by order number
    const orderResults = await db.query(
      'SELECT * FROM work_orders WHERE order_number = ?',
      [orderNumber]
    );
    const orders = Array.isArray(orderResults) ? orderResults : (orderResults[0] || []);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Auftragsnummer nicht gefunden' });
    }

    const order = orders[0];

    // Start work session
    const session = await WorkSession.startSession(user.id, {
      workOrderId: order.id,
      method: 'kiosk'
    });

    res.status(201).json({
      success: true,
      message: `Auftrag gestartet: ${orderNumber}`,
      session: session.toJSON()
    });
  } catch (error) {
    logger.error('Error in kiosk start order:', error);
    
    if (error.message === 'User already has an active work session') {
      return res.status(409).json({ 
        error: 'Sie arbeiten bereits an einem Auftrag oder einer Aktivität.' 
      });
    }
    
    if (error.message === 'User must be clocked in to start work session') {
      return res.status(400).json({ 
        error: 'Sie müssen zuerst einstempeln.' 
      });
    }
    
    res.status(500).json({ error: 'Fehler beim Starten des Auftrags' });
  }
});

// POST /api/work-sessions/kiosk/start-category - Start work session with category (employee number only)
router.post('/kiosk/start-category', async (req, res) => {
  try {
    console.log('=== START CATEGORY DEBUG ===');
    console.log('Request body:', req.body);
    const { employeeNumber, categoryId } = req.body;
    
    if (!employeeNumber || !categoryId) {
      console.log('Missing params:', { employeeNumber, categoryId });
      return res.status(400).json({ 
        error: 'Personalnummer und Aktivität erforderlich' 
      });
    }

    // Find user by employee number
    console.log('Looking for user:', employeeNumber);
    const db = require('../config/database');
    const results = await db.query(
      'SELECT * FROM users WHERE employee_number = ? AND is_active = 1',
      [employeeNumber]
    );
    const users = Array.isArray(results) ? results : (results[0] || []);
    console.log('Database results:', results);
    console.log('Found users:', users.length);

    if (users.length === 0) {
      console.log('No user found with employee number:', employeeNumber);
      return res.status(401).json({ error: 'Personalnummer nicht gefunden' });
    }

    const user = users[0];
    console.log('User found:', user.id, user.first_name, user.last_name);

    // Start work session
    console.log('Starting session with:', { userId: user.id, categoryId: parseInt(categoryId) });
    const session = await WorkSession.startSession(user.id, {
      categoryId: parseInt(categoryId),
      method: 'kiosk'
    });
    console.log('Session started successfully:', session.id);

    res.status(201).json({
      success: true,
      message: `Aktivität gestartet: ${session.category_name}`,
      session: session.toJSON()
    });
  } catch (error) {
    console.error('=== ERROR IN START CATEGORY ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    logger.error('Error in kiosk start category:', error);
    
    if (error.message === 'User already has an active work session') {
      return res.status(409).json({ 
        error: 'Sie arbeiten bereits an einem Auftrag oder einer Aktivität.' 
      });
    }
    
    if (error.message === 'User must be clocked in to start work session') {
      return res.status(400).json({ 
        error: 'Sie müssen zuerst einstempeln.' 
      });
    }
    
    res.status(500).json({ error: 'Fehler beim Starten der Aktivität' });
  }
});

// POST /api/work-sessions/kiosk/stop-simple - Stop work session (employee number only)
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

    // Stop work session
    const session = await WorkSession.endSession(user.id, {
      method: 'kiosk'
    });

    const duration = Math.round(session.duration_minutes);
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;

    const message = session.work_order_id 
      ? `Auftrag beendet: ${session.order_number} (${hours}h ${minutes}min)`
      : `Aktivität beendet: ${session.category_name} (${hours}h ${minutes}min)`;

    res.json({
      success: true,
      message,
      session: session.toJSON()
    });
  } catch (error) {
    logger.error('Error in kiosk stop simple:', error);
    
    if (error.message === 'User has no active work session') {
      return res.status(409).json({ 
        error: 'Sie arbeiten an keinem Auftrag.' 
      });
    }
    
    res.status(500).json({ error: 'Fehler beim Beenden der Arbeit' });
  }
});

// PUT /api/work-sessions/:id - Update work session (admin/dispatcher only)
router.put('/:id', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const updateData = req.body;
    
    console.log('=== WORK SESSION UPDATE ===');
    console.log('Session ID:', sessionId);
    console.log('Update Data:', updateData);
    console.log('User:', req.user.id, req.user.role);

    const updatedSession = await WorkSession.update(sessionId, updateData);
    
    console.log('Updated session:', updatedSession ? 'SUCCESS' : 'FAILED');

    res.json(updatedSession.toJSON());
  } catch (error) {
    console.error('Error updating work session:', error);
    logger.error('Error updating work session:', error);
    res.status(500).json({ error: 'Failed to update work session', details: error.message });
  }
});

// DELETE /api/work-sessions/:id - Delete work session (admin only)
router.delete('/:id', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    await WorkSession.delete(req.params.id);
    res.json({ message: 'Work session deleted successfully' });
  } catch (error) {
    logger.error('Error deleting work session:', error);
    res.status(500).json({ error: 'Failed to delete work session' });
  }
});

// GET /api/work-sessions/summary/daily/:userId/:date - Daily summary
router.get('/summary/daily/:userId/:date', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const { userId, date } = req.params;
    const summary = await WorkSession.getDailySummary(userId, date);
    res.json(summary);
  } catch (error) {
    logger.error('Error fetching daily work session summary:', error);
    res.status(500).json({ error: 'Failed to fetch daily summary' });
  }
});

// GET /api/work-sessions/summary/order/:orderId - Order summary
router.get('/summary/order/:orderId', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { orderId } = req.params;
    const summary = await WorkSession.getOrderSummary(orderId);
    res.json(summary);
  } catch (error) {
    logger.error('Error fetching order work session summary:', error);
    res.status(500).json({ error: 'Failed to fetch order summary' });
  }
});

// GET /api/work-sessions/stats - General statistics
router.get('/stats', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { 
      period = 'day', // day, week, month, year
      startDate,
      endDate,
      userId
    } = req.query;

    console.log('Work sessions stats request:', { period, startDate, endDate, userId });

    // Users can only see their own stats unless they're dispatcher/admin
    const targetUserId = req.user.role === 'employee' ? req.user.id : userId;

    const stats = await WorkSession.getStatistics({
      period,
      startDate,
      endDate,
      userId: targetUserId
    });

    console.log('Work sessions stats result:', stats);
    res.json(stats);
  } catch (error) {
    console.error('Error in work sessions stats:', error);
    logger.error('Error fetching work session statistics:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch statistics' });
  }
});

// GET /api/work-sessions/user-stats/:userId - User specific statistics
router.get('/user-stats/:userId', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { userId } = req.params;
    const { 
      period = 'day',
      startDate,
      endDate 
    } = req.query;

    // Users can only see their own stats unless they're dispatcher/admin
    if (req.user.role === 'employee' && parseInt(userId) !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = await WorkSession.getUserStatistics(userId, {
      period,
      startDate,
      endDate
    });

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching user work session statistics:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});


module.exports = router;