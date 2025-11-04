const bcrypt = require('bcryptjs');
const db = require('./config/database');

async function initAdmin() {
  try {
    console.log('🔧 Initializing admin user...');
    
    // Wait for database connection
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Generate hash with the exact same library version
    const hash = await bcrypt.hash('admin123', 12);
    console.log('Generated hash for admin123');
    
    // Check if any admin exists
    const admins = await db.query('SELECT id, email FROM users WHERE role = "admin"');
    
    if (admins.length === 0) {
      // Create admin if none exists
      await db.query(`
        INSERT INTO users (employee_number, email, password_hash, first_name, last_name, role, is_active) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['ADM001', 'admin@werkstatt.local', hash, 'System', 'Administrator', 'admin', 1]);
      console.log('✅ Created admin user: admin@werkstatt.local');
    } else {
      // Update existing admin(s) with working hash
      await db.query('UPDATE users SET password_hash = ? WHERE role = "admin"', [hash]);
      console.log('✅ Updated admin password hash');
    }
    
    // Verify the login works
    const [testUser] = await db.query('SELECT password_hash FROM users WHERE role = "admin" LIMIT 1');
    if (testUser) {
      const isValid = await bcrypt.compare('admin123', testUser.password_hash);
      console.log(isValid ? '✅ Admin login verification: SUCCESS' : '❌ Admin login verification: FAILED');
    }
    
  } catch (error) {
    console.error('❌ Admin initialization failed:', error.message);
  }
}

module.exports = initAdmin;