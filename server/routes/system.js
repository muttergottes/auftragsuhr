const express = require('express');
const Category = require('../models/Category');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'System endpoint' });
});

// GET /api/system/free-work-categories - Get free work categories for kiosk (no auth required)
router.get('/free-work-categories', async (req, res) => {
  try {
    const categories = await Category.findAll({ 
      type: 'work', 
      active: 1,
      is_productive: 1 
    });
    
    res.json({ 
      data: categories,
      message: 'Freie Arbeitskategorien erfolgreich geladen'
    });
  } catch (error) {
    console.error('Error fetching free work categories:', error);
    res.status(500).json({ error: 'Fehler beim Laden der freien Arbeitskategorien' });
  }
});

// POST /api/system/user-status - Get user status by employee number (no auth required)
router.post('/user-status', async (req, res) => {
  try {
    const { employeeNumber } = req.body;
    
    if (!employeeNumber) {
      return res.status(400).json({ error: 'Personalnummer erforderlich' });
    }

    // Find user by employee number
    const db = require('../config/database');
    const userResults = await db.query(
      'SELECT * FROM users WHERE employee_number = ? AND is_active = 1',
      [employeeNumber]
    );
    const users = Array.isArray(userResults) ? userResults : (userResults[0] || []);

    if (users.length === 0) {
      return res.status(404).json({ error: 'Personalnummer nicht gefunden' });
    }

    const user = users[0];
    
    // Get current status
    const Attendance = require('../models/Attendance');
    const WorkSession = require('../models/WorkSession');
    const Break = require('../models/Break');
    
    const [attendance, workSession, breakRecord] = await Promise.all([
      Attendance.findActiveByUser(user.id),
      WorkSession.findActiveByUser(user.id), 
      Break.findActiveByUser(user.id)
    ]);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          employeeNumber: user.employee_number,
          firstName: user.first_name,
          lastName: user.last_name
        },
        status: {
          isPresent: !!attendance,
          hasActiveJob: !!workSession,
          hasActiveBreak: !!breakRecord,
          attendance: attendance ? {
            clockIn: attendance.clock_in,
            location: attendance.location
          } : null,
          activeJob: workSession ? {
            id: workSession.id,
            orderNumber: workSession.order_number,
            categoryName: workSession.category_name,
            startTime: workSession.start_time
          } : null,
          activeBreak: breakRecord ? {
            id: breakRecord.id,
            categoryName: breakRecord.category_name,
            startTime: breakRecord.start_time
          } : null
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user status:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Benutzerstatus' });
  }
});

module.exports = router;