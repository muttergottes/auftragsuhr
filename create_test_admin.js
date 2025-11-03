// Node.js Script um Test-Admin zu erstellen
const bcrypt = require('bcryptjs');

async function createTestAdmin() {
  // Hash für 'test123' erstellen
  const hash = await bcrypt.hash('test123', 12);
  
  console.log('=== TEST ADMIN ===');
  console.log('Email: test@admin.de');
  console.log('Passwort: test123');
  console.log('Hash:', hash);
  console.log('');
  console.log('SQL Befehl:');
  console.log(`INSERT INTO users (employee_number, email, password_hash, first_name, last_name, role, is_active) VALUES ('TEST001', 'test@admin.de', '${hash}', 'Test', 'Admin', 'admin', 1);`);
}

createTestAdmin();