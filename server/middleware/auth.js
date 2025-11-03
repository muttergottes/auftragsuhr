const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.is_active) {
      return res.status(403).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Token verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        actual: userRole
      });
    }

    next();
  };
};

const requireAdmin = requireRole(['admin']);
const requireDispatcherOrAdmin = requireRole(['dispatcher', 'admin']);
const requireAnyRole = requireRole(['employee', 'dispatcher', 'admin']);

const kioskAuth = async (req, res, next) => {
  console.log('=== KIOSK AUTH MIDDLEWARE START ===');
  console.log('req.body:', req.body);
  console.log('req.body type:', typeof req.body);
  console.log('req.headers:', req.headers);
  
  const { employeeNumber, pin } = req.body || {};
  console.log('KIOSK AUTH CALLED WITH:', { employeeNumber, pin });

  if (!employeeNumber || !pin) {
    console.log('MISSING CREDENTIALS');
    return res.status(400).json({ error: 'Employee number and PIN required' });
  }

  try {
    const user = await User.findByEmployeeNumber(employeeNumber);
    console.log('USER FOUND:', user ? { id: user.id, pin: user.pin, pin_type: typeof user.pin } : 'NULL');
    console.log('PIN COMPARISON:', { provided: pin, provided_type: typeof pin, stored: user?.pin, stored_type: typeof user?.pin, match: user?.pin === pin });
    
    if (!user || !user.is_active || user.pin !== pin) {
      console.log('AUTH FAILED:', { hasUser: !!user, isActive: user?.is_active, pinMatch: user?.pin === pin });
      logger.warn('Failed kiosk authentication attempt', { employeeNumber, ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('AUTH SUCCESS, SETTING req.user');
    req.user = user;
    next();
  } catch (error) {
    console.error('KIOSK AUTH EXCEPTION:', error);
    logger.error('Kiosk authentication error:', error.message);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireDispatcherOrAdmin,
  requireAnyRole,
  kioskAuth
};