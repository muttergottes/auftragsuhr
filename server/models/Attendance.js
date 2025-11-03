const db = require('../config/database');
const logger = require('../config/logger');

class Attendance {
  constructor(attendanceData) {
    Object.assign(this, attendanceData);
  }

  static async findAll(options = {}) {
    const { 
      userId = null, 
      startDate = null, 
      endDate = null, 
      includeActive = true,
      limit = 100,
      offset = 0 
    } = options;
    
    let query = `
      SELECT a.*, u.first_name, u.last_name, u.employee_number
      FROM attendance_records a
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (userId) {
      query += ' AND a.user_id = ?';
      params.push(userId);
    }
    
    if (startDate) {
      query += ' AND DATE(a.clock_in) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(a.clock_in) <= ?';
      params.push(endDate);
    }
    
    if (!includeActive) {
      query += ' AND a.clock_out IS NOT NULL';
    }
    
    query += ' ORDER BY a.clock_in DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const records = await db.query(query, params);
    return records.map(record => new Attendance(record));
  }

  static async findById(id) {
    const query = `
      SELECT a.*, u.first_name, u.last_name, u.employee_number
      FROM attendance_records a
      JOIN users u ON a.user_id = u.id
      WHERE a.id = ?
    `;
    
    const [record] = await db.query(query, [id]);
    return record ? new Attendance(record) : null;
  }

  static async findActiveByUser(userId) {
    const query = `
      SELECT a.*, u.first_name, u.last_name, u.employee_number
      FROM attendance_records a
      JOIN users u ON a.user_id = u.id
      WHERE a.user_id = ? AND a.clock_out IS NULL
      ORDER BY a.clock_in DESC
      LIMIT 1
    `;
    
    const [record] = await db.query(query, [userId]);
    return record ? new Attendance(record) : null;
  }

  static async getAllActive() {
    const query = `
      SELECT a.*, u.first_name, u.last_name, u.employee_number
      FROM attendance_records a
      JOIN users u ON a.user_id = u.id
      WHERE a.clock_out IS NULL
      ORDER BY a.clock_in DESC
    `;
    
    const records = await db.query(query);
    return records.map(record => new Attendance(record));
  }

  static async clockIn(userId, options = {}) {
    const { 
      location = null, 
      method = 'manual', // manual, kiosk, scan
      note = null,
      ip_address = null
    } = options;

    // Check if user is already clocked in
    const activeAttendance = await this.findActiveByUser(userId);
    if (activeAttendance) {
      throw new Error('User is already clocked in');
    }

    const query = `
      INSERT INTO attendance_records 
      (user_id, clock_in, clock_in_method, clock_in_location, clock_in_note, clock_in_ip)
      VALUES (?, NOW(), ?, ?, ?, ?)
    `;

    const result = await db.query(query, [
      userId, method, location, note, ip_address
    ]);

    logger.info('User clocked in:', { 
      userId, 
      attendanceId: result.insertId,
      method,
      location 
    });

    return this.findById(result.insertId);
  }

  static async clockOut(userId, options = {}) {
    const { 
      location = null, 
      method = 'manual',
      note = null,
      ip_address = null,
      force = false // Admin can force clock out
    } = options;

    const activeAttendance = await this.findActiveByUser(userId);
    if (!activeAttendance) {
      throw new Error('User is not clocked in');
    }

    // Check for active work sessions or breaks
    if (!force) {
      // Auto-end any active breaks when clocking out
      try {
        const Break = require('./Break');
        const activeBreak = await Break.findActiveByUser(userId);
        if (activeBreak) {
          await Break.endBreak(userId, {
            note: 'Automatisch beendet beim Ausstempeln',
            method: options.method || 'manual'
          });
          logger.info('Auto-ended break on clock out:', { 
            userId, 
            breakId: activeBreak.id 
          });
        }
      } catch (breakError) {
        logger.warn('Failed to auto-end break on clock out:', breakError);
        // Continue with clock out even if break ending fails
      }
      
      // TODO: Check for active work sessions when that model is implemented
    }

    const query = `
      UPDATE attendance_records 
      SET clock_out = NOW(), 
          clock_out_method = ?, 
          clock_out_location = ?, 
          clock_out_note = ?,
          clock_out_ip = ?,
          total_hours = TIMESTAMPDIFF(SECOND, clock_in, NOW()) / 3600.0
      WHERE id = ?
    `;

    await db.query(query, [
      method, location, note, ip_address, activeAttendance.id
    ]);

    logger.info('User clocked out:', { 
      userId, 
      attendanceId: activeAttendance.id,
      method,
      location 
    });

    return this.findById(activeAttendance.id);
  }

  static async update(id, updateData) {
    const allowedFields = [
      'clock_in', 'clock_out', 'clock_in_note', 'clock_out_note',
      'clock_in_location', 'clock_out_location', 'total_hours', 'notes'
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

    // Recalculate total_hours if times are being updated
    let setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    if (updateData.clock_in || updateData.clock_out) {
      setClause += ', total_hours = TIMESTAMPDIFF(SECOND, clock_in, COALESCE(clock_out, NOW())) / 3600.0';
    }

    const query = `UPDATE attendance_records SET ${setClause}, updated_at = NOW() WHERE id = ?`;
    
    params.push(id);
    await db.query(query, params);
    
    logger.info('Attendance record updated:', { id, changes: Object.keys(updates) });
    
    return this.findById(id);
  }

  static async delete(id) {
    const query = 'DELETE FROM attendance_records WHERE id = ?';
    await db.query(query, [id]);
    
    logger.info('Attendance record deleted:', { id });
    return true;
  }

  static async getDailySummary(userId, date) {
    const query = `
      SELECT 
        COUNT(*) as total_sessions,
        SUM(COALESCE(total_hours, TIMESTAMPDIFF(SECOND, clock_in, COALESCE(clock_out, NOW())) / 3600.0)) as total_hours,
        MIN(clock_in) as first_clock_in,
        MAX(COALESCE(clock_out, NOW())) as last_clock_out,
        SUM(CASE WHEN clock_out IS NULL THEN 1 ELSE 0 END) as active_sessions
      FROM attendance_records 
      WHERE user_id = ? AND DATE(clock_in) = ?
    `;
    
    const [summary] = await db.query(query, [userId, date]);
    return summary;
  }

  static async getStatistics(options = {}) {
    const { period, startDate, endDate, userId } = options;
    
    let query, params = [];

    if (period === 'week') {
      query = `
        SELECT 
          CONCAT(YEAR(clock_in), '-W', LPAD(WEEK(clock_in, 1), 2, '0')) as period,
          COUNT(*) as total_records,
          COUNT(DISTINCT user_id) as unique_users,
          SUM(COALESCE(total_hours, TIMESTAMPDIFF(SECOND, clock_in, COALESCE(clock_out, NOW())) / 3600.0)) as total_hours,
          AVG(COALESCE(total_hours, TIMESTAMPDIFF(SECOND, clock_in, COALESCE(clock_out, NOW())) / 3600.0)) as avg_hours_per_session,
          SUM(CASE WHEN clock_out IS NULL THEN 1 ELSE 0 END) as active_sessions,
          MIN(clock_in) as earliest_clock_in,
          MAX(COALESCE(clock_out, clock_in)) as latest_clock_out
        FROM attendance_records ar
        WHERE 1=1
      `;
      
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
      
      if (startDate) {
        query += ' AND DATE(clock_in) >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND DATE(clock_in) <= ?';
        params.push(endDate);
      }
      
      query += ' GROUP BY YEARWEEK(clock_in, 1) ORDER BY period DESC LIMIT 30';
      
    } else if (period === 'month') {
      query = `
        SELECT 
          DATE_FORMAT(clock_in, '%Y-%m') as period,
          COUNT(*) as total_records,
          COUNT(DISTINCT user_id) as unique_users,
          SUM(COALESCE(total_hours, TIMESTAMPDIFF(SECOND, clock_in, COALESCE(clock_out, NOW())) / 3600.0)) as total_hours,
          AVG(COALESCE(total_hours, TIMESTAMPDIFF(SECOND, clock_in, COALESCE(clock_out, NOW())) / 3600.0)) as avg_hours_per_session,
          SUM(CASE WHEN clock_out IS NULL THEN 1 ELSE 0 END) as active_sessions,
          MIN(clock_in) as earliest_clock_in,
          MAX(COALESCE(clock_out, clock_in)) as latest_clock_out
        FROM attendance_records ar
        WHERE 1=1
      `;
      
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
      
      if (startDate) {
        query += ' AND DATE(clock_in) >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND DATE(clock_in) <= ?';
        params.push(endDate);
      }
      
      query += ' GROUP BY DATE_FORMAT(clock_in, \'%Y-%m\') ORDER BY period DESC LIMIT 30';
      
    } else if (period === 'year') {
      query = `
        SELECT 
          YEAR(clock_in) as period,
          COUNT(*) as total_records,
          COUNT(DISTINCT user_id) as unique_users,
          SUM(COALESCE(total_hours, TIMESTAMPDIFF(SECOND, clock_in, COALESCE(clock_out, NOW())) / 3600.0)) as total_hours,
          AVG(COALESCE(total_hours, TIMESTAMPDIFF(SECOND, clock_in, COALESCE(clock_out, NOW())) / 3600.0)) as avg_hours_per_session,
          SUM(CASE WHEN clock_out IS NULL THEN 1 ELSE 0 END) as active_sessions,
          MIN(clock_in) as earliest_clock_in,
          MAX(COALESCE(clock_out, clock_in)) as latest_clock_out
        FROM attendance_records ar
        WHERE 1=1
      `;
      
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
      
      if (startDate) {
        query += ' AND DATE(clock_in) >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND DATE(clock_in) <= ?';
        params.push(endDate);
      }
      
      query += ' GROUP BY YEAR(clock_in) ORDER BY period DESC LIMIT 30';
      
    } else { // day
      query = `
        SELECT 
          DATE(clock_in) as period,
          COUNT(*) as total_records,
          COUNT(DISTINCT user_id) as unique_users,
          SUM(COALESCE(total_hours, TIMESTAMPDIFF(SECOND, clock_in, COALESCE(clock_out, NOW())) / 3600.0)) as total_hours,
          AVG(COALESCE(total_hours, TIMESTAMPDIFF(SECOND, clock_in, COALESCE(clock_out, NOW())) / 3600.0)) as avg_hours_per_session,
          SUM(CASE WHEN clock_out IS NULL THEN 1 ELSE 0 END) as active_sessions,
          MIN(clock_in) as earliest_clock_in,
          MAX(COALESCE(clock_out, clock_in)) as latest_clock_out
        FROM attendance_records ar
        WHERE 1=1
      `;
      
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
      
      if (startDate) {
        query += ' AND DATE(clock_in) >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND DATE(clock_in) <= ?';
        params.push(endDate);
      }
      
      query += ' GROUP BY DATE(clock_in) ORDER BY period DESC LIMIT 30';
    }
    
    const results = await db.query(query, params);
    return results;
  }

  static async getWeeklySummary(userId, startDate, endDate) {
    const query = `
      SELECT 
        DATE(clock_in) as date,
        COUNT(*) as sessions,
        SUM(COALESCE(total_hours, TIMESTAMPDIFF(SECOND, clock_in, COALESCE(clock_out, NOW())) / 3600.0)) as hours,
        MIN(clock_in) as first_in,
        MAX(COALESCE(clock_out, clock_in)) as last_out
      FROM attendance_records 
      WHERE user_id = ? AND DATE(clock_in) BETWEEN ? AND ?
      GROUP BY DATE(clock_in)
      ORDER BY DATE(clock_in)
    `;
    
    const summary = await db.query(query, [userId, startDate, endDate]);
    return summary;
  }

  // Calculate working time excluding breaks
  async getWorkingHours() {
    if (!this.clock_in) return 0;
    
    const endTime = this.clock_out || new Date();
    const totalMinutes = Math.floor((new Date(endTime) - new Date(this.clock_in)) / (1000 * 60));
    
    // TODO: Subtract break time when break model is implemented
    const breakMinutes = 0; // Placeholder
    
    return Math.max(0, totalMinutes - breakMinutes) / 60;
  }

  // Get current status of attendance
  getStatus() {
    if (!this.clock_out) {
      return {
        status: 'active',
        duration: this.getCurrentDuration(),
        started_at: this.clock_in
      };
    }
    
    return {
      status: 'completed',
      duration: this.total_hours,
      started_at: this.clock_in,
      ended_at: this.clock_out
    };
  }

  getCurrentDuration() {
    if (!this.clock_in) return 0;
    const now = new Date();
    const startTime = new Date(this.clock_in);
    return Math.floor((now - startTime) / (1000 * 60)); // Minutes
  }

  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      employee_number: this.employee_number,
      first_name: this.first_name,
      last_name: this.last_name,
      clock_in: this.clock_in,
      clock_out: this.clock_out,
      clock_in_method: this.clock_in_method,
      clock_out_method: this.clock_out_method,
      clock_in_location: this.clock_in_location,
      clock_out_location: this.clock_out_location,
      clock_in_note: this.clock_in_note,
      clock_out_note: this.clock_out_note,
      notes: this.notes,
      total_hours: this.total_hours,
      created_at: this.created_at,
      updated_at: this.updated_at,
      status: this.getStatus()
    };
  }
}

module.exports = Attendance;