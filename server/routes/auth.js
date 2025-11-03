const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const logger = require('../config/logger');
const { kioskAuth } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id,
      role: user.role,
      employeeNumber: user.employee_number
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
};

// Regular login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user || !user.is_active) {
      logger.warn('Failed login attempt', { email, ip: req.ip });
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const isValidPassword = await user.verifyPassword(password);
    if (!isValidPassword) {
      logger.warn('Failed login attempt - wrong password', { email, ip: req.ip });
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const token = generateToken(user);
    
    logger.info('User logged in successfully', { 
      userId: user.id, 
      email: user.email,
      ip: req.ip 
    });

    res.json({
      success: true,
      token,
      user: user.toJSON()
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Kiosk login (PIN-based)
router.post('/kiosk', [
  body('employeeNumber').isLength({ min: 1 }),
  body('pin').isLength({ min: 4, max: 10 })
], kioskAuth, async (req, res) => {
  try {
    const user = req.user;
    
    logger.info('Kiosk login successful', { 
      userId: user.id, 
      employeeNumber: user.employee_number,
      ip: req.ip 
    });

    res.json({
      success: true,
      user: user.toPublicJSON()
    });
  } catch (error) {
    logger.error('Kiosk login error:', error);
    res.status(500).json({ error: 'Kiosk login failed' });
  }
});

// QR/RFID login
router.post('/scan', [
  body('identifier').isLength({ min: 1 }),
  body('type').isIn(['qr_code', 'rfid_tag'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { identifier, type } = req.body;

    const user = await User.findByCredentials(identifier, type);
    if (!user) {
      logger.warn('Failed scan login attempt', { identifier, type, ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logger.info('Scan login successful', { 
      userId: user.id, 
      employeeNumber: user.employee_number,
      type,
      ip: req.ip 
    });

    res.json({
      success: true,
      user: user.toPublicJSON()
    });
  } catch (error) {
    logger.error('Scan login error:', error);
    res.status(500).json({ error: 'Scan login failed' });
  }
});

// Token validation
router.get('/validate', require('../middleware/auth').authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user.toJSON()
  });
});

// Logout (client-side token removal)
router.post('/logout', (req, res) => {
  logger.info('User logged out', { ip: req.ip });
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;