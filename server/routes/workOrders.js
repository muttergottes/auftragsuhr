const express = require('express');
const router = express.Router();
const WorkOrder = require('../models/WorkOrder');
const { authenticateToken, requireAnyRole, requireDispatcherOrAdmin, kioskAuth } = require('../middleware/auth');
const logger = require('../config/logger');
const { body, validationResult } = require('express-validator');

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log(`=== WORK ORDERS ROUTER: ${req.method} ${req.path} ===`);
  console.log('Headers:', req.headers.authorization ? 'Bearer token present' : 'No token');
  next();
});

// GET /api/work-orders - Get work orders (TEST)
router.get('/test', (req, res) => {
  res.json({ message: 'Work orders route test successful!' });
});

// DELETE test route
router.delete('/test-delete/:id', (req, res) => {
  console.log('=== DELETE TEST ROUTE HIT ===');
  console.log('ID:', req.params.id);
  res.json({ success: true, message: 'Delete test route working', id: req.params.id });
});

// Simple DELETE test without params
router.delete('/simple-test', (req, res) => {
  console.log('=== SIMPLE DELETE TEST ROUTE HIT ===');
  res.json({ success: true, message: 'Simple delete test working' });
});

// Test route without kioskAuth
router.post('/test-create', async (req, res) => {
  try {
    console.log('TEST CREATE ROUTE REACHED:', req.body);
    res.json({ success: true, message: 'Test route works' });
  } catch (error) {
    console.error('Test route error:', error);
    res.status(500).json({ error: 'Test failed' });
  }
});

// POST /api/work-orders/kiosk/search - Search work orders by order number
router.post('/kiosk/search', kioskAuth, async (req, res) => {
  try {
    const { searchTerm } = req.body;
    
    if (!searchTerm || searchTerm.length < 1) {
      return res.json({ success: true, data: [] });
    }

    const db = require('../config/database');
    const searchResults = await db.query(`
      SELECT 
        id, order_number, description, priority, status
      FROM work_orders
      WHERE order_number LIKE ? 
        AND status IN ('created', 'in_progress')
      ORDER BY 
        CASE 
          WHEN order_number = ? THEN 1
          WHEN order_number LIKE ? THEN 2
          ELSE 3
        END,
        order_number
      LIMIT 10
    `, [`${searchTerm}%`, searchTerm, `${searchTerm}%`]);

    res.json({
      success: true,
      data: searchResults
    });
  } catch (error) {
    logger.error('Error searching work orders:', error);
    res.status(500).json({ error: 'Fehler beim Suchen der Aufträge' });
  }
});

// POST /api/work-orders/kiosk/create-or-find - Create work order if not exists
router.post('/kiosk/create-or-find', kioskAuth, async (req, res) => {
  try {
    console.log('CREATE-OR-FIND ROUTE REACHED WITH:', req.body);
    const { orderNumber } = req.body;
    
    if (!orderNumber || !orderNumber.trim()) {
      console.log('MISSING ORDER NUMBER');
      return res.status(400).json({ error: 'Auftragsnummer ist erforderlich' });
    }

    console.log('TRYING TO GET DB CONNECTION...');
    const db = require('../config/database');
    
    // First, try to find existing work order
    const existingOrders = await db.query(`
      SELECT id, order_number, description, status, priority
      FROM work_orders
      WHERE order_number = ? AND status NOT IN ('completed', 'cancelled')
      LIMIT 1
    `, [orderNumber.trim()]);

    if (existingOrders.length > 0) {
      return res.json({
        success: true,
        data: existingOrders[0],
        created: false
      });
    }

    // If not found, create new work order
    const result = await db.query(`
      INSERT INTO work_orders (order_number, description, status, priority)
      VALUES (?, ?, 'created', 'normal')
    `, [orderNumber.trim(), `Auftrag ${orderNumber.trim()}`]);

    const newOrder = {
      id: result.insertId,
      order_number: orderNumber.trim(),
      description: `Auftrag ${orderNumber.trim()}`,
      status: 'created',
      priority: 'normal'
    };

    res.json({
      success: true,
      data: newOrder,
      created: true
    });
  } catch (error) {
    console.error('DETAILED ERROR in create-or-find:', error);
    logger.error('Error creating/finding work order:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Auftrags', details: error.message });
  }
});

// GET /api/work-orders - Get work orders
router.get('/', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    console.log('=== WORK ORDERS ROUTE ACCESSED ===');
    console.log('User:', req.user);
    logger.info('Work orders route accessed by user:', req.user.id);
    
    // Direct database query to avoid model issues
    const db = require('../config/database');
    let query = `
      SELECT 
        wo.id, wo.order_number, wo.description, wo.status, wo.priority,
        wo.estimated_hours, wo.estimated_cost, wo.mileage, wo.created_at, wo.updated_at,
        wo.customer_id, wo.vehicle_id, wo.assigned_to, wo.created_by,
        woc.name as category_name, woc.color as category_color,
        CONCAT(u.first_name, ' ', u.last_name) as assigned_to_name,
        u.role as assigned_to_role,
        COALESCE(SUM(ws.duration_minutes), 0) as total_worked_minutes
      FROM work_orders wo
      LEFT JOIN work_order_categories woc ON wo.category_id = woc.id
      LEFT JOIN users u ON wo.assigned_to = u.id
      LEFT JOIN work_sessions ws ON wo.id = ws.work_order_id AND ws.end_time IS NOT NULL
      WHERE 1=1
    `;
    const params = [];

    if (req.query.status && req.query.status !== 'all') {
      query += ' AND wo.status = ?';
      params.push(req.query.status);
    }

    if (req.query.assigned_to) {
      query += ' AND wo.assigned_to = ?';
      params.push(req.query.assigned_to);
    }

    if (req.query.priority && req.query.priority !== 'all') {
      query += ' AND wo.priority = ?';
      params.push(req.query.priority);
    }

    query += ' GROUP BY wo.id ORDER BY wo.created_at DESC';
    
    if (req.query.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(req.query.limit) || 50);
    }

    console.log('Executing query:', query);
    console.log('With params:', params);
    const orders = await db.query(query, params);
    console.log('Orders result:', orders);
    
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    logger.error('Error fetching work orders:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch work orders' 
    });
  }
});

// GET /api/work-orders/assignable-users - Get users that can be assigned to work orders
router.get('/assignable-users', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const db = require('../config/database');
    const users = await db.query(`
      SELECT 
        id, first_name, last_name, role, employee_number
      FROM users 
      WHERE is_active = 1 AND role IN ('employee', 'dispatcher')
      ORDER BY first_name, last_name
    `);
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    logger.error('Error fetching assignable users:', error);
    res.status(500).json({ error: 'Failed to fetch assignable users' });
  }
});

// GET /api/work-orders/active - Get active work orders
router.get('/active', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    // Direct database query to avoid model issues
    const db = require('../config/database');
    const activeOrders = await db.query(`
      SELECT 
        wo.id, wo.order_number, wo.description, wo.status, wo.priority,
        wo.estimated_hours, wo.customer_name, wo.created_at,
        woc.name as category_name, woc.color as category_color
      FROM work_orders wo
      LEFT JOIN work_order_categories woc ON wo.category_id = woc.id
      WHERE wo.status IN ('created', 'in_progress')
      ORDER BY wo.priority DESC, wo.created_at DESC
    `);
    
    res.json({
      success: true,
      data: activeOrders
    });
  } catch (error) {
    logger.error('Error fetching active work orders:', error);
    res.status(500).json({ error: 'Failed to fetch active work orders' });
  }
});

// GET /api/work-orders/:id - Get specific work order
router.get('/:id', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const order = await WorkOrder.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    // Employees can only see their assigned orders
    if (req.user.role === 'employee' && order.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(order.toJSON());
  } catch (error) {
    logger.error('Error fetching work order:', error);
    res.status(500).json({ error: 'Failed to fetch work order' });
  }
});

// POST /api/work-orders - Create new work order (admin/dispatcher only)
router.post('/', [
  body('order_number').notEmpty().withMessage('Order number is required'),
  body('description').optional().isString(),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
  body('estimated_hours').optional().isFloat({ min: 0 }),
  body('estimated_cost').optional({ nullable: true }).isFloat({ min: 0 })
], authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    console.log('=== CREATE WORK ORDER ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user.email, req.user.role);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    // Direct database query to avoid model issues
    const db = require('../config/database');
    const {
      order_number,
      description = '',
      status = 'created',
      priority = 'normal',
      category_id = null,
      estimated_hours = null,
      estimated_cost = null,
      customer_id = null,
      vehicle_id = null,
      mileage = null,
      assigned_to = null
    } = req.body;

    const result = await db.query(`
      INSERT INTO work_orders (
        order_number, description, status, priority, category_id,
        estimated_hours, estimated_cost, customer_id, vehicle_id,
        mileage, assigned_to, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      order_number, description, status, priority, category_id,
      estimated_hours, estimated_cost, customer_id, vehicle_id,
      mileage, assigned_to, req.user.id
    ]);

    // Get the created order
    const order = await db.query(
      'SELECT * FROM work_orders WHERE id = ?', 
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: order[0],
      message: 'Work order created successfully'
    });
  } catch (error) {
    logger.error('Error creating work order:', error);
    
    if (error.message.includes('Duplicate entry')) {
      return res.status(409).json({ 
        success: false, 
        error: 'Order number already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create work order' 
    });
  }
});

// PUT /api/work-orders/:id - Update work order
router.put('/:id', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const {
      order_number,
      description,
      status,
      priority,
      category_id,
      estimated_hours,
      estimated_cost,
      customer_id,
      vehicle_id,
      mileage,
      assigned_to
    } = req.body;

    // Direct database query to avoid model issues  
    // Convert undefined values to null to prevent SQL errors
    const db = require('../config/database');
    const result = await db.query(`
      UPDATE work_orders 
      SET order_number = ?, description = ?, status = ?, priority = ?,
          category_id = ?, estimated_hours = ?, estimated_cost = ?,
          customer_id = ?, vehicle_id = ?, mileage = ?, assigned_to = ?,
          updated_at = NOW()
      WHERE id = ?
    `, [
      order_number, 
      description, 
      status, 
      priority,
      category_id || null, 
      estimated_hours || null, 
      estimated_cost || null,
      customer_id || null, 
      vehicle_id || null, 
      mileage || null, 
      assigned_to || null, 
      orderId
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Work order not found' 
      });
    }

    // Get the updated order
    const updated = await db.query(
      'SELECT * FROM work_orders WHERE id = ?',
      [orderId]
    );

    res.json({
      success: true,
      data: updated[0],
      message: 'Work order updated successfully'
    });
  } catch (error) {
    logger.error('Error updating work order:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update work order' 
    });
  }
});

// DELETE /api/work-orders/:id - Delete work order (admin only)
router.delete('/:id', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    console.log('=== DELETE WORK ORDER ===');
    console.log('ID:', req.params.id);
    console.log('User:', req.user.email, req.user.role);
    
    // Direct database query to avoid model issues
    const db = require('../config/database');
    
    // First check if work order exists
    const existingOrder = await db.query(
      'SELECT id, order_number FROM work_orders WHERE id = ?',
      [req.params.id]
    );
    
    if (existingOrder.length === 0) {
      console.log('Work order not found');
      return res.status(404).json({
        success: false,
        error: 'Work order not found'
      });
    }
    
    console.log('Found work order:', existingOrder[0]);
    
    // Check for related work sessions (this might prevent deletion)
    const workSessions = await db.query(
      'SELECT COUNT(*) as count FROM work_sessions WHERE work_order_id = ?',
      [req.params.id]
    );
    
    console.log('Work sessions count:', workSessions[0].count);
    
    console.log('Executing DELETE query...');
    const result = await db.query(
      'DELETE FROM work_orders WHERE id = ?',
      [req.params.id]
    );
    console.log('DELETE result:', result);

    if (result.affectedRows === 0) {
      console.log('No rows affected - deletion failed');
      return res.status(500).json({
        success: false,
        error: 'Work order deletion failed - no rows affected'
      });
    }

    console.log('Work order deleted successfully');
    res.json({
      success: true,
      message: 'Work order deleted successfully'
    });
  } catch (error) {
    console.error('DELETE ERROR:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    logger.error('Error deleting work order:', error);
    
    // Return more specific error messages
    let errorMessage = 'Failed to delete work order';
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      errorMessage = 'Cannot delete work order: it has associated work sessions or other dependencies';
    } else if (error.sqlMessage) {
      errorMessage = `Database error: ${error.sqlMessage}`;
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage
    });
  }
});

// GET /api/work-orders/summary/stats - Get summary statistics
router.get('/summary/stats', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await WorkOrder.getSummary({ startDate, endDate });
    res.json(summary);
  } catch (error) {
    logger.error('Error fetching work orders summary:', error);
    res.status(500).json({ error: 'Failed to fetch work orders summary' });
  }
});

// POST /api/work-orders/kiosk/available - Get available work orders for kiosk
router.post('/kiosk/available', kioskAuth, async (req, res) => {
  try {
    // Get active orders that user can work on
    const activeOrders = await WorkOrder.getActiveOrders();
    
    // Filter to orders assigned to this user or unassigned orders
    const availableOrders = activeOrders.filter(order => 
      !order.assigned_to || order.assigned_to === req.user.id
    );

    res.json({
      success: true,
      data: availableOrders.map(o => o.toJSON())
    });
  } catch (error) {
    logger.error('Error fetching kiosk available orders:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch available orders' 
    });
  }
});

module.exports = router;