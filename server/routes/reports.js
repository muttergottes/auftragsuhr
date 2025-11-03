const express = require('express');
const router = express.Router();
const { authenticateToken, requireAnyRole } = require('../middleware/auth');
const logger = require('../config/logger');

router.get('/', (req, res) => {
  res.json({ message: 'Reports endpoint' });
});

// GET /api/reports/attendance-stats - Attendance statistics
router.get('/attendance-stats', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { 
      period = 'day',
      startDate,
      endDate,
      userId
    } = req.query;

    console.log('Attendance stats request:', { period, startDate, endDate, userId });

    // Users can only see their own stats unless they're dispatcher/admin
    const targetUserId = req.user.role === 'employee' ? req.user.id : userId;

    const Attendance = require('../models/Attendance');
    const stats = await Attendance.getStatistics({
      period,
      startDate,
      endDate,
      userId: targetUserId
    });

    console.log('Attendance stats result:', stats);
    res.json(stats);
  } catch (error) {
    console.error('Error in attendance stats:', error);
    logger.error('Error fetching attendance statistics:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch attendance statistics' });
  }
});

// GET /api/reports/break-stats - Break statistics
router.get('/break-stats', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { 
      period = 'day',
      startDate,
      endDate,
      userId
    } = req.query;

    console.log('Break stats request:', { period, startDate, endDate, userId });

    // Users can only see their own stats unless they're dispatcher/admin
    const targetUserId = req.user.role === 'employee' ? req.user.id : userId;

    const db = require('../config/database');
    let periodGroupBy;
    
    switch (period) {
      case 'year':
        periodGroupBy = `YEAR(b.start_time) as year, '' as period`;
        break;
      case 'month':
        periodGroupBy = `YEAR(b.start_time) as year, MONTH(b.start_time) as month, CONCAT(YEAR(b.start_time), '-', LPAD(MONTH(b.start_time), 2, '0')) as period`;
        break;
      case 'week':
        periodGroupBy = `YEAR(b.start_time) as year, WEEK(b.start_time) as week, CONCAT(YEAR(b.start_time), '-W', LPAD(WEEK(b.start_time), 2, '0')) as period`;
        break;
      default: // day
        periodGroupBy = `DATE(b.start_time) as period`;
    }

    let query = `
      SELECT 
        ${periodGroupBy},
        COUNT(*) as total_breaks,
        COUNT(DISTINCT b.user_id) as unique_users,
        SUM(COALESCE(b.duration_minutes, TIMESTAMPDIFF(SECOND, b.start_time, COALESCE(b.end_time, NOW())) / 60.0)) as total_break_minutes,
        AVG(COALESCE(b.duration_minutes, TIMESTAMPDIFF(SECOND, b.start_time, COALESCE(b.end_time, NOW())) / 60.0)) as avg_break_minutes,
        COUNT(CASE WHEN b.end_time IS NULL THEN 1 END) as active_breaks
      FROM break_records b
      JOIN users u ON b.user_id = u.id
      JOIN categories c ON b.category_id = c.id
      WHERE 1=1
    `;

    const params = [];

    if (targetUserId) {
      query += ' AND b.user_id = ?';
      params.push(targetUserId);
    }

    if (startDate) {
      query += ' AND DATE(b.start_time) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND DATE(b.start_time) <= ?';
      params.push(endDate);
    }

    // Group by period
    if (period === 'year') {
      query += ' GROUP BY YEAR(b.start_time)';
      query += ' ORDER BY YEAR(b.start_time) DESC';
    } else if (period === 'month') {
      query += ' GROUP BY YEAR(b.start_time), MONTH(b.start_time)';
      query += ' ORDER BY YEAR(b.start_time) DESC, MONTH(b.start_time) DESC';
    } else if (period === 'week') {
      query += ' GROUP BY YEAR(b.start_time), WEEK(b.start_time)';
      query += ' ORDER BY YEAR(b.start_time) DESC, WEEK(b.start_time) DESC';
    } else {
      query += ' GROUP BY DATE(b.start_time)';
      query += ' ORDER BY DATE(b.start_time) DESC';
    }

    const stats = await db.query(query, params);
    
    // Format the period display
    const formattedStats = stats.map(stat => {
      let displayPeriod = stat.period;
      if (period === 'year') {
        displayPeriod = stat.year;
      } else if (period === 'month') {
        const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
        displayPeriod = `${monthNames[stat.month - 1]} ${stat.year}`;
      } else if (period === 'week') {
        displayPeriod = `KW${stat.week} ${stat.year}`;
      }
      
      return {
        ...stat,
        period: displayPeriod,
        total_break_hours: Math.round((stat.total_break_minutes / 60) * 100) / 100,
        avg_break_minutes: Math.round(stat.avg_break_minutes * 100) / 100
      };
    });

    console.log('Break stats result:', formattedStats);
    res.json(formattedStats);
  } catch (error) {
    console.error('Error in break stats:', error);
    logger.error('Error fetching break statistics:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch break statistics' });
  }
});

// GET /api/reports/activity-stats - Activity statistics
router.get('/activity-stats', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { 
      period = 'day',
      startDate,
      endDate,
      userId
    } = req.query;

    console.log('Activity stats request:', { period, startDate, endDate, userId });

    // Users can only see their own stats unless they're dispatcher/admin
    const targetUserId = req.user.role === 'employee' ? req.user.id : userId;

    const db = require('../config/database');
    let periodGroupBy;
    
    switch (period) {
      case 'year':
        periodGroupBy = `YEAR(ws.start_time) as year, '' as period`;
        break;
      case 'month':
        periodGroupBy = `YEAR(ws.start_time) as year, MONTH(ws.start_time) as month, CONCAT(YEAR(ws.start_time), '-', LPAD(MONTH(ws.start_time), 2, '0')) as period`;
        break;
      case 'week':
        periodGroupBy = `YEAR(ws.start_time) as year, WEEK(ws.start_time) as week, CONCAT(YEAR(ws.start_time), '-W', LPAD(WEEK(ws.start_time), 2, '0')) as period`;
        break;
      default: // day
        periodGroupBy = `DATE(ws.start_time) as period`;
    }

    let query = `
      SELECT 
        ${periodGroupBy},
        COUNT(*) as total_activities,
        COUNT(DISTINCT ws.user_id) as unique_users,
        COUNT(DISTINCT ws.category_id) as unique_categories,
        SUM(COALESCE(ws.duration_minutes, TIMESTAMPDIFF(SECOND, ws.start_time, COALESCE(ws.end_time, NOW())) / 60.0)) as total_activity_minutes,
        AVG(COALESCE(ws.duration_minutes, TIMESTAMPDIFF(SECOND, ws.start_time, COALESCE(ws.end_time, NOW())) / 60.0)) as avg_activity_minutes,
        COUNT(CASE WHEN ws.end_time IS NULL THEN 1 END) as active_activities,
        GROUP_CONCAT(DISTINCT c.name SEPARATOR ', ') as category_names
      FROM work_sessions ws
      JOIN users u ON ws.user_id = u.id
      LEFT JOIN categories c ON ws.category_id = c.id
      WHERE ws.work_order_id IS NULL AND 1=1
    `;

    const params = [];

    if (targetUserId) {
      query += ' AND ws.user_id = ?';
      params.push(targetUserId);
    }

    if (startDate) {
      query += ' AND DATE(ws.start_time) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND DATE(ws.start_time) <= ?';
      params.push(endDate);
    }

    // Group by period
    if (period === 'year') {
      query += ' GROUP BY YEAR(ws.start_time)';
      query += ' ORDER BY YEAR(ws.start_time) DESC';
    } else if (period === 'month') {
      query += ' GROUP BY YEAR(ws.start_time), MONTH(ws.start_time)';
      query += ' ORDER BY YEAR(ws.start_time) DESC, MONTH(ws.start_time) DESC';
    } else if (period === 'week') {
      query += ' GROUP BY YEAR(ws.start_time), WEEK(ws.start_time)';
      query += ' ORDER BY YEAR(ws.start_time) DESC, WEEK(ws.start_time) DESC';
    } else {
      query += ' GROUP BY DATE(ws.start_time)';
      query += ' ORDER BY DATE(ws.start_time) DESC';
    }

    const stats = await db.query(query, params);
    
    // Format the period display
    const formattedStats = stats.map(stat => {
      let displayPeriod = stat.period;
      if (period === 'year') {
        displayPeriod = stat.year;
      } else if (period === 'month') {
        const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
        displayPeriod = `${monthNames[stat.month - 1]} ${stat.year}`;
      } else if (period === 'week') {
        displayPeriod = `KW${stat.week} ${stat.year}`;
      }
      
      return {
        ...stat,
        period: displayPeriod,
        total_activity_hours: Math.round((stat.total_activity_minutes / 60) * 100) / 100,
        avg_activity_minutes: Math.round(stat.avg_activity_minutes * 100) / 100
      };
    });

    console.log('Activity stats result:', formattedStats);
    res.json(formattedStats);
  } catch (error) {
    console.error('Error in activity stats:', error);
    logger.error('Error fetching activity statistics:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch activity statistics' });
  }
});

// GET /api/reports/detailed-daily - Detailed daily activity report
router.get('/detailed-daily', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { 
      date,
      userId
    } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    // Users can only see their own data unless they're dispatcher/admin
    const targetUserId = req.user.role === 'employee' ? req.user.id : userId;

    if (!targetUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const db = require('../config/database');

    // Get attendance record for the day
    const attendanceQuery = `
      SELECT 
        ar.id,
        ar.clock_in,
        ar.clock_out,
        ar.total_time_minutes,
        u.first_name,
        u.last_name,
        u.employee_number
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      WHERE ar.user_id = ? AND DATE(ar.clock_in) = ?
      ORDER BY ar.clock_in DESC
      LIMIT 1
    `;
    
    const attendanceRecords = await db.query(attendanceQuery, [targetUserId, date]);
    const attendance = attendanceRecords[0] || null;

    // Get all breaks for the day
    const breaksQuery = `
      SELECT 
        br.id,
        br.start_time,
        br.end_time,
        br.duration_minutes,
        br.notes,
        c.name as category_name,
        c.type as category_type,
        c.color as category_color,
        c.is_productive
      FROM break_records br
      JOIN categories c ON br.category_id = c.id
      WHERE br.user_id = ? AND DATE(br.start_time) = ?
      ORDER BY br.start_time ASC
    `;
    
    const breaks = await db.query(breaksQuery, [targetUserId, date]);

    // Get all work sessions for the day
    const workSessionsQuery = `
      SELECT 
        ws.id,
        ws.start_time,
        ws.end_time,
        ws.duration_minutes,
        ws.task_description,
        ws.notes,
        ws.is_billable,
        ws.hourly_rate,
        ws.cost,
        wo.order_number,
        wo.description as order_description,
        c.name as category_name,
        c.type as category_type,
        c.color as category_color,
        c.is_productive
      FROM work_sessions ws
      LEFT JOIN work_orders wo ON ws.work_order_id = wo.id
      LEFT JOIN categories c ON ws.category_id = c.id
      WHERE ws.user_id = ? AND DATE(ws.start_time) = ?
      ORDER BY ws.start_time ASC
    `;
    
    const workSessions = await db.query(workSessionsQuery, [targetUserId, date]);

    // Calculate productivity metrics
    const totalWorkMinutes = workSessions.reduce((sum, ws) => {
      const duration = ws.duration_minutes || 
        (ws.end_time ? (new Date(ws.end_time) - new Date(ws.start_time)) / 60000 : 0);
      return sum + duration;
    }, 0);

    const productiveWorkMinutes = workSessions.reduce((sum, ws) => {
      if (ws.is_productive === false) return sum;
      const duration = ws.duration_minutes || 
        (ws.end_time ? (new Date(ws.end_time) - new Date(ws.start_time)) / 60000 : 0);
      return sum + duration;
    }, 0);

    const nonProductiveWorkMinutes = totalWorkMinutes - productiveWorkMinutes;

    const totalBreakMinutes = breaks.reduce((sum, br) => {
      const duration = br.duration_minutes || 
        (br.end_time ? (new Date(br.end_time) - new Date(br.start_time)) / 60000 : 0);
      return sum + duration;
    }, 0);

    const productiveBreakMinutes = breaks.reduce((sum, br) => {
      if (br.is_productive === false) return sum;
      const duration = br.duration_minutes || 
        (br.end_time ? (new Date(br.end_time) - new Date(br.start_time)) / 60000 : 0);
      return sum + duration;
    }, 0);

    const nonProductiveBreakMinutes = totalBreakMinutes - productiveBreakMinutes;

    // Create timeline entries
    const timelineEntries = [];
    
    if (attendance && attendance.clock_in) {
      timelineEntries.push({
        time: attendance.clock_in,
        type: 'clock_in',
        description: 'Arbeitsbeginn',
        category: 'attendance',
        color: '#10b981'
      });
    }

    breaks.forEach(br => {
      timelineEntries.push({
        time: br.start_time,
        type: 'break_start',
        description: `${br.category_name} - Start`,
        category: br.category_type,
        color: br.category_color,
        duration: br.duration_minutes,
        notes: br.notes,
        is_productive: br.is_productive,
        end_time: br.end_time
      });
      
      if (br.end_time) {
        timelineEntries.push({
          time: br.end_time,
          type: 'break_end',
          description: `${br.category_name} - Ende`,
          category: br.category_type,
          color: br.category_color,
          duration: br.duration_minutes,
          is_productive: br.is_productive
        });
      }
    });

    workSessions.forEach(ws => {
      timelineEntries.push({
        time: ws.start_time,
        type: 'work_start',
        description: ws.order_number ? 
          `Auftrag ${ws.order_number} - Start` : 
          `${ws.category_name || 'Arbeit'} - Start`,
        category: ws.category_type || 'work',
        color: ws.category_color || '#3b82f6',
        duration: ws.duration_minutes,
        notes: ws.notes,
        task_description: ws.task_description,
        order_number: ws.order_number,
        order_description: ws.order_description,
        is_billable: ws.is_billable,
        cost: ws.cost,
        is_productive: ws.is_productive,
        end_time: ws.end_time
      });
      
      if (ws.end_time) {
        timelineEntries.push({
          time: ws.end_time,
          type: 'work_end',
          description: ws.order_number ? 
            `Auftrag ${ws.order_number} - Ende` : 
            `${ws.category_name || 'Arbeit'} - Ende`,
          category: ws.category_type || 'work',
          color: ws.category_color || '#3b82f6',
          duration: ws.duration_minutes,
          is_billable: ws.is_billable,
          cost: ws.cost,
          is_productive: ws.is_productive
        });
      }
    });

    if (attendance && attendance.clock_out) {
      timelineEntries.push({
        time: attendance.clock_out,
        type: 'clock_out',
        description: 'Arbeitsende',
        category: 'attendance',
        color: '#ef4444'
      });
    }

    // Sort timeline by time
    timelineEntries.sort((a, b) => new Date(a.time) - new Date(b.time));

    const result = {
      date,
      user: attendance ? {
        first_name: attendance.first_name,
        last_name: attendance.last_name,
        employee_number: attendance.employee_number
      } : null,
      attendance,
      breaks,
      workSessions,
      timeline: timelineEntries,
      summary: {
        totalWorkMinutes,
        productiveWorkMinutes,
        nonProductiveWorkMinutes,
        totalBreakMinutes,
        productiveBreakMinutes,
        nonProductiveBreakMinutes,
        totalAttendanceMinutes: attendance ? attendance.total_time_minutes : 0,
        productivityPercentage: totalWorkMinutes > 0 ? 
          Math.round((productiveWorkMinutes / totalWorkMinutes) * 100) : 0,
        breakCount: breaks.length,
        workSessionCount: workSessions.length,
        billableMinutes: workSessions.reduce((sum, ws) => {
          if (!ws.is_billable) return sum;
          const duration = ws.duration_minutes || 0;
          return sum + duration;
        }, 0),
        totalCost: workSessions.reduce((sum, ws) => sum + (ws.cost || 0), 0)
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Error in detailed daily report:', error);
    logger.error('Error fetching detailed daily report:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch detailed daily report' });
  }
});

// GET /api/reports/overview-dashboard - Complete overview dashboard
router.get('/overview-dashboard', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const {
      period = 'week',
      startDate,
      endDate,
      userId
    } = req.query;

    // Users can only see their own stats unless they're dispatcher/admin
    const targetUserId = req.user.role === 'employee' ? req.user.id : userId;

    const db = require('../config/database');
    
    // Build date conditions
    const params = [];
    let userCondition = '';
    let dateWhere = '';
    
    if (targetUserId) {
      userCondition = 'AND user_id = ?';
      params.push(targetUserId);
    }
    
    if (startDate && endDate) {
      dateWhere = 'DATE(start_time) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else {
      // Default date ranges based on period
      const now = new Date();
      let defaultStart;
      
      switch (period) {
        case 'today':
          defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          defaultStart = new Date(now);
          defaultStart.setDate(now.getDate() - now.getDay());
          break;
        case 'month':
          defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          defaultStart = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          defaultStart = new Date(now);
          defaultStart.setDate(now.getDate() - 7);
      }
      
      dateWhere = 'start_time >= ?';
      params.push(defaultStart.toISOString().split('T')[0]);
    }

    // 1. Work Sessions Statistics
    const workStatsQuery = `
      SELECT 
        COUNT(*) as total_work_sessions,
        COALESCE(SUM(duration_minutes), 0) as total_work_minutes,
        COUNT(DISTINCT work_order_id) as unique_work_orders,
        COUNT(DISTINCT user_id) as active_users,
        COALESCE(SUM(CASE WHEN is_billable = 1 THEN duration_minutes END), 0) as billable_minutes,
        COALESCE(SUM(cost), 0) as total_revenue
      FROM work_sessions 
      WHERE ${dateWhere} ${userCondition}
    `;

    // 2. Break Statistics  
    const breakStatsQuery = `
      SELECT 
        COUNT(*) as total_breaks,
        COALESCE(SUM(duration_minutes), 0) as total_break_minutes
      FROM break_records 
      WHERE ${dateWhere} ${userCondition}
    `;

    // 3. Attendance Statistics
    const attendanceStatsQuery = `
      SELECT 
        COUNT(*) as total_attendance_records,
        COALESCE(SUM(total_time_minutes), 0) as total_attendance_minutes,
        COALESCE(AVG(total_time_minutes), 0) as avg_attendance_minutes
      FROM attendance_records 
      WHERE ${dateWhere.replace('start_time', 'clock_in')} ${userCondition}
    `;

    // Execute simplified queries
    try {
      const [workStats] = await db.query(workStatsQuery, params);
      const [breakStats] = await db.query(breakStatsQuery, params);
      const [attendanceStats] = await db.query(attendanceStatsQuery, params);
      
      // Simple productivity query
      const productivityQuery = `
        SELECT 
          COALESCE(SUM(CASE WHEN COALESCE(c.is_productive, 1) = 1 THEN ws.duration_minutes END), 0) as productive_work_minutes,
          COALESCE(SUM(CASE WHEN COALESCE(c.is_productive, 1) = 0 THEN ws.duration_minutes END), 0) as non_productive_work_minutes
        FROM work_sessions ws
        LEFT JOIN categories c ON ws.category_id = c.id
        WHERE ${dateWhere} ${userCondition}
      `;
      const [productivityStats] = await db.query(productivityQuery, params);
      
      // Simple top performers for admin
      let topPerformers = [];
      if (req.user.role !== 'employee') {
        const topPerformersQuery = `
          SELECT 
            u.id, u.first_name, u.last_name, u.employee_number,
            COALESCE(SUM(ws.duration_minutes), 0) as total_work_minutes,
            COUNT(DISTINCT ws.work_order_id) as orders_worked,
            COALESCE(SUM(ws.cost), 0) as revenue_generated
          FROM users u
          LEFT JOIN work_sessions ws ON u.id = ws.user_id AND ${dateWhere} ${userCondition.replace('user_id', 'ws.user_id')}
          WHERE u.is_active = 1
          GROUP BY u.id, u.first_name, u.last_name, u.employee_number
          HAVING total_work_minutes > 0
          ORDER BY total_work_minutes DESC
          LIMIT 10
        `;
        topPerformers = await db.query(topPerformersQuery, params);
      }
      
      // Simple daily trends
      const dailyTrendsQuery = `
        SELECT 
          DATE(start_time) as date,
          SUM(duration_minutes) as work_minutes,
          COUNT(DISTINCT user_id) as active_workers,
          COUNT(DISTINCT work_order_id) as active_orders
        FROM work_sessions
        WHERE ${dateWhere} ${userCondition}
        GROUP BY DATE(start_time)
        ORDER BY DATE(start_time) DESC
        LIMIT 14
      `;
      const dailyTrends = await db.query(dailyTrendsQuery, params);
      
      // Simple category breakdown
      const categoryStatsQuery = `
        SELECT 
          c.name, c.type, c.color, c.is_productive,
          COUNT(ws.id) as work_sessions,
          COALESCE(SUM(ws.duration_minutes), 0) as work_minutes
        FROM categories c
        LEFT JOIN work_sessions ws ON c.id = ws.category_id AND ${dateWhere} ${userCondition.replace('user_id', 'ws.user_id')}
        WHERE c.is_active = 1
        GROUP BY c.id, c.name, c.type, c.color, c.is_productive
        HAVING work_sessions > 0
        ORDER BY work_minutes DESC
      `;
      const categoryStats = await db.query(categoryStatsQuery, params);

      // Calculate derived metrics
      const totalMinutes = (workStats.total_work_minutes || 0) + (breakStats.total_break_minutes || 0);
      const productiveMinutes = (productivityStats.productive_work_minutes || 0);
      
      const result = {
        period,
        startDate: startDate || null,
        endDate: endDate || null,
        userId: targetUserId,
        
        summary: {
          totalUsers: workStats.active_users || 0,
          totalAttendanceRecords: attendanceStats.total_attendance_records || 0,
          totalAttendanceHours: Math.round((attendanceStats.total_attendance_minutes || 0) / 60 * 100) / 100,
          avgAttendanceHours: Math.round((attendanceStats.avg_attendance_minutes || 0) / 60 * 100) / 100,
          totalWorkSessions: workStats.total_work_sessions || 0,
          totalWorkHours: Math.round((workStats.total_work_minutes || 0) / 60 * 100) / 100,
          totalBreaks: breakStats.total_breaks || 0,
          totalBreakHours: Math.round((breakStats.total_break_minutes || 0) / 60 * 100) / 100,
          uniqueWorkOrders: workStats.unique_work_orders || 0,
          billableHours: Math.round((workStats.billable_minutes || 0) / 60 * 100) / 100,
          totalRevenue: workStats.total_revenue || 0,
          
          // Productivity metrics
          totalHours: Math.round(totalMinutes / 60 * 100) / 100,
          productiveHours: Math.round(productiveMinutes / 60 * 100) / 100,
          productivityPercentage: totalMinutes > 0 ? Math.round((productiveMinutes / totalMinutes) * 100) : 0,
          
          // Ratios
          workToBreakRatio: breakStats.total_break_minutes > 0 ? 
            Math.round((workStats.total_work_minutes / breakStats.total_break_minutes) * 100) / 100 : 0,
          billabilityPercentage: workStats.total_work_minutes > 0 ? 
            Math.round((workStats.billable_minutes / workStats.total_work_minutes) * 100) : 0,
          avgRevenuePerHour: workStats.total_work_minutes > 0 ? 
            Math.round((workStats.total_revenue / (workStats.total_work_minutes / 60)) * 100) / 100 : 0
        },
        
        topPerformers: topPerformers.map(performer => ({
          ...performer,
          totalWorkHours: Math.round((performer.total_work_minutes || 0) / 60 * 100) / 100,
          productivityPercentage: performer.total_work_minutes > 0 ? 
            Math.round(((performer.productive_minutes || performer.total_work_minutes) / performer.total_work_minutes) * 100) : 0,
          avgRevenuePerHour: performer.total_work_minutes > 0 ? 
            Math.round((performer.revenue_generated / (performer.total_work_minutes / 60)) * 100) / 100 : 0
        })),
        
        workOrderStats: {},
        
        categoryBreakdown: categoryStats.map(cat => ({
          name: cat.name,
          type: cat.type,
          color: cat.color,
          isProductive: cat.is_productive,
          workSessions: cat.work_sessions || 0,
          workHours: Math.round((cat.work_minutes || 0) / 60 * 100) / 100,
          breakSessions: 0,
          breakHours: 0,
          totalHours: Math.round((cat.work_minutes || 0) / 60 * 100) / 100
        })),
        
        dailyTrends: dailyTrends.map(trend => ({
          date: trend.date,
          workHours: Math.round((trend.work_minutes || 0) / 60 * 100) / 100,
          breakHours: 0,
          attendanceHours: 0,
          activeWorkers: trend.active_workers || 0,
          activeOrders: trend.active_orders || 0
        }))
      };

      res.json(result);
    } catch (queryError) {
      console.error('Query execution error:', queryError);
      throw queryError;
    }
  } catch (error) {
    console.error('Error in overview dashboard:', error);
    logger.error('Error fetching overview dashboard:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch overview dashboard' });
  }
});

// GET /api/reports/productivity-overview - Productivity overview
router.get('/productivity-overview', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const {
      period = 'week',
      startDate,
      endDate,
      userId
    } = req.query;

    // Users can only see their own stats unless they're dispatcher/admin
    const targetUserId = req.user.role === 'employee' ? req.user.id : userId;

    const db = require('../config/database');
    
    // Base date conditions
    let dateCondition = '1=1';
    const params = [];
    
    if (targetUserId) {
      dateCondition += ' AND user_id = ?';
      params.push(targetUserId);
    }
    
    if (startDate && endDate) {
      dateCondition += ' AND DATE(start_time) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else {
      // Default to last 30 days
      dateCondition += ' AND start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    // Work sessions productivity
    const workProductivityQuery = `
      SELECT 
        DATE(ws.start_time) as date,
        COUNT(*) as total_sessions,
        SUM(COALESCE(ws.duration_minutes, TIMESTAMPDIFF(MINUTE, ws.start_time, COALESCE(ws.end_time, NOW())))) as total_minutes,
        SUM(CASE WHEN COALESCE(c.is_productive, 1) = 1 THEN COALESCE(ws.duration_minutes, TIMESTAMPDIFF(MINUTE, ws.start_time, COALESCE(ws.end_time, NOW()))) ELSE 0 END) as productive_minutes,
        SUM(CASE WHEN COALESCE(c.is_productive, 1) = 0 THEN COALESCE(ws.duration_minutes, TIMESTAMPDIFF(MINUTE, ws.start_time, COALESCE(ws.end_time, NOW()))) ELSE 0 END) as non_productive_minutes,
        SUM(CASE WHEN ws.is_billable = 1 THEN COALESCE(ws.duration_minutes, TIMESTAMPDIFF(MINUTE, ws.start_time, COALESCE(ws.end_time, NOW()))) ELSE 0 END) as billable_minutes,
        SUM(COALESCE(ws.cost, 0)) as total_cost,
        COUNT(DISTINCT ws.work_order_id) as unique_orders
      FROM work_sessions ws
      LEFT JOIN categories c ON ws.category_id = c.id
      WHERE ${dateCondition}
      GROUP BY DATE(ws.start_time)
      ORDER BY DATE(ws.start_time) DESC
    `;

    const workProductivity = await db.query(workProductivityQuery, params);

    // Break productivity
    const breakProductivityQuery = `
      SELECT 
        DATE(br.start_time) as date,
        COUNT(*) as total_breaks,
        SUM(COALESCE(br.duration_minutes, TIMESTAMPDIFF(MINUTE, br.start_time, COALESCE(br.end_time, NOW())))) as total_break_minutes,
        SUM(CASE WHEN COALESCE(c.is_productive, 0) = 1 THEN COALESCE(br.duration_minutes, TIMESTAMPDIFF(MINUTE, br.start_time, COALESCE(br.end_time, NOW()))) ELSE 0 END) as productive_break_minutes,
        SUM(CASE WHEN COALESCE(c.is_productive, 0) = 0 THEN COALESCE(br.duration_minutes, TIMESTAMPDIFF(MINUTE, br.start_time, COALESCE(br.end_time, NOW()))) ELSE 0 END) as non_productive_break_minutes,
        GROUP_CONCAT(DISTINCT c.name SEPARATOR ', ') as break_categories
      FROM break_records br
      LEFT JOIN categories c ON br.category_id = c.id
      WHERE ${dateCondition.replace('start_time', 'br.start_time').replace('user_id', 'br.user_id')}
      GROUP BY DATE(br.start_time)
      ORDER BY DATE(br.start_time) DESC
    `;

    const breakProductivity = await db.query(breakProductivityQuery, params);

    // Merge data by date
    const dateMap = new Map();
    
    workProductivity.forEach(wp => {
      dateMap.set(wp.date, {
        date: wp.date,
        work: wp,
        breaks: null
      });
    });
    
    breakProductivity.forEach(bp => {
      const existing = dateMap.get(bp.date);
      if (existing) {
        existing.breaks = bp;
      } else {
        dateMap.set(bp.date, {
          date: bp.date,
          work: null,
          breaks: bp
        });
      }
    });

    const dailyData = Array.from(dateMap.values()).map(day => {
      const work = day.work || {
        total_sessions: 0,
        total_minutes: 0,
        productive_minutes: 0,
        non_productive_minutes: 0,
        billable_minutes: 0,
        total_cost: 0,
        unique_orders: 0
      };
      
      const breaks = day.breaks || {
        total_breaks: 0,
        total_break_minutes: 0,
        productive_break_minutes: 0,
        non_productive_break_minutes: 0,
        break_categories: ''
      };

      const totalMinutes = work.total_minutes + breaks.total_break_minutes;
      const totalProductiveMinutes = work.productive_minutes + breaks.productive_break_minutes;
      const totalNonProductiveMinutes = work.non_productive_minutes + breaks.non_productive_break_minutes;

      return {
        date: day.date,
        work,
        breaks,
        combined: {
          totalMinutes,
          totalProductiveMinutes,
          totalNonProductiveMinutes,
          productivityPercentage: totalMinutes > 0 ? 
            Math.round((totalProductiveMinutes / totalMinutes) * 100) : 0,
          workPercentage: totalMinutes > 0 ? 
            Math.round((work.total_minutes / totalMinutes) * 100) : 0,
          breakPercentage: totalMinutes > 0 ? 
            Math.round((breaks.total_break_minutes / totalMinutes) * 100) : 0
        }
      };
    });

    // Calculate totals
    const totals = dailyData.reduce((acc, day) => {
      acc.totalWorkMinutes += day.work.total_minutes || 0;
      acc.totalProductiveWorkMinutes += day.work.productive_minutes || 0;
      acc.totalNonProductiveWorkMinutes += day.work.non_productive_minutes || 0;
      acc.totalBreakMinutes += day.breaks.total_break_minutes || 0;
      acc.totalProductiveBreakMinutes += day.breaks.productive_break_minutes || 0;
      acc.totalNonProductiveBreakMinutes += day.breaks.non_productive_break_minutes || 0;
      acc.totalBillableMinutes += day.work.billable_minutes || 0;
      acc.totalCost += day.work.total_cost || 0;
      acc.totalSessions += day.work.total_sessions || 0;
      acc.totalBreaks += day.breaks.total_breaks || 0;
      acc.uniqueOrders += day.work.unique_orders || 0;
      return acc;
    }, {
      totalWorkMinutes: 0,
      totalProductiveWorkMinutes: 0,
      totalNonProductiveWorkMinutes: 0,
      totalBreakMinutes: 0,
      totalProductiveBreakMinutes: 0,
      totalNonProductiveBreakMinutes: 0,
      totalBillableMinutes: 0,
      totalCost: 0,
      totalSessions: 0,
      totalBreaks: 0,
      uniqueOrders: 0
    });

    const totalAllMinutes = totals.totalWorkMinutes + totals.totalBreakMinutes;
    const totalProductiveMinutes = totals.totalProductiveWorkMinutes + totals.totalProductiveBreakMinutes;
    const totalNonProductiveMinutes = totals.totalNonProductiveWorkMinutes + totals.totalNonProductiveBreakMinutes;

    totals.overallProductivityPercentage = totalAllMinutes > 0 ? 
      Math.round((totalProductiveMinutes / totalAllMinutes) * 100) : 0;
    
    totals.workTimePercentage = totalAllMinutes > 0 ? 
      Math.round((totals.totalWorkMinutes / totalAllMinutes) * 100) : 0;
    
    totals.breakTimePercentage = totalAllMinutes > 0 ? 
      Math.round((totals.totalBreakMinutes / totalAllMinutes) * 100) : 0;

    res.json({
      period,
      startDate,
      endDate,
      userId: targetUserId,
      dailyData: dailyData.sort((a, b) => new Date(b.date) - new Date(a.date)),
      totals
    });
  } catch (error) {
    console.error('Error in productivity overview:', error);
    logger.error('Error fetching productivity overview:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch productivity overview' });
  }
});

// GET /api/reports/kpi-summary - Key Performance Indicators
router.get('/kpi-summary', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const {
      period = 'week',
      startDate,
      endDate,
      userId
    } = req.query;

    // Users can only see their own stats unless they're dispatcher/admin
    const targetUserId = req.user.role === 'employee' ? req.user.id : userId;

    const db = require('../config/database');
    
    // Calculate date range
    let dateFilter = '';
    const params = [];
    
    if (startDate && endDate) {
      dateFilter = 'DATE(start_time) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else {
      // Default to current period
      const now = new Date();
      let start;
      
      switch (period) {
        case 'today':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          start = new Date(now);
          start.setDate(now.getDate() - now.getDay());
          break;
        case 'month':
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          start = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          start = new Date(now);
          start.setDate(now.getDate() - 7);
      }
      
      dateFilter = 'start_time >= ?';
      params.push(start.toISOString());
    }

    if (targetUserId) {
      dateFilter += ' AND user_id = ?';
      params.push(targetUserId);
    }

    // Simplified KPI Queries
    const workKpiQuery = `
      SELECT 
        COUNT(*) as work_sessions,
        COALESCE(SUM(duration_minutes), 0) as total_work_minutes,
        COALESCE(SUM(CASE WHEN COALESCE(c.is_productive, 1) = 1 THEN duration_minutes END), 0) as productive_work_minutes,
        COALESCE(SUM(CASE WHEN is_billable = 1 THEN duration_minutes END), 0) as billable_minutes,
        COALESCE(SUM(cost), 0) as total_revenue,
        COALESCE(AVG(hourly_rate), 0) as avg_hourly_rate,
        COUNT(DISTINCT work_order_id) as unique_orders,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT DATE(start_time)) as active_days
      FROM work_sessions ws
      LEFT JOIN categories c ON ws.category_id = c.id
      WHERE ${dateFilter}
    `;
    
    const breakKpiQuery = `
      SELECT 
        COUNT(*) as break_sessions,
        COALESCE(SUM(duration_minutes), 0) as total_break_minutes,
        COALESCE(SUM(CASE WHEN COALESCE(c.is_productive, 0) = 1 THEN duration_minutes END), 0) as productive_break_minutes
      FROM break_records br
      LEFT JOIN categories c ON br.category_id = c.id
      WHERE ${dateFilter}
    `;
    
    const [workKpis] = await db.query(workKpiQuery, params);
    const [breakKpis] = await db.query(breakKpiQuery, params);
    
    // Combine KPI results
    const kpis = {
      work_sessions: workKpis.work_sessions || 0,
      total_work_minutes: workKpis.total_work_minutes || 0,
      productive_work_minutes: workKpis.productive_work_minutes || 0,
      billable_minutes: workKpis.billable_minutes || 0,
      total_revenue: workKpis.total_revenue || 0,
      avg_hourly_rate: workKpis.avg_hourly_rate || 0,
      unique_orders: workKpis.unique_orders || 0,
      unique_users: workKpis.unique_users || 0,
      active_days: workKpis.active_days || 0,
      break_sessions: breakKpis.break_sessions || 0,
      total_break_minutes: breakKpis.total_break_minutes || 0,
      productive_break_minutes: breakKpis.productive_break_minutes || 0
    };
    
    // Calculate derived metrics
    const totalMinutes = (kpis.total_work_minutes || 0) + (kpis.total_break_minutes || 0);
    const productiveMinutes = (kpis.productive_work_minutes || 0) + (kpis.productive_break_minutes || 0);
    
    const result = {
      period,
      dateRange: {
        start: startDate,
        end: endDate
      },
      
      // Time KPIs
      time: {
        totalHours: Math.round(totalMinutes / 60 * 100) / 100,
        workHours: Math.round((kpis.total_work_minutes || 0) / 60 * 100) / 100,
        breakHours: Math.round((kpis.total_break_minutes || 0) / 60 * 100) / 100,
        productiveHours: Math.round(productiveMinutes / 60 * 100) / 100,
        billableHours: Math.round((kpis.billable_minutes || 0) / 60 * 100) / 100,
        avgHoursPerDay: kpis.active_days > 0 ? Math.round((totalMinutes / 60 / kpis.active_days) * 100) / 100 : 0
      },
      
      // Productivity KPIs
      productivity: {
        overallPercentage: totalMinutes > 0 ? Math.round((productiveMinutes / totalMinutes) * 100) : 0,
        workProductivityPercentage: kpis.total_work_minutes > 0 ? 
          Math.round((kpis.productive_work_minutes / kpis.total_work_minutes) * 100) : 0,
        billabilityPercentage: kpis.total_work_minutes > 0 ? 
          Math.round((kpis.billable_minutes / kpis.total_work_minutes) * 100) : 0,
        workToBreakRatio: kpis.total_break_minutes > 0 ? 
          Math.round((kpis.total_work_minutes / kpis.total_break_minutes) * 100) / 100 : 0
      },
      
      // Financial KPIs
      financial: {
        totalRevenue: Math.round((kpis.total_revenue || 0) * 100) / 100,
        avgHourlyRate: Math.round((kpis.avg_hourly_rate || 0) * 100) / 100,
        revenuePerHour: kpis.total_work_minutes > 0 ? 
          Math.round(((kpis.total_revenue || 0) / (kpis.total_work_minutes / 60)) * 100) / 100 : 0,
        billableRevenue: Math.round(((kpis.billable_minutes || 0) / 60 * (kpis.avg_hourly_rate || 0)) * 100) / 100
      },
      
      // Activity KPIs
      activity: {
        workSessions: kpis.work_sessions || 0,
        breakSessions: kpis.break_sessions || 0,
        uniqueOrders: kpis.unique_orders || 0,
        uniqueUsers: kpis.unique_users || 0,
        activeDays: kpis.active_days || 0,
        avgSessionLength: kpis.work_sessions > 0 ? 
          Math.round(((kpis.total_work_minutes || 0) / kpis.work_sessions) * 100) / 100 : 0,
        avgBreakLength: kpis.break_sessions > 0 ? 
          Math.round(((kpis.total_break_minutes || 0) / kpis.break_sessions) * 100) / 100 : 0
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Error in KPI summary:', error);
    logger.error('Error fetching KPI summary:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch KPI summary' });
  }
});

module.exports = router;