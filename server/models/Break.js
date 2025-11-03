const db = require('../config/database');
const logger = require('../config/logger');

class Break {
  constructor(breakData) {
    Object.assign(this, breakData);
  }

  static async findAll(options = {}) {
    const { 
      userId = null, 
      attendanceRecordId = null,
      startDate = null, 
      endDate = null, 
      includeActive = true,
      limit = 100,
      offset = 0 
    } = options;
    
    let query = `
      SELECT b.*, u.first_name, u.last_name, u.employee_number, c.name as category_name, c.type as category_type
      FROM break_records b
      JOIN users u ON b.user_id = u.id
      JOIN categories c ON b.category_id = c.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (userId) {
      query += ' AND b.user_id = ?';
      params.push(userId);
    }
    
    if (attendanceRecordId) {
      query += ' AND b.attendance_record_id = ?';
      params.push(attendanceRecordId);
    }
    
    if (startDate) {
      query += ' AND DATE(b.start_time) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(b.start_time) <= ?';
      params.push(endDate);
    }
    
    if (!includeActive) {
      query += ' AND b.end_time IS NOT NULL';
    }
    
    query += ' ORDER BY b.start_time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const records = await db.query(query, params);
    return records.map(record => new Break(record));
  }

  static async findById(id) {
    const query = `
      SELECT b.*, u.first_name, u.last_name, u.employee_number, c.name as category_name, c.type as category_type
      FROM break_records b
      JOIN users u ON b.user_id = u.id
      JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `;
    
    const [record] = await db.query(query, [id]);
    return record ? new Break(record) : null;
  }

  static async findActiveByUser(userId) {
    const query = `
      SELECT b.*, u.first_name, u.last_name, u.employee_number, c.name as category_name, c.type as category_type
      FROM break_records b
      JOIN users u ON b.user_id = u.id
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.end_time IS NULL
      ORDER BY b.start_time DESC
      LIMIT 1
    `;
    
    const [record] = await db.query(query, [userId]);
    return record ? new Break(record) : null;
  }

  static async getAllActive() {
    const query = `
      SELECT b.*, u.first_name, u.last_name, u.employee_number, c.name as category_name, c.type as category_type
      FROM break_records b
      JOIN users u ON b.user_id = u.id
      JOIN categories c ON b.category_id = c.id
      WHERE b.end_time IS NULL
      ORDER BY b.start_time DESC
    `;
    
    const records = await db.query(query);
    return records.map(record => new Break(record));
  }

  static async startBreak(userId, options = {}) {
    const { 
      categoryId,
      attendanceRecordId = null,
      note = null,
      method = 'manual' // manual, kiosk, auto
    } = options;

    // Check if user is currently clocked in (has active attendance)
    const attendanceQuery = 'SELECT * FROM attendance_records WHERE user_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1';
    const [activeAttendance] = await db.query(attendanceQuery, [userId]);
    if (!activeAttendance) {
      throw new Error('User must be clocked in to start a break');
    }

    // Check if user already has an active break
    const activeBreak = await this.findActiveByUser(userId);
    if (activeBreak) {
      throw new Error('User already has an active break');
    }

    // Get category for validation
    const categoryQuery = 'SELECT * FROM categories WHERE id = ? AND type = "break" AND is_active = 1';
    const [category] = await db.query(categoryQuery, [categoryId]);
    if (!category) {
      throw new Error('Invalid break category');
    }

    const query = `
      INSERT INTO break_records 
      (user_id, attendance_record_id, category_id, start_time, notes)
      VALUES (?, ?, ?, NOW(), ?)
    `;

    const result = await db.query(query, [
      userId, attendanceRecordId, categoryId, note
    ]);

    logger.info('Break started:', { 
      userId, 
      breakId: result.insertId,
      categoryId,
      method
    });

    return this.findById(result.insertId);
  }

  static async endBreak(userId, options = {}) {
    const { 
      note = null,
      method = 'manual',
      force = false // Admin can force end break
    } = options;

    const activeBreak = await this.findActiveByUser(userId);
    if (!activeBreak) {
      throw new Error('User has no active break');
    }

    const query = `
      UPDATE break_records 
      SET end_time = NOW(), 
          duration_minutes = TIMESTAMPDIFF(SECOND, start_time, NOW()) / 60.0,
          notes = COALESCE(?, notes)
      WHERE id = ?
    `;

    await db.query(query, [note, activeBreak.id]);

    logger.info('Break ended:', { 
      userId, 
      breakId: activeBreak.id,
      method
    });

    return this.findById(activeBreak.id);
  }

  static async update(id, updateData) {
    const allowedFields = [
      'start_time', 'end_time', 'category_id', 'notes', 'duration_minutes'
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

    // Recalculate duration if times are being updated
    let setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    if (updateData.start_time || updateData.end_time) {
      setClause += ', duration_minutes = TIMESTAMPDIFF(SECOND, start_time, COALESCE(end_time, NOW())) / 60.0';
    }

    const query = `UPDATE break_records SET ${setClause}, updated_at = NOW() WHERE id = ?`;
    
    params.push(id);
    await db.query(query, params);
    
    logger.info('Break record updated:', { id, changes: Object.keys(updates) });
    
    return this.findById(id);
  }

  static async delete(id) {
    const query = 'DELETE FROM break_records WHERE id = ?';
    await db.query(query, [id]);
    
    logger.info('Break record deleted:', { id });
    return true;
  }

  static async getDailySummary(userId, date) {
    const query = `
      SELECT 
        COUNT(*) as total_breaks,
        SUM(COALESCE(duration_minutes, TIMESTAMPDIFF(SECOND, start_time, COALESCE(end_time, NOW())) / 60.0)) as total_break_minutes,
        c.type as break_type,
        c.name as break_category_name
      FROM break_records b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND DATE(b.start_time) = ?
      GROUP BY c.type, c.name
    `;
    
    const summary = await db.query(query, [userId, date]);
    return summary;
  }

  // Calculate current duration for active breaks
  getCurrentDuration() {
    if (!this.start_time) return 0;
    const endTime = this.end_time || new Date();
    const startTime = new Date(this.start_time);
    return Math.floor((endTime - startTime) / (1000 * 60)); // Minutes
  }

  // Get current status of break
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
      attendance_record_id: this.attendance_record_id,
      category_id: this.category_id,
      category_name: this.category_name,
      category_type: this.category_type,
      employee_number: this.employee_number,
      first_name: this.first_name,
      last_name: this.last_name,
      start_time: this.start_time,
      end_time: this.end_time,
      duration_minutes: this.duration_minutes,
      notes: this.notes,
      created_at: this.created_at,
      updated_at: this.updated_at,
      status: this.getStatus()
    };
  }
}

module.exports = Break;