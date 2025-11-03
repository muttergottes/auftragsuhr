-- Admin-User neu erstellen falls nicht vorhanden
-- Passwort: admin123 (bcrypt Hash)

DELETE FROM users WHERE email = 'admin@werkstatt.local';

INSERT INTO users (
    employee_number, 
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role, 
    pin, 
    is_active
) VALUES (
    'ADM001', 
    'admin@werkstatt.local', 
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeX8UuK8f/6ZuYGKy', 
    'System', 
    'Administrator', 
    'admin', 
    '1234', 
    1
);

-- Prüfung
SELECT id, email, first_name, last_name, role, is_active FROM users WHERE email = 'admin@werkstatt.local';