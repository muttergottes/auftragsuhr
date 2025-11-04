const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken, requireAdmin, requireDispatcherOrAdmin } = require('../middleware/auth');
const logger = require('../config/logger');

// GET /api/users - List users
router.get('/', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const { includeArchived = false, role } = req.query;
    const users = await User.findAll({ 
      includeArchived: includeArchived === 'true', 
      role 
    });
    
    // Remove sensitive cost data for non-admin users
    const sanitizedUsers = users.map(user => {
      const userData = user.toJSON();
      if (req.user.role !== 'admin') {
        delete userData.hourly_rate;
      }
      return userData;
    });
    
    res.json(sanitizedUsers);
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = user.toJSON();
    if (req.user.role !== 'admin') {
      delete userData.hourly_rate;
    }
    
    res.json(userData);
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/users - Create new user
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      employee_number,
      email,
      password,
      first_name,
      last_name,
      role = 'employee',
      pin,
      rfid_tag,
      qr_code,
      hourly_rate,
      work_time_model
    } = req.body;

    // Validate required fields
    if (!employee_number || !password || !first_name || !last_name) {
      return res.status(400).json({ 
        error: 'Missing required fields: employee_number, password, first_name, last_name' 
      });
    }

    // Check if user already exists
    console.log('=== USER CREATION ATTEMPT ===');
    console.log('Email:', email);
    console.log('Employee Number:', employee_number);
    
    if (email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        console.log('CONFLICT: Email already exists:', existingUser.id);
        return res.status(409).json({ error: 'User with this email already exists' });
      }
    }

    const existingEmployee = await User.findByEmployeeNumber(employee_number);
    if (existingEmployee) {
      console.log('CONFLICT: Employee number already exists:', existingEmployee.id);
      return res.status(409).json({ error: 'User with this employee number already exists' });
    }

    
    console.log('No conflicts found, proceeding with user creation...');

    const newUser = await User.create({
      employee_number,
      email,
      password,
      first_name,
      last_name,
      role,
      pin,
      rfid_tag,
      qr_code,
      hourly_rate,
      work_time_model
    });

    logger.info('User created:', { 
      id: newUser.id, 
      employee_number, 
      email, 
      created_by: req.user.id 
    });

    res.status(201).json(newUser.toJSON());
  } catch (error) {
    console.error('=== USER CREATION ERROR ===');
    console.error('Error details:', error);
    console.error('Stack:', error.stack);
    logger.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const updateData = req.body;

    console.log('=== USER UPDATE ATTEMPT ===');
    console.log('User ID:', userId);
    console.log('Update Data:', updateData);

    const existingUser = await User.findById(userId);
    if (!existingUser) {
      console.log('ERROR: User not found');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Existing user found:', existingUser.email);

    // Check for email conflicts
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailConflict = await User.findByEmail(updateData.email);
      if (emailConflict && emailConflict.id !== parseInt(userId)) {
        console.log('ERROR: Email conflict with user ID:', emailConflict.id);
        return res.status(409).json({ error: 'Email already in use by another user' });
      }
    }


    console.log('No conflicts, proceeding with update...');
    const updatedUser = await User.update(userId, updateData);
    console.log('Update successful:', updatedUser ? 'YES' : 'NO');

    logger.info('User updated:', { 
      id: userId, 
      updated_by: req.user.id,
      changes: Object.keys(updateData)
    });

    res.json(updatedUser.toJSON());
  } catch (error) {
    console.error('=== USER UPDATE ERROR ===');
    console.error('Error details:', error);
    console.error('Stack:', error.stack);
    logger.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
});

// PATCH /api/users/:id/password - Update user password
router.patch('/:id/password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await User.updatePassword(req.params.id, newPassword);

    logger.info('User password updated:', { 
      id: req.params.id, 
      updated_by: req.user.id 
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// DELETE /api/users/:id - Archive user
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent admin from archiving themselves
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot archive your own account' });
    }

    await User.archive(req.params.id);

    logger.info('User archived:', { 
      id: req.params.id, 
      archived_by: req.user.id 
    });

    res.json({ message: 'User archived successfully' });
  } catch (error) {
    logger.error('Error archiving user:', error);
    res.status(500).json({ error: 'Failed to archive user' });
  }
});

// PATCH /api/users/:id/restore - Restore archived user
router.patch('/:id/restore', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const restoredUser = await User.restore(req.params.id);

    logger.info('User restored:', { 
      id: req.params.id, 
      restored_by: req.user.id 
    });

    res.json(restoredUser.toJSON());
  } catch (error) {
    logger.error('Error restoring user:', error);
    res.status(500).json({ error: 'Failed to restore user' });
  }
});

// GET /api/users/:id/status - Get current user status (attendance, active session)
router.get('/:id/status', authenticateToken, requireDispatcherOrAdmin, async (req, res) => {
  try {
    // TODO: Implement when attendance and work sessions are ready
    res.json({ 
      user_id: req.params.id,
      is_present: false,
      active_session: null,
      last_activity: null
    });
  } catch (error) {
    logger.error('Error fetching user status:', error);
    res.status(500).json({ error: 'Failed to fetch user status' });
  }
});

module.exports = router;