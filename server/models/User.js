const bcrypt = require('bcryptjs');
const db = require('../config/database');
const logger = require('../config/logger');

class User {
  constructor(userData) {
    Object.assign(this, userData);
    
    // Parse JSON fields if they are strings
    if (this.work_time_model && typeof this.work_time_model === 'string') {
      try {
        this.work_time_model = JSON.parse(this.work_time_model);
      } catch (error) {
        logger.warn('Failed to parse work_time_model JSON:', error);
        this.work_time_model = null;
      }
    }
  }

  static async findAll(options = {}) {
    const { includeArchived = false, role = null } = options;
    
    let query = `
      SELECT id, employee_number, email, first_name, last_name, role, 
             is_active, hourly_rate, work_time_model, created_at, updated_at
      FROM users
    `;
    
    const conditions = [];
    const params = [];
    
    if (!includeArchived) {
      conditions.push('archived_at IS NULL');
    }
    
    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY last_name, first_name';
    
    const users = await db.query(query, params);
    return users.map(user => new User(user));
  }

  static async findById(id) {
    const query = `
      SELECT id, employee_number, email, first_name, last_name, role, pin, 
             rfid_tag, qr_code, is_active, hourly_rate, work_time_model, 
             created_at, updated_at, archived_at
      FROM users 
      WHERE id = ?
    `;
    
    const users = await db.query(query, [id]);
    return users.length > 0 ? new User(users[0]) : null;
  }

  static async findByEmail(email) {
    const query = `
      SELECT id, employee_number, email, password_hash, first_name, last_name, 
             role, pin, rfid_tag, qr_code, is_active, hourly_rate, work_time_model,
             created_at, updated_at, archived_at
      FROM users 
      WHERE email = ? AND archived_at IS NULL
    `;
    
    const users = await db.query(query, [email]);
    return users.length > 0 ? new User(users[0]) : null;
  }

  static async findByPin(pin) {
    const query = `
      SELECT id, employee_number, email, password_hash, first_name, last_name, 
             role, pin, rfid_tag, qr_code, is_active, hourly_rate, work_time_model,
             created_at, updated_at, archived_at
      FROM users 
      WHERE pin = ? AND archived_at IS NULL
    `;
    
    const users = await db.query(query, [pin]);
    return users.length > 0 ? new User(users[0]) : null;
  }

  static async findByEmployeeNumber(employeeNumber) {
    const query = `
      SELECT id, employee_number, email, password_hash, first_name, last_name, 
             role, pin, rfid_tag, qr_code, is_active, hourly_rate, work_time_model,
             created_at, updated_at, archived_at
      FROM users 
      WHERE employee_number = ? AND archived_at IS NULL
    `;
    
    const users = await db.query(query, [employeeNumber]);
    return users.length > 0 ? new User(users[0]) : null;
  }

  static async findByCredentials(identifier, type = 'employee_number') {
    const allowedTypes = ['employee_number', 'pin', 'rfid_tag', 'qr_code'];
    if (!allowedTypes.includes(type)) {
      throw new Error('Invalid credential type');
    }

    const query = `
      SELECT id, employee_number, email, first_name, last_name, role, 
             is_active, created_at, updated_at
      FROM users 
      WHERE ${type} = ? AND is_active = 1 AND archived_at IS NULL
    `;
    
    const users = await db.query(query, [identifier]);
    return users.length > 0 ? new User(users[0]) : null;
  }

  static async create(userData) {
    const {
      employee_number,
      email,
      password,
      first_name,
      last_name,
      role = 'employee',
      pin = null,
      rfid_tag = null,
      qr_code = null,
      hourly_rate = null,
      work_time_model = null
    } = userData;

    const hashedPassword = await bcrypt.hash(password, 12);

    const query = `
      INSERT INTO users 
      (employee_number, email, password_hash, first_name, last_name, role, 
       pin, rfid_tag, qr_code, hourly_rate, work_time_model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      employee_number, email || null, hashedPassword, first_name, last_name, role,
      pin || null, rfid_tag || null, qr_code || null, hourly_rate || null, 
      work_time_model ? JSON.stringify(work_time_model) : null
    ];

    const result = await db.query(query, params);
    return this.findById(result.insertId);
  }

  static async update(id, updateData) {
    const allowedFields = [
      'email', 'first_name', 'last_name', 'role', 'pin', 'rfid_tag', 'qr_code',
      'is_active', 'hourly_rate', 'work_time_model'
    ];

    const updates = {};
    const params = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        updates[key] = updateData[key];
        if (key === 'work_time_model' && updateData[key]) {
          params.push(JSON.stringify(updateData[key]));
        } else {
          params.push(updateData[key]);
        }
      }
    });

    if (Object.keys(updates).length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const query = `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = ?`;
    
    params.push(id);
    await db.query(query, params);
    
    return this.findById(id);
  }

  static async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const query = 'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?';
    
    await db.query(query, [hashedPassword, id]);
    return true;
  }

  static async archive(id) {
    const query = 'UPDATE users SET archived_at = NOW(), updated_at = NOW() WHERE id = ?';
    await db.query(query, [id]);
    return true;
  }

  static async restore(id) {
    const query = 'UPDATE users SET archived_at = NULL, updated_at = NOW() WHERE id = ?';
    await db.query(query, [id]);
    return this.findById(id);
  }

  async verifyPassword(password) {
    if (!this.password_hash) {
      return false;
    }
    return await bcrypt.compare(password, this.password_hash);
  }

  toJSON() {
    const {
      password_hash,
      pin,
      rfid_tag,
      qr_code,
      ...safeUser
    } = this;
    
    return safeUser;
  }

  toPublicJSON() {
    return {
      id: this.id,
      employee_number: this.employee_number,
      first_name: this.first_name,
      last_name: this.last_name,
      role: this.role,
      is_active: this.is_active
    };
  }
}

module.exports = User;