const express = require('express');
const router = express.Router();
const { authenticateToken, requireDispatcherOrAdmin } = require('../middleware/auth');
const logger = require('../config/logger');
const db = require('../config/database');

// GET /api/statistics/admin-overview - Admin overview statistics
router.get('/admin-overview', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    
    // Default to current day if no dates provided
    const start = startDate || new Date().toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];
    
    console.log('=== ADMIN STATISTICS REQUEST ===');
    console.log('Date range:', start, 'to', end);
    console.log('User filter:', userId || 'all users');
    
    // Use separate subqueries to avoid JOIN duplication issues
    let query = `
      SELECT 
        u.id,
        u.employee_number,
        u.first_name,
        u.last_name,
        u.role,
        
        -- Attendance time (separate subquery)
        COALESCE((
          SELECT SUM(
            CASE 
              WHEN clock_out IS NOT NULL 
              THEN TIMESTAMPDIFF(SECOND, clock_in, clock_out) / 60.0
              ELSE 0
            END
          )
          FROM attendance_records 
          WHERE user_id = u.id 
            AND DATE(clock_in) >= ? 
            AND DATE(clock_in) <= ?
        ), 0) as total_attendance_minutes,
        
        -- Break time (separate subquery)
        COALESCE((
          SELECT SUM(
            CASE 
              WHEN end_time IS NOT NULL 
              THEN TIMESTAMPDIFF(SECOND, start_time, end_time) / 60.0
              ELSE 0
            END
          )
          FROM break_records 
          WHERE user_id = u.id
            AND DATE(start_time) >= ? 
            AND DATE(start_time) <= ?
        ), 0) as total_break_minutes,
        
        -- Work on orders time (separate subquery)
        COALESCE((
          SELECT SUM(
            CASE 
              WHEN work_order_id IS NOT NULL AND end_time IS NOT NULL
              THEN TIMESTAMPDIFF(SECOND, start_time, end_time) / 60.0
              ELSE 0
            END
          )
          FROM work_sessions 
          WHERE user_id = u.id
            AND DATE(start_time) >= ? 
            AND DATE(start_time) <= ?
        ), 0) as total_order_work_minutes,
        
        -- Internal work time (separate subquery)
        COALESCE((
          SELECT SUM(
            CASE 
              WHEN work_order_id IS NULL AND category_id IS NOT NULL AND end_time IS NOT NULL
              THEN TIMESTAMPDIFF(SECOND, start_time, end_time) / 60.0
              ELSE 0
            END
          )
          FROM work_sessions 
          WHERE user_id = u.id
            AND DATE(start_time) >= ? 
            AND DATE(start_time) <= ?
        ), 0) as total_internal_work_minutes
        
      FROM users u
      WHERE u.is_active = 1 
        AND u.archived_at IS NULL
    `;
    
    const params = [start, end, start, end, start, end, start, end];
    
    if (userId) {
      query += ' AND u.id = ?';
      params.push(userId);
    }
    
    query += `
      ORDER BY u.last_name, u.first_name
    `;
    
    console.log('Executing statistics query...');
    const results = await db.query(query, params);
    
    // Calculate idle time (attendance - breaks - work)
    const statistics = results.map(row => {
      const attendanceMinutes = parseFloat(row.total_attendance_minutes) || 0;
      const breakMinutes = parseFloat(row.total_break_minutes) || 0;
      const orderWorkMinutes = parseFloat(row.total_order_work_minutes) || 0;
      const internalWorkMinutes = parseFloat(row.total_internal_work_minutes) || 0;
      
      const totalWorkMinutes = orderWorkMinutes + internalWorkMinutes;
      const idleMinutes = Math.max(0, attendanceMinutes - breakMinutes - totalWorkMinutes);
      
      return {
        user: {
          id: row.id,
          employee_number: row.employee_number,
          first_name: row.first_name,
          last_name: row.last_name,
          role: row.role,
          full_name: `${row.first_name} ${row.last_name}`
        },
        times: {
          attendance_minutes: Math.round(attendanceMinutes),
          break_minutes: Math.round(breakMinutes),
          order_work_minutes: Math.round(orderWorkMinutes),
          internal_work_minutes: Math.round(internalWorkMinutes),
          idle_minutes: Math.round(idleMinutes),
          total_work_minutes: Math.round(totalWorkMinutes)
        },
        formatted: {
          attendance: formatMinutes(attendanceMinutes),
          break: formatMinutes(breakMinutes),
          order_work: formatMinutes(orderWorkMinutes),
          internal_work: formatMinutes(internalWorkMinutes),
          idle: formatMinutes(idleMinutes),
          total_work: formatMinutes(totalWorkMinutes)
        },
        percentages: attendanceMinutes > 0 ? {
          break: Math.round((breakMinutes / attendanceMinutes) * 100),
          order_work: Math.round((orderWorkMinutes / attendanceMinutes) * 100),
          internal_work: Math.round((internalWorkMinutes / attendanceMinutes) * 100),
          idle: Math.round((idleMinutes / attendanceMinutes) * 100),
          total_work: Math.round((totalWorkMinutes / attendanceMinutes) * 100),
          // Order productivity based on working time (attendance - breaks)
          order_work_of_worktime: (attendanceMinutes - breakMinutes) > 0 ? 
            Math.round((orderWorkMinutes / (attendanceMinutes - breakMinutes)) * 100) : 0
        } : {
          break: 0, order_work: 0, internal_work: 0, idle: 0, total_work: 0, order_work_of_worktime: 0
        }
      };
    });
    
    console.log('Statistics calculated for', statistics.length, 'users');
    
    res.json({
      success: true,
      data: statistics,
      meta: {
        start_date: start,
        end_date: end,
        user_count: statistics.length,
        total_users_with_attendance: statistics.filter(s => s.times.attendance_minutes > 0).length
      }
    });
    
  } catch (error) {
    console.error('Error in admin statistics:', error);
    logger.error('Error fetching admin statistics:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch statistics',
      details: error.message 
    });
  }
});

// GET /api/statistics/user-detail/:userId - Detailed user statistics
router.get('/user-detail/:userId', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    const start = startDate || new Date().toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];
    
    // Get daily breakdown for the user (fixed with subqueries)
    const dailyQuery = `
      SELECT 
        work_date,
        
        -- Attendance for this day (separate subquery)
        COALESCE((
          SELECT SUM(
            CASE 
              WHEN clock_out IS NOT NULL 
              THEN TIMESTAMPDIFF(SECOND, clock_in, clock_out) / 60.0
              ELSE 0
            END
          )
          FROM attendance_records
          WHERE user_id = ? AND DATE(clock_in) = work_date
        ), 0) as attendance_minutes,
        
        -- Breaks for this day (separate subquery)
        COALESCE((
          SELECT SUM(
            CASE 
              WHEN end_time IS NOT NULL 
              THEN TIMESTAMPDIFF(SECOND, start_time, end_time) / 60.0
              ELSE 0
            END
          )
          FROM break_records
          WHERE user_id = ? AND DATE(start_time) = work_date
        ), 0) as break_minutes
        
      FROM (
        SELECT DISTINCT DATE(clock_in) as work_date
        FROM attendance_records
        WHERE user_id = ?
          AND DATE(clock_in) >= ?
          AND DATE(clock_in) <= ?
      ) dates
      ORDER BY work_date DESC
    `;
    
    const dailyBreakdown = await db.query(dailyQuery, [userId, userId, userId, start, end]);
    
    // Get work sessions breakdown
    const workSessionsQuery = `
      SELECT 
        ws.*,
        DATE(ws.start_time) as work_date,
        wo.order_number,
        c.name as category_name,
        c.type as category_type,
        CASE 
          WHEN ws.end_time IS NOT NULL 
          THEN TIMESTAMPDIFF(SECOND, ws.start_time, ws.end_time) / 60.0
          ELSE 0
        END as duration_minutes
      FROM work_sessions ws
      LEFT JOIN work_orders wo ON ws.work_order_id = wo.id
      LEFT JOIN categories c ON ws.category_id = c.id
      WHERE ws.user_id = ?
        AND DATE(ws.start_time) >= ?
        AND DATE(ws.start_time) <= ?
        AND ws.end_time IS NOT NULL
      ORDER BY ws.start_time DESC
    `;
    
    const workSessions = await db.query(workSessionsQuery, [userId, start, end]);
    console.log('Raw work sessions from DB:', workSessions.slice(0, 2)); // Debug first 2 records
    
    // Get break sessions breakdown
    const breakSessionsQuery = `
      SELECT 
        br.*,
        DATE(br.start_time) as break_date,
        c.name as category_name,
        c.type as category_type,
        CASE 
          WHEN br.end_time IS NOT NULL 
          THEN TIMESTAMPDIFF(SECOND, br.start_time, br.end_time) / 60.0
          ELSE 0
        END as duration_minutes
      FROM break_records br
      LEFT JOIN categories c ON br.category_id = c.id
      WHERE br.user_id = ?
        AND DATE(br.start_time) >= ?
        AND DATE(br.start_time) <= ?
        AND br.end_time IS NOT NULL
      ORDER BY br.start_time DESC
    `;
    
    const breakSessions = await db.query(breakSessionsQuery, [userId, start, end]);
    console.log('Raw break sessions from DB:', breakSessions.slice(0, 2)); // Debug first 2 records
    
    // Get attendance records breakdown
    const attendanceRecordsQuery = `
      SELECT 
        ar.*,
        DATE(ar.clock_in) as attendance_date,
        CASE 
          WHEN ar.clock_out IS NOT NULL 
          THEN TIMESTAMPDIFF(SECOND, ar.clock_in, ar.clock_out) / 60.0
          ELSE 0
        END as duration_minutes
      FROM attendance_records ar
      WHERE ar.user_id = ?
        AND DATE(ar.clock_in) >= ?
        AND DATE(ar.clock_in) <= ?
        AND ar.clock_out IS NOT NULL
      ORDER BY ar.clock_in DESC
    `;
    
    const attendanceRecords = await db.query(attendanceRecordsQuery, [userId, start, end]);
    console.log('Raw attendance records from DB:', attendanceRecords.slice(0, 2)); // Debug first 2 records
    
    // Get user info
    const userQuery = `
      SELECT id, employee_number, first_name, last_name, role
      FROM users 
      WHERE id = ?
    `;
    
    const [user] = await db.query(userQuery, [userId]);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      data: {
        user: {
          ...user,
          full_name: `${user.first_name} ${user.last_name}`
        },
        daily_breakdown: dailyBreakdown.map(day => ({
          date: day.work_date,
          attendance_minutes: Math.round(day.attendance_minutes),
          break_minutes: Math.round(day.break_minutes),
          formatted: {
            attendance: formatMinutes(day.attendance_minutes),
            break: formatMinutes(day.break_minutes)
          }
        })),
        work_sessions: workSessions.map(session => {
          const mapped = {
            id: session.id,
            date: session.work_date,
            type: session.order_number ? 'order' : 'internal',
            order_number: session.order_number,
            category_name: session.category_name,
            task_description: session.task_description,
            duration_minutes: Math.round(session.duration_minutes),
            formatted_duration: formatMinutes(session.duration_minutes),
            start_time: session.start_time,
            end_time: session.end_time
          };
          console.log('Mapped work session:', { original_id: session.id, mapped_id: mapped.id });
          return mapped;
        }),
        break_sessions: breakSessions.map(breakSession => {
          console.log('=== BREAK SESSION MAPPING ===');
          console.log('Original breakSession:', breakSession);
          console.log('breakSession.id value:', breakSession.id);
          console.log('breakSession.id type:', typeof breakSession.id);
          
          const mapped = {
            id: breakSession.id,
            date: breakSession.break_date,
            category_name: breakSession.category_name,
            category_type: breakSession.category_type,
            notes: breakSession.notes,
            duration_minutes: Math.round(breakSession.duration_minutes),
            formatted_duration: formatMinutes(breakSession.duration_minutes),
            start_time: breakSession.start_time,
            end_time: breakSession.end_time
          };
          
          console.log('Mapped break session:', mapped);
          console.log('Final mapped.id:', mapped.id);
          console.log('===========================');
          return mapped;
        }),
        attendance_records: attendanceRecords.map(record => {
          console.log('=== ATTENDANCE RECORD MAPPING ===');
          console.log('Original record:', record);
          console.log('record.id value:', record.id);
          
          const mapped = {
            id: record.id,
            date: record.attendance_date,
            clock_in: record.clock_in,
            clock_out: record.clock_out,
            duration_minutes: Math.round(record.duration_minutes),
            formatted_duration: formatMinutes(record.duration_minutes),
            notes: record.notes
          };
          
          console.log('Mapped attendance record:', mapped);
          console.log('Final mapped.id:', mapped.id);
          console.log('================================');
          return mapped;
        })
      },
      meta: {
        start_date: start,
        end_date: end,
        total_days: dailyBreakdown.length,
        total_sessions: workSessions.length,
        total_break_sessions: breakSessions.length,
        total_attendance_records: attendanceRecords.length
      }
    });
    
  } catch (error) {
    console.error('Error in user detail statistics:', error);
    logger.error('Error fetching user detail statistics:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch user statistics',
      details: error.message 
    });
  }
});

// Helper function to format minutes to HH:MM
function formatMinutes(minutes) {
  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

module.exports = router;