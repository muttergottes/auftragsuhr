const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const WorkSession = require('../models/WorkSession');
const { authenticateToken, requireAnyRole, requireDispatcherOrAdmin, kioskAuth } = require('../middleware/auth');
const logger = require('../config/logger');

// GET /api/attendance/current - Get current attendance for logged-in user
router.get('/current', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const attendance = await Attendance.findActiveByUser(req.user.id);
    res.json(attendance ? attendance.toJSON() : null);
  } catch (error) {
    logger.error('Error fetching current attendance:', error);
    res.status(500).json({ error: 'Failed to fetch current attendance' });
  }
});

// GET /api/attendance/history - Get attendance history
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
    // Exception: admins/dispatchers can see any user's data
    let targetUserId;
    if (req.user.role === 'employee') {
      targetUserId = req.user.id; // Employees can only see their own data
    } else {
      targetUserId = userId || req.user.id; // Admins/dispatchers can see any user's data
    }

    console.log('Attendance request:', { userId, targetUserId, startDate, endDate, userRole: req.user.role });

    const attendance = await Attendance.findAll({
      userId: targetUserId,
      startDate,
      endDate,
      includeActive: includeActive === 'true',
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    console.log('Attendance results:', attendance.length, 'records');
    res.json(attendance.map(a => a.toJSON()));
  } catch (error) {
    logger.error('Error fetching attendance history:', error);
    res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
});

// GET /api/attendance/user/:userId - Get attendance for specific user (admin/dispatcher only)
router.get('/user/:userId', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const { startDate, endDate, limit = 50, offset = 0 } = req.query;

    const attendance = await Attendance.findAll({
      userId: req.params.userId,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json(attendance.map(a => a.toJSON()));
  } catch (error) {
    logger.error('Error fetching user attendance:', error);
    res.status(500).json({ error: 'Failed to fetch user attendance' });
  }
});

// POST /api/attendance/clock-in - Clock in
router.post('/clock-in', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { location, note } = req.body;

    const attendance = await Attendance.clockIn(req.user.id, {
      location,
      note,
      method: 'web',
      ip_address: req.ip
    });

    res.status(201).json(attendance.toJSON());
  } catch (error) {
    logger.error('Error clocking in:', error);
    
    if (error.message === 'User is already clocked in') {
      return res.status(409).json({ error: 'Bereits eingestempelt' });
    }
    
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

// POST /api/attendance/clock-out - Clock out
router.post('/clock-out', authenticateToken, requireAnyRole, async (req, res) => {
  try {
    const { location, note } = req.body;

    const attendance = await Attendance.clockOut(req.user.id, {
      location,
      note,
      method: 'web',
      ip_address: req.ip
    });

    res.json(attendance.toJSON());
  } catch (error) {
    logger.error('Error clocking out:', error);
    
    if (error.message === 'User is not clocked in') {
      return res.status(409).json({ error: 'Nicht eingestempelt' });
    }
    
    res.status(500).json({ error: 'Failed to clock out' });
  }
});

// POST /api/attendance/kiosk/clock-in - Kiosk clock in
router.post('/kiosk/clock-in', kioskAuth, async (req, res) => {
  try {
    const { location, note } = req.body;

    const attendance = await Attendance.clockIn(req.user.id, {
      location,
      note,
      method: 'kiosk',
      ip_address: req.ip
    });

    res.status(201).json({
      success: true,
      message: `Willkommen, ${req.user.first_name}!`,
      attendance: attendance.toJSON()
    });
  } catch (error) {
    logger.error('Error in kiosk clock-in:', error);
    
    if (error.message === 'User is already clocked in') {
      return res.status(409).json({ 
        success: false,
        error: `${req.user.first_name}, Sie sind bereits eingestempelt.` 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Fehler beim Einstempeln' 
    });
  }
});

// POST /api/attendance/kiosk/clock-out - Kiosk clock out
router.post('/kiosk/clock-out', kioskAuth, async (req, res) => {
  try {
    const { location, note } = req.body;

    // Check if user has active work sessions
    const activeWorkSession = await WorkSession.findActiveByUser(req.user.id);
    if (activeWorkSession) {
      return res.status(409).json({ 
        success: false,
        error: `${req.user.first_name}, Sie müssen zuerst Ihre aktive Arbeit beenden (${activeWorkSession.order_number || activeWorkSession.category_name}).` 
      });
    }

    const attendance = await Attendance.clockOut(req.user.id, {
      location,
      note,
      method: 'kiosk',
      ip_address: req.ip
    });

    const duration = Math.round(attendance.total_hours * 60); // Minutes
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;

    res.json({
      success: true,
      message: `Auf Wiedersehen, ${req.user.first_name}! Arbeitszeit: ${hours}h ${minutes}min`,
      attendance: attendance.toJSON()
    });
  } catch (error) {
    logger.error('Error in kiosk clock-out:', error);
    
    if (error.message === 'User is not clocked in') {
      return res.status(409).json({ 
        success: false,
        error: `${req.user.first_name}, Sie sind nicht eingestempelt.` 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Fehler beim Ausstempeln' 
    });
  }
});

// POST /api/attendance/kiosk/current - Get current attendance for kiosk user
router.post('/kiosk/current', kioskAuth, async (req, res) => {
  try {
    const attendance = await Attendance.findActiveByUser(req.user.id);
    res.json({
      success: true,
      data: attendance ? attendance.toJSON() : null
    });
  } catch (error) {
    logger.error('Error fetching kiosk current attendance:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch current attendance' 
    });
  }
});

// POST /api/attendance/kiosk/today - Get today's attendance summary for kiosk user
router.post('/kiosk/today', kioskAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Simplified query for today's attendance
    const query = `
      SELECT * FROM attendance_records 
      WHERE user_id = ? AND DATE(clock_in) = ?
      ORDER BY clock_in DESC
    `;
    
    const db = require('../config/database');
    const attendance = await db.query(query, [req.user.id, today]);

    res.json({
      success: true,
      data: attendance || []
    });
  } catch (error) {
    logger.error('Error fetching kiosk today attendance:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch today attendance' 
    });
  }
});

// PUT /api/attendance/:id - Update attendance (admin only)
router.put('/:id', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const attendanceId = req.params.id;
    const updateData = req.body;

    console.log('=== ATTENDANCE UPDATE DEBUG ===');
    console.log('ID:', attendanceId);
    console.log('Update data:', updateData);

    const updatedAttendance = await Attendance.update(attendanceId, updateData);

    console.log('Updated attendance:', updatedAttendance);
    res.json(updatedAttendance.toJSON());
  } catch (error) {
    console.log('=== ATTENDANCE UPDATE ERROR ===');
    console.log('Error details:', error);
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    logger.error('Error updating attendance:', error);
    res.status(500).json({ error: 'Failed to update attendance' });
  }
});

// DELETE /api/attendance/:id - Delete attendance (admin only)
router.delete('/:id', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    await Attendance.delete(req.params.id);
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    logger.error('Error deleting attendance:', error);
    res.status(500).json({ error: 'Failed to delete attendance record' });
  }
});

// GET /api/attendance/summary/daily/:userId/:date - Daily summary
router.get('/summary/daily/:userId/:date', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const { userId, date } = req.params;
    const summary = await Attendance.getDailySummary(userId, date);
    res.json(summary);
  } catch (error) {
    logger.error('Error fetching daily summary:', error);
    res.status(500).json({ error: 'Failed to fetch daily summary' });
  }
});

// GET /api/attendance/summary/weekly/:userId - Weekly summary
router.get('/summary/weekly/:userId', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const summary = await Attendance.getWeeklySummary(userId, startDate, endDate);
    res.json(summary);
  } catch (error) {
    logger.error('Error fetching weekly summary:', error);
    res.status(500).json({ error: 'Failed to fetch weekly summary' });
  }
});

// GET /api/attendance/active - Get all currently active attendances (public access for terminals)
router.get('/active', async (req, res) => {
  try {
    const activeAttendances = await Attendance.getAllActive();
    res.json(activeAttendances.map(a => a.toJSON()));
  } catch (error) {
    logger.error('Error fetching active attendances:', error);
    res.status(500).json({ error: 'Failed to fetch active attendances' });
  }
});

module.exports = router;