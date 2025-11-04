-- Default data for Auftragsuhr
-- Version: 1.0

SET NAMES utf8mb4;

-- Default categories
INSERT INTO `categories` (`name`, `type`, `color`, `is_active`, `is_productive`, `auto_break`, `max_duration_minutes`) VALUES
('Diagnose', 'work', '#007bff', 1, 1, 0, NULL),
('Reparatur', 'work', '#28a745', 1, 1, 0, NULL),
('Wartung', 'work', '#17a2b8', 1, 1, 0, NULL),
('Ölwechsel', 'work', '#ffc107', 1, 1, 0, 60),
('Probefahrt', 'work', '#6610f2', 1, 1, 0, 30),
('Inspektion', 'work', '#e83e8c', 1, 1, 0, NULL),
('Reifenwechsel', 'work', '#fd7e14', 1, 1, 0, 90),
('Standard Pause', 'break', '#6c757d', 1, 0, 0, 30),
('Mittagspause', 'break', '#20c997', 1, 0, 0, 60),
('Raucherpause', 'break', '#dc3545', 1, 0, 0, 15),
('Werkstattpflege', 'maintenance', '#795548', 1, 0, 0, NULL),
('Aufräumen', 'maintenance', '#607d8b', 1, 0, 0, 60),
('Schulung', 'training', '#9c27b0', 1, 1, 0, NULL),
('Meeting', 'other', '#ff5722', 1, 1, 0, NULL),
('Sonstiges', 'other', '#6c757d', 1, 1, 0, NULL);

-- Default admin user (Password: admin123)
INSERT INTO `users` (`employee_number`, `email`, `password_hash`, `first_name`, `last_name`, `role`, `pin`, `is_active`, `created_at`) VALUES
('ADM001', 'admin@werkstatt.local', '$2b$12$5WnlbtGb3KUv519YG4V5Q.5qnokrIKwUvvkZxQO3bc9heplKDO9Ka', 'System', 'Administrator', 'admin', '1234', 1, NOW());

-- Default system settings
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `data_type`, `description`, `is_public`) VALUES
('app_name', 'Auftragsuhr', 'string', 'Application name', 1),
('company_name', 'Meine Werkstatt GmbH', 'string', 'Company name for reports', 1),
('working_hours_start', '08:00', 'string', 'Default start of working hours', 0),
('working_hours_end', '17:00', 'string', 'Default end of working hours', 0),
('auto_break_duration', '30', 'number', 'Auto break duration in minutes', 0),
('auto_break_after_hours', '6', 'number', 'Auto break after X working hours', 0),
('max_session_duration', '720', 'number', 'Maximum work session duration in minutes', 0),
('time_rounding_minutes', '5', 'number', 'Round times to nearest X minutes', 0),
('auto_stop_on_clock_out', 'true', 'boolean', 'Automatically stop work sessions on clock out', 0),
('enable_qr_codes', 'true', 'boolean', 'Enable QR code functionality', 1),
('enable_rfid', 'false', 'boolean', 'Enable RFID functionality', 1),
('currency', 'EUR', 'string', 'Currency symbol', 1),
('date_format', 'DD.MM.YYYY', 'string', 'Date format for display', 1),
('time_format', 'HH:mm', 'string', 'Time format for display', 1),
('backup_retention_days', '30', 'number', 'Days to keep backups', 0),
('session_timeout_hours', '24', 'number', 'Session timeout in hours', 0),
('kiosk_mode_timeout', '60', 'number', 'Kiosk mode timeout in seconds', 1),
('allow_correction_requests', 'true', 'boolean', 'Allow employees to request corrections', 0),
('require_break_confirmation', 'false', 'boolean', 'Require confirmation for breaks', 0),
('default_hourly_rate', '25.00', 'number', 'Default hourly rate for new employees', 0),
('overtime_threshold_hours', '8', 'number', 'Hours after which overtime applies', 0);

-- Sample customer data
INSERT INTO `customers` (`customer_number`, `company_name`, `first_name`, `last_name`, `email`, `phone`, `address`) VALUES
('K001', NULL, 'Max', 'Mustermann', 'max.mustermann@email.com', '+49 123 456789', 'Musterstraße 1, 12345 Musterstadt'),
('K002', 'Musterfirma GmbH', 'Maria', 'Schmidt', 'maria.schmidt@musterfirma.de', '+49 987 654321', 'Firmenstraße 10, 54321 Firmenstadt'),
('K003', NULL, 'Hans', 'Weber', 'hans.weber@email.com', '+49 555 123456', 'Weberweg 5, 98765 Weberstadt');

-- Sample vehicle data
INSERT INTO `vehicles` (`vin`, `license_plate`, `make`, `model`, `year`, `customer_id`) VALUES
('WBA12345678901234', 'M-AB 1234', 'BMW', '320i', 2020, 1),
('WVW98765432109876', 'M-CD 5678', 'Volkswagen', 'Golf', 2019, 2),
('WDD11111111111111', 'M-EF 9012', 'Mercedes-Benz', 'C-Klasse', 2021, 3),
('WMWXYZ9876543210', 'M-GH 3456', 'BMW', 'R1250GS', 2022, 1);

-- Sample work order data
INSERT INTO `work_orders` (`order_number`, `customer_id`, `vehicle_id`, `description`, `mileage`, `priority`, `status`, `estimated_hours`, `estimated_completion`, `created_by`) VALUES
('WO2024001', 1, 1, 'Inspektion 60.000 km', 59850, 'normal', 'created', 3.5, DATE_ADD(NOW(), INTERVAL 2 DAY), 1),
('WO2024002', 2, 2, 'Bremsen vorne erneuern', 45000, 'high', 'in_progress', 2.0, DATE_ADD(NOW(), INTERVAL 1 DAY), 1),
('WO2024003', 3, 3, 'Ölwechsel', 15000, 'low', 'created', 0.5, DATE_ADD(NOW(), INTERVAL 3 DAY), 1),
('WO2024004', 1, 4, 'Kette spannen und ölen', 8500, 'normal', 'created', 1.0, DATE_ADD(NOW(), INTERVAL 1 DAY), 1);

-- Create views for common queries
CREATE VIEW v_active_work_sessions AS
SELECT 
    ws.id,
    ws.user_id,
    u.first_name,
    u.last_name,
    u.employee_number,
    ws.work_order_id,
    wo.order_number,
    wo.description as order_description,
    COALESCE(c.company_name, CONCAT(c.first_name, ' ', c.last_name)) as customer_name,
    ws.start_time,
    TIMESTAMPDIFF(MINUTE, ws.start_time, NOW()) as duration_minutes,
    cat.name as category_name,
    ws.task_description
FROM work_sessions ws
JOIN users u ON ws.user_id = u.id
JOIN work_orders wo ON ws.work_order_id = wo.id
LEFT JOIN customers c ON wo.customer_id = c.id
LEFT JOIN categories cat ON ws.category_id = cat.id
WHERE ws.end_time IS NULL
ORDER BY ws.start_time;

CREATE VIEW v_current_attendance AS
SELECT 
    ar.id,
    ar.user_id,
    u.first_name,
    u.last_name,
    u.employee_number,
    ar.clock_in,
    ar.clock_out,
    CASE 
        WHEN ar.clock_out IS NULL THEN TIMESTAMPDIFF(MINUTE, ar.clock_in, NOW())
        ELSE TIMESTAMPDIFF(MINUTE, ar.clock_in, ar.clock_out)
    END as total_minutes,
    ar.break_time_minutes
FROM attendance_records ar
JOIN users u ON ar.user_id = u.id
WHERE DATE(ar.clock_in) = CURDATE()
ORDER BY ar.clock_in;

CREATE VIEW v_work_order_summary AS
SELECT 
    wo.id,
    wo.order_number,
    wo.description,
    wo.status,
    wo.priority,
    wo.estimated_hours,
    COALESCE(SUM(ws.duration_minutes), 0) / 60.0 as actual_hours,
    wo.estimated_hours - (COALESCE(SUM(ws.duration_minutes), 0) / 60.0) as remaining_hours,
    CASE 
        WHEN wo.estimated_hours > 0 THEN 
            ROUND((COALESCE(SUM(ws.duration_minutes), 0) / 60.0) / wo.estimated_hours * 100, 1)
        ELSE 0 
    END as progress_percentage,
    COUNT(DISTINCT ws.user_id) as workers_count,
    c.first_name as customer_first_name,
    c.last_name as customer_last_name,
    c.company_name,
    v.make,
    v.model,
    v.license_plate
FROM work_orders wo
LEFT JOIN work_sessions ws ON wo.id = ws.work_order_id AND ws.end_time IS NOT NULL
LEFT JOIN customers c ON wo.customer_id = c.id
LEFT JOIN vehicles v ON wo.vehicle_id = v.id
GROUP BY wo.id, wo.order_number, wo.description, wo.status, wo.priority, wo.estimated_hours, 
         c.first_name, c.last_name, c.company_name, v.make, v.model, v.license_plate;

-- Create indexes for better performance
CREATE INDEX idx_work_sessions_active ON work_sessions (user_id, end_time);
CREATE INDEX idx_attendance_current_day ON attendance_records (user_id, clock_in, clock_out);
CREATE INDEX idx_audit_log_search ON audit_log (table_name, record_id, created_at);
CREATE INDEX idx_work_orders_search ON work_orders (order_number, status, priority, customer_id);
CREATE INDEX idx_users_login ON users (employee_number, is_active);

-- Create stored procedures for common operations
DELIMITER //

CREATE PROCEDURE GetUserCurrentStatus(IN user_id INT)
BEGIN
    SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.employee_number,
        ar.clock_in,
        ar.clock_out,
        CASE WHEN ar.clock_out IS NULL THEN 'present' ELSE 'absent' END as attendance_status,
        ws.id as active_session_id,
        wo.order_number as active_order,
        ws.start_time as session_start
    FROM users u
    LEFT JOIN attendance_records ar ON u.id = ar.user_id 
        AND DATE(ar.clock_in) = CURDATE() 
        AND ar.clock_out IS NULL
    LEFT JOIN work_sessions ws ON u.id = ws.user_id 
        AND ws.end_time IS NULL
    LEFT JOIN work_orders wo ON ws.work_order_id = wo.id
    WHERE u.id = user_id;
END //

DELIMITER ;

-- Insert audit log entry for initial setup
INSERT INTO audit_log (action, table_name, record_id, new_values, ip_address, created_at) VALUES
('SYSTEM_INIT', 'system_settings', NULL, '{"message": "Database initialized with default data"}', 'system', NOW());