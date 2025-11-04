#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function setupAdmin() {
  console.log('🔧 Setting up admin user...');
  
  // Database configuration
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'auftragsuhr_user',
    password: process.env.DB_PASSWORD || 'auftragsuhr123',
    database: process.env.DB_NAME || 'auftragsuhr'
  };
  
  try {
    // Connect to database
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to database');
    
    // Generate proper bcrypt hash
    const password = 'admin123';
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log('✅ Generated bcrypt hash');
    
    // Check if admin exists
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE role = "admin" OR email = "admin@werkstatt.local" LIMIT 1'
    );
    
    if (existing.length > 0) {
      // Update existing admin
      await connection.execute(
        'UPDATE users SET email = ?, password_hash = ? WHERE role = "admin" OR email = "admin@werkstatt.local"',
        ['admin@werkstatt.local', hashedPassword]
      );
      console.log('✅ Updated existing admin user');
    } else {
      // Create new admin
      await connection.execute(
        `INSERT INTO users (employee_number, email, password_hash, first_name, last_name, role, is_active, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        ['ADM001', 'admin@werkstatt.local', hashedPassword, 'System', 'Administrator', 'admin', 1]
      );
      console.log('✅ Created new admin user');
    }
    
    // Test the login
    const [testUser] = await connection.execute(
      'SELECT password_hash FROM users WHERE email = "admin@werkstatt.local"'
    );
    
    if (testUser.length > 0) {
      const isValid = await bcrypt.compare(password, testUser[0].password_hash);
      if (isValid) {
        console.log('✅ Login test successful');
      } else {
        console.log('❌ Login test failed');
      }
    }
    
    await connection.end();
    
    console.log('\n🎉 Admin setup complete!');
    console.log('Login credentials:');
    console.log('  Email: admin@werkstatt.local');
    console.log('  Password: admin123');
    
  } catch (error) {
    console.error('❌ Error setting up admin:', error.message);
    process.exit(1);
  }
}

setupAdmin();