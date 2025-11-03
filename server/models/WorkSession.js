const db = require('../config/database');
const logger = require('../config/logger');

class WorkSession {
  constructor(sessionData) {
    Object.assign(this, sessionData);
  }

  static async findAll(options = {}) {
    const { 
      userId = null,
      workOrderId = null,
      startDate = null,
      endDate = null,
      includeActive = true,
      limit = 100,
      offset = 0 
    } = options;
    
    let query = `
      SELECT ws.*, 
             u.first_name, u.last_name, u.employee_number,
             wo.order_number, wo.description as order_description,
             c.name as category_name, c.type as category_type
      FROM work_sessions ws
      JOIN users u ON ws.user_id = u.id
      LEFT JOIN work_orders wo ON ws.work_order_id = wo.id
      LEFT JOIN categories c ON ws.category_id = c.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (userId) {
      query += ' AND ws.user_id = ?';
      params.push(userId);
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
    
    if (!includeActive) {
      query += ' AND ws.end_time IS NOT NULL';
    }
    
    query += ' ORDER BY ws.start_time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const records = await db.query(query, params);
    return records.map(record => new WorkSession(record));
  }

  static async findById(id) {
    const query = `
      SELECT ws.*, 
             u.first_name, u.last_name, u.employee_number,
             wo.order_number, wo.description as order_description,
             c.name as category_name, c.type as category_type
      FROM work_sessions ws
      JOIN users u ON ws.user_id = u.id
      LEFT JOIN work_orders wo ON ws.work_order_id = wo.id
      LEFT JOIN categories c ON ws.category_id = c.id
      WHERE ws.id = ?
    `;
    
    const [record] = await db.query(query, [id]);
    return record ? new WorkSession(record) : null;
  }

  static async findActiveByUser(userId) {
    const query = `
      SELECT ws.*, 
             u.first_name, u.last_name, u.employee_number,
             wo.order_number, wo.description as order_description,
             c.name as category_name, c.type as category_type
      FROM work_sessions ws
      JOIN users u ON ws.user_id = u.id
      LEFT JOIN work_orders wo ON ws.work_order_id = wo.id
      LEFT JOIN categories c ON ws.category_id = c.id
      WHERE ws.user_id = ? AND ws.end_time IS NULL
      ORDER BY ws.start_time DESC
      LIMIT 1
    `;
    
    const [record] = await db.query(query, [userId]);
    return record ? new WorkSession(record) : null;
  }

  static async getAllActive() {
    const query = `
      SELECT ws.*, 
             u.first_name, u.last_name, u.employee_number,
             wo.order_number, wo.description as order_description,
             c.name as category_name, c.type as category_type,
             cust.company_name, cust.first_name as customer_first_name, cust.last_name as customer_last_name
      FROM work_sessions ws
      JOIN users u ON ws.user_id = u.id
      LEFT JOIN work_orders wo ON ws.work_order_id = wo.id
      LEFT JOIN categories c ON ws.category_id = c.id
      LEFT JOIN customers cust ON wo.customer_id = cust.id
      WHERE ws.end_time IS NULL
      ORDER BY ws.start_time ASC
    `;
    
    const records = await db.query(query);
    return records.map(record => new WorkSession(record));
  }

  static async startSession(userId, options = {}) {
    const { 
      workOrderId = null, // Now optional for activity sessions
      categoryId = null,
      taskDescription = null,
      hourlyRate = null,
      note = null,
      method = 'manual' // manual, kiosk, auto
    } = options;

    // Check if user already has an active session
    const activeSession = await this.findActiveByUser(userId);
    if (activeSession) {
      throw new Error('User already has an active work session');
    }

    // For kiosk method, validate attendance and break status
    if (method === 'kiosk') {
      // Check if user is clocked in
      const attendanceQuery = `
        SELECT id FROM attendance_records 
        WHERE user_id = ? AND clock_in IS NOT NULL AND clock_out IS NULL
        ORDER BY clock_in DESC LIMIT 1
      `;
      const [attendance] = await db.query(attendanceQuery, [userId]);
      if (!attendance) {
        throw new Error('User must be clocked in to start work session');
      }

      // Check if user is currently on break
      const breakQuery = `
        SELECT id FROM break_records 
        WHERE user_id = ? AND start_time IS NOT NULL AND end_time IS NULL
        ORDER BY start_time DESC LIMIT 1
      `;
      const [activeBreak] = await db.query(breakQuery, [userId]);
      if (activeBreak) {
        throw new Error('User cannot start work session while on break');
      }
    }

    // For order-based sessions, verify work order exists and is active
    if (workOrderId) {
      const WorkOrder = require('./WorkOrder');
      const workOrder = await WorkOrder.findById(workOrderId);
      if (!workOrder) {
        throw new Error('Work order not found');
      }
      if (!['created', 'in_progress'].includes(workOrder.status)) {
        throw new Error('Work order is not active');
      }

      // Auto-update work order status to in_progress if it's created
      if (workOrder.status === 'created') {
        await WorkOrder.update(workOrderId, { status: 'in_progress' });
      }
    } else {
      // For activity sessions, require categoryId
      if (!categoryId) {
        throw new Error('Category is required for activity sessions');
      }
      
      // Verify category exists and is for activities (not break)
      const categoryQuery = 'SELECT * FROM categories WHERE id = ? AND type != "break" AND is_active = 1';
      const [category] = await db.query(categoryQuery, [categoryId]);
      if (!category) {
        throw new Error('Invalid activity category');
      }
    }

    const query = `
      INSERT INTO work_sessions 
      (user_id, work_order_id, category_id, task_description, start_time, hourly_rate, notes)
      VALUES (?, ?, ?, ?, NOW(), ?, ?)
    `;

    const result = await db.query(query, [
      userId, workOrderId, categoryId, taskDescription, hourlyRate, note
    ]);

    logger.info('Work session started:', { 
      userId, 
      sessionId: result.insertId,
      workOrderId,
      method
    });

    return this.findById(result.insertId);
  }

  static async endSession(userId, options = {}) {
    const { 
      note = null,
      method = 'manual',
      force = false // Admin can force end session
    } = options;

    const activeSession = await this.findActiveByUser(userId);
    if (!activeSession) {
      throw new Error('User has no active work session');
    }

    const query = `
      UPDATE work_sessions 
      SET end_time = NOW(), 
          duration_minutes = TIMESTAMPDIFF(SECOND, start_time, NOW()) / 60.0,
          cost = CASE 
            WHEN hourly_rate IS NOT NULL 
            THEN (TIMESTAMPDIFF(SECOND, start_time, NOW()) / 3600.0) * hourly_rate 
            ELSE NULL 
          END,
          notes = COALESCE(?, notes)
      WHERE id = ?
    `;

    await db.query(query, [note, activeSession.id]);

    logger.info('Work session ended:', { 
      userId, 
      sessionId: activeSession.id,
      method
    });

    return this.findById(activeSession.id);
  }

  static async update(id, updateData) {
    const allowedFields = [
      'start_time', 'end_time', 'category_id', 'task_description', 
      'duration_minutes', 'hourly_rate', 'cost', 'notes', 'is_billable'
    ];

    const updates = {};
    const params = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        updates[key] = updateData[key];
        params.push(updateData[key]);
      }
    });

    if (Object.keys(updates).length === 0) {
      throw new Error('No valid fields to update');
    }

    // Recalculate duration and cost if times are being updated
    let setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    if (updateData.start_time || updateData.end_time) {
      setClause += ', duration_minutes = TIMESTAMPDIFF(SECOND, start_time, COALESCE(end_time, NOW())) / 60.0';
      setClause += ', cost = CASE WHEN hourly_rate IS NOT NULL THEN (TIMESTAMPDIFF(SECOND, start_time, COALESCE(end_time, NOW())) / 3600.0) * hourly_rate ELSE cost END';
    }

    const query = `UPDATE work_sessions SET ${setClause}, updated_at = NOW() WHERE id = ?`;
    
    params.push(id);
    await db.query(query, params);
    
    logger.info('Work session updated:', { id, changes: Object.keys(updates) });
    
    return this.findById(id);
  }

  static async delete(id) {
    const query = 'DELETE FROM work_sessions WHERE id = ?';
    await db.query(query, [id]);
    
    logger.info('Work session deleted:', { id });
    return true;
  }

  static async getDailySummary(userId, date) {
    const query = `
      SELECT 
        COUNT(*) as total_sessions,
        SUM(COALESCE(duration_minutes, TIMESTAMPDIFF(SECOND, start_time, COALESCE(end_time, NOW())) / 60.0)) as total_work_minutes,
        COUNT(DISTINCT work_order_id) as unique_orders,
        SUM(CASE WHEN is_billable = 1 THEN COALESCE(cost, 0) ELSE 0 END) as billable_cost
      FROM work_sessions 
      WHERE user_id = ? AND DATE(start_time) = ?
    `;
    
    const [summary] = await db.query(query, [userId, date]);
    return summary;
  }

  static async getOrderSummary(workOrderId) {
    const query = `
      SELECT 
        COUNT(*) as total_sessions,
        SUM(COALESCE(duration_minutes, TIMESTAMPDIFF(SECOND, start_time, COALESCE(end_time, NOW())) / 60.0)) as total_work_minutes,
        COUNT(DISTINCT user_id) as unique_workers,
        SUM(CASE WHEN is_billable = 1 THEN COALESCE(cost, 0) ELSE 0 END) as total_cost,
        MIN(start_time) as first_work_start,
        MAX(COALESCE(end_time, start_time)) as last_work_end
      FROM work_sessions 
      WHERE work_order_id = ?
    `;
    
    const [summary] = await db.query(query, [workOrderId]);
    return summary;
  }

  static async getStatistics(options = {}) {
    const { period, startDate, endDate, userId } = options;
    
    let query, params = [];

    if (period === 'week') {
      query = `
        SELECT 
          CONCAT(YEAR(start_time), '-W', LPAD(WEEK(start_time, 1), 2, '0')) as period,
          COUNT(*) as total_sessions,
          SUM(COALESCE(duration_minutes, TIMESTAMPDIFF(SECOND, start_time, COALESCE(end_time, NOW())) / 60.0)) as total_work_minutes,
          COUNT(DISTINCT work_order_id) as unique_orders,
          COUNT(DISTINCT user_id) as unique_workers,
          SUM(CASE WHEN is_billable = 1 THEN COALESCE(cost, 0) ELSE 0 END) as total_billable_cost
        FROM work_sessions ws
        WHERE 1=1
      `;
      
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
      
      if (startDate) {
        query += ' AND DATE(start_time) >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND DATE(start_time) <= ?';
        params.push(endDate);
      }
      
      query += ' GROUP BY YEARWEEK(start_time, 1) ORDER BY period DESC LIMIT 30';
      
    } else if (period === 'month') {
      query = `
        SELECT 
          DATE_FORMAT(start_time, '%Y-%m') as period,
          COUNT(*) as total_sessions,
          SUM(COALESCE(duration_minutes, TIMESTAMPDIFF(SECOND, start_time, COALESCE(end_time, NOW())) / 60.0)) as total_work_minutes,
          COUNT(DISTINCT work_order_id) as unique_orders,
          COUNT(DISTINCT user_id) as unique_workers,
          SUM(CASE WHEN is_billable = 1 THEN COALESCE(cost, 0) ELSE 0 END) as total_billable_cost
        FROM work_sessions ws
        WHERE 1=1
      `;
      
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
      
      if (startDate) {
        query += ' AND DATE(start_time) >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND DATE(start_time) <= ?';
        params.push(endDate);
      }
      
      query += ' GROUP BY DATE_FORMAT(start_time, \'%Y-%m\') ORDER BY period DESC LIMIT 30';
      
    } else if (period === 'year') {
      query = `
        SELECT 
          YEAR(start_time) as period,
          COUNT(*) as total_sessions,
          SUM(COALESCE(duration_minutes, TIMESTAMPDIFF(SECOND, start_time, COALESCE(end_time, NOW())) / 60.0)) as total_work_minutes,
          COUNT(DISTINCT work_order_id) as unique_orders,
          COUNT(DISTINCT user_id) as unique_workers,
          SUM(CASE WHEN is_billable = 1 THEN COALESCE(cost, 0) ELSE 0 END) as total_billable_cost
        FROM work_sessions ws
        WHERE 1=1
      `;
      
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
      
      if (startDate) {
        query += ' AND DATE(start_time) >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND DATE(start_time) <= ?';
        params.push(endDate);
      }
      
      query += ' GROUP BY YEAR(start_time) ORDER BY period DESC LIMIT 30';
      
    } else { // day
      query = `
        SELECT 
          DATE(start_time) as period,
          COUNT(*) as total_sessions,
          SUM(COALESCE(duration_minutes, TIMESTAMPDIFF(SECOND, start_time, COALESCE(end_time, NOW())) / 60.0)) as total_work_minutes,
          COUNT(DISTINCT work_order_id) as unique_orders,
          COUNT(DISTINCT user_id) as unique_workers,
          SUM(CASE WHEN is_billable = 1 THEN COALESCE(cost, 0) ELSE 0 END) as total_billable_cost
        FROM work_sessions ws
        WHERE 1=1
      `;
      
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
      
      if (startDate) {
        query += ' AND DATE(start_time) >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND DATE(start_time) <= ?';
        params.push(endDate);
      }
      
      query += ' GROUP BY DATE(start_time) ORDER BY period DESC LIMIT 30';
    }
    
    const results = await db.query(query, params);
    return results;
  }

  static async getUserStatistics(userId, options = {}) {
    const { period, startDate, endDate } = options;
    
    // Get period statistics
    const periodStats = await this.getStatistics({
      period,
      startDate,
      endDate,
      userId
    });

    // Get top orders worked on
    let topOrdersQuery = `
      SELECT 
        wo.order_number,
        wo.description,
        COUNT(*) as session_count,
        SUM(COALESCE(ws.duration_minutes, TIMESTAMPDIFF(SECOND, ws.start_time, COALESCE(ws.end_time, NOW())) / 60.0)) as total_minutes,
        MIN(ws.start_time) as first_worked,
        MAX(COALESCE(ws.end_time, ws.start_time)) as last_worked
      FROM work_sessions ws
      JOIN work_orders wo ON ws.work_order_id = wo.id
      WHERE ws.user_id = ?
    `;

    const topOrdersParams = [userId];
    
    if (startDate) {
      topOrdersQuery += ' AND DATE(ws.start_time) >= ?';
      topOrdersParams.push(startDate);
    }
    
    if (endDate) {
      topOrdersQuery += ' AND DATE(ws.start_time) <= ?';
      topOrdersParams.push(endDate);
    }
    
    topOrdersQuery += ' GROUP BY wo.id ORDER BY total_minutes DESC LIMIT 10';
    
    const topOrders = await db.query(topOrdersQuery, topOrdersParams);

    // Get overall summary
    let summaryQuery = `
      SELECT 
        COUNT(*) as total_sessions,
        SUM(COALESCE(duration_minutes, TIMESTAMPDIFF(SECOND, start_time, COALESCE(end_time, NOW())) / 60.0)) as total_work_minutes,
        COUNT(DISTINCT work_order_id) as unique_orders,
        AVG(COALESCE(duration_minutes, TIMESTAMPDIFF(SECOND, start_time, COALESCE(end_time, NOW())) / 60.0)) as avg_session_minutes,
        SUM(CASE WHEN is_billable = 1 THEN COALESCE(cost, 0) ELSE 0 END) as total_billable_cost
      FROM work_sessions 
      WHERE user_id = ?
    `;

    const summaryParams = [userId];
    
    if (startDate) {
      summaryQuery += ' AND DATE(start_time) >= ?';
      summaryParams.push(startDate);
    }
    
    if (endDate) {
      summaryQuery += ' AND DATE(start_time) <= ?';
      summaryParams.push(endDate);
    }
    
    const [summary] = await db.query(summaryQuery, summaryParams);

    return {
      periodStats,
      topOrders,
      summary
    };
  }

  // Calculate current duration for active sessions
  getCurrentDuration() {
    if (!this.start_time) return 0;
    const endTime = this.end_time || new Date();
    const startTime = new Date(this.start_time);
    return Math.floor((endTime - startTime) / (1000 * 60)); // Minutes
  }

  // Get current status of session
  getStatus() {
    if (!this.end_time) {
      return {
        status: 'active',
        duration: this.getCurrentDuration(),
        started_at: this.start_time
      };
    }
    
    return {
      status: 'completed',
      duration: this.duration_minutes,
      started_at: this.start_time,
      ended_at: this.end_time
    };
  }

  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      work_order_id: this.work_order_id,
      category_id: this.category_id,
      task_description: this.task_description,
      start_time: this.start_time,
      end_time: this.end_time,
      duration_minutes: this.duration_minutes,
      hourly_rate: this.hourly_rate,
      cost: this.cost,
      notes: this.notes,
      is_billable: this.is_billable,
      created_at: this.created_at,
      updated_at: this.updated_at,
      // Joined fields
      employee_number: this.employee_number,
      first_name: this.first_name,
      last_name: this.last_name,
      order_number: this.order_number,
      order_description: this.order_description,
      category_name: this.category_name,
      customer_name: this.company_name || `${this.customer_first_name || ''} ${this.customer_last_name || ''}`.trim(),
      status: this.getStatus()
    };
  }
}

module.exports = WorkSession;