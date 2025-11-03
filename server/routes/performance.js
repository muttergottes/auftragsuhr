const express = require('express');
const router = express.Router();
const { authenticateToken, requireAnyRole, kioskAuth } = require('../middleware/auth');
const logger = require('../config/logger');
const db = require('../config/database');

// GET /api/performance/individual - Individual Performance Dashboard
router.get('/individual', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { 
      period = 'week',
      startDate,
      endDate,
      userId
    } = req.query;

    // Users can only see their own stats unless they're dispatcher/admin
    const targetUserId = req.user.role === 'employee' ? req.user.id : (userId || req.user.id);

    const performance = await calculatePerformanceMetrics(targetUserId, { period, startDate, endDate });
    
    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    logger.error('Error fetching individual performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

// POST /api/performance/kiosk - Kiosk Performance (with employee credentials)
router.post('/kiosk', async (req, res) => {
  try {
    const { employeeNumber, pin } = req.body;
    
    if (!employeeNumber || !pin) {
      return res.status(400).json({ error: 'Employee number and PIN required' });
    }

    // Verify employee credentials
    const userQuery = 'SELECT * FROM users WHERE employee_number = ? AND pin = ? AND is_active = 1';
    const [users] = await db.query(userQuery, [employeeNumber, pin]);
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = users[0];
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's performance
    const todayPerformance = await calculatePerformanceMetrics(user.id, { 
      period: 'custom',
      startDate: today,
      endDate: today 
    });

    // Get week performance 
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekPerformance = await calculatePerformanceMetrics(user.id, {
      period: 'custom', 
      startDate: weekStart.toISOString().split('T')[0],
      endDate: today
    });

    // Get team ranking
    const teamRanking = await getTeamRanking('week');
    const userRank = teamRanking.findIndex(member => member.user_id === user.id) + 1;

    res.json({
      success: true,
      data: {
        today: todayPerformance,
        week: weekPerformance,
        teamRank: userRank,
        teamSize: teamRanking.length,
        teamAverage: teamRanking.reduce((sum, member) => sum + member.attendance_efficiency, 0) / teamRanking.length
      }
    });
  } catch (error) {
    logger.error('Error fetching kiosk performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
});

// Core function to calculate 2-stage performance metrics
async function calculatePerformanceMetrics(userId, options = {}) {
  const { period = 'week', startDate, endDate } = options;
  
  let queryStartDate, queryEndDate;
  
  if (startDate && endDate) {
    queryStartDate = startDate;
    queryEndDate = endDate;
  } else {
    const today = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    switch (period) {
      case 'today':
        queryStartDate = queryEndDate = formatDate(today);
        break;
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        queryStartDate = formatDate(weekStart);
        queryEndDate = formatDate(today);
        break;
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        queryStartDate = formatDate(monthStart);
        queryEndDate = formatDate(today);
        break;
    }
  }

  // STAGE 1: Attendance Efficiency
  const attendanceQuery = `
    SELECT 
      SUM(TIMESTAMPDIFF(MINUTE, clock_in, COALESCE(clock_out, NOW()))) as total_attendance_minutes,
      COUNT(*) as attendance_days
    FROM attendance_records 
    WHERE user_id = ? 
      AND DATE(clock_in) >= ? 
      AND DATE(clock_in) <= ?
  `;
  
  const [attendanceData] = await db.query(attendanceQuery, [userId, queryStartDate, queryEndDate]);

  // Get break time
  const breakQuery = `
    SELECT 
      SUM(TIMESTAMPDIFF(MINUTE, start_time, COALESCE(end_time, NOW()))) as total_break_minutes
    FROM break_records br
    WHERE br.user_id = ?
      AND DATE(br.start_time) >= ?
      AND DATE(br.start_time) <= ?
  `;
  
  const [breakData] = await db.query(breakQuery, [userId, queryStartDate, queryEndDate]);

  // STAGE 2: Work Productivity
  const workSessionQuery = `
    SELECT 
      SUM(TIMESTAMPDIFF(MINUTE, start_time, COALESCE(end_time, NOW()))) as total_work_minutes,
      SUM(CASE WHEN c.is_billable = 1 THEN TIMESTAMPDIFF(MINUTE, start_time, COALESCE(end_time, NOW())) ELSE 0 END) as billable_minutes,
      SUM(CASE WHEN c.is_billable = 0 THEN TIMESTAMPDIFF(MINUTE, start_time, COALESCE(end_time, NOW())) ELSE 0 END) as internal_minutes
    FROM work_sessions ws
    LEFT JOIN categories c ON ws.category_id = c.id
    WHERE ws.user_id = ?
      AND DATE(ws.start_time) >= ?
      AND DATE(ws.start_time) <= ?
  `;
  
  const [workData] = await db.query(workSessionQuery, [userId, queryStartDate, queryEndDate]);

  // Calculate metrics
  const totalAttendanceMinutes = attendanceData.total_attendance_minutes || 0;
  const totalBreakMinutes = breakData.total_break_minutes || 0;
  const totalWorkMinutes = workData.total_work_minutes || 0;
  const billableMinutes = workData.billable_minutes || 0;
  const internalMinutes = workData.internal_minutes || 0;

  // Calculated work time should match attendance - breaks
  const calculatedWorkMinutes = totalAttendanceMinutes - totalBreakMinutes;

  // STAGE 1: Attendance Efficiency = Work Time / Attendance Time
  const attendanceEfficiency = totalAttendanceMinutes > 0 
    ? (calculatedWorkMinutes / totalAttendanceMinutes) * 100 
    : 0;

  // STAGE 2: Work Productivity = Billable Time / Work Time  
  const workProductivity = calculatedWorkMinutes > 0
    ? (billableMinutes / calculatedWorkMinutes) * 100
    : 0;

  return {
    period,
    startDate: queryStartDate,
    endDate: queryEndDate,
    
    // Stage 1: Attendance
    totalAttendanceMinutes,
    totalBreakMinutes, 
    calculatedWorkMinutes,
    attendanceEfficiency: Math.round(attendanceEfficiency * 100) / 100,
    
    // Stage 2: Productivity
    totalWorkMinutes, // From work sessions
    billableMinutes,
    internalMinutes,
    workProductivity: Math.round(workProductivity * 100) / 100,
    
    // Additional metrics
    attendanceDays: attendanceData.attendance_days || 0,
    avgAttendancePerDay: attendanceData.attendance_days > 0 
      ? totalAttendanceMinutes / attendanceData.attendance_days 
      : 0
  };
}

// GET /api/performance/team-ranking - Team Performance for Operations Control
router.get('/team-ranking', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    // Only dispatcher/admin can see team data
    if (req.user.role === 'employee') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const rankings = await getTeamRanking(period);
    
    res.json({
      success: true,
      data: rankings
    });
  } catch (error) {
    logger.error('Error fetching team ranking:', error);
    res.status(500).json({ error: 'Failed to fetch team ranking' });
  }
});

// Get team ranking for comparison
async function getTeamRanking(period = 'week') {
  const today = new Date();
  const formatDate = (date) => date.toISOString().split('T')[0];
  
  let startDate, endDate;
  switch (period) {
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      startDate = formatDate(weekStart);
      endDate = formatDate(today);
      break;
    case 'month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      startDate = formatDate(monthStart);
      endDate = formatDate(today);
      break;
  }

  // Get all active users
  const usersQuery = `
    SELECT id, first_name, last_name, employee_number 
    FROM users 
    WHERE is_active = 1 AND role = 'employee'
  `;
  const users = await db.query(usersQuery);

  const rankings = [];
  
  for (const user of users) {
    try {
      const performance = await calculatePerformanceMetrics(user.id, { 
        period: 'custom', 
        startDate, 
        endDate 
      });
      
      rankings.push({
        user_id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        employee_number: user.employee_number,
        attendance_efficiency: performance.attendanceEfficiency,
        work_productivity: performance.workProductivity,
        total_attendance_minutes: performance.totalAttendanceMinutes,
        calculated_work_minutes: performance.calculatedWorkMinutes,
        billable_minutes: performance.billableMinutes,
        total_break_minutes: performance.totalBreakMinutes
      });
    } catch (error) {
      logger.error(`Error calculating performance for user ${user.id}:`, error);
    }
  }

  // Sort by attendance efficiency (primary) and productivity (secondary)
  return rankings.sort((a, b) => {
    if (Math.abs(a.attendance_efficiency - b.attendance_efficiency) < 1) {
      return b.work_productivity - a.work_productivity;
    }
    return b.attendance_efficiency - a.attendance_efficiency;
  });
}

module.exports = router;