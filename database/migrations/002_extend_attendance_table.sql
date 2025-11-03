-- Migration: Extend attendance_records table with missing columns
-- Date: 2024-01-17
-- Description: Add method, location, note, IP columns for clock-in/out tracking

ALTER TABLE `attendance_records` 
ADD COLUMN `clock_in_method` varchar(20) DEFAULT 'manual' COMMENT 'manual, kiosk, scan' AFTER `clock_in`,
ADD COLUMN `clock_out_method` varchar(20) DEFAULT NULL COMMENT 'manual, kiosk, scan' AFTER `clock_out`,
ADD COLUMN `clock_in_location` varchar(255) DEFAULT NULL AFTER `clock_in_method`,
ADD COLUMN `clock_out_location` varchar(255) DEFAULT NULL AFTER `clock_out_method`,
ADD COLUMN `clock_in_note` text DEFAULT NULL AFTER `clock_in_location`,
ADD COLUMN `clock_out_note` text DEFAULT NULL AFTER `clock_out_location`,
ADD COLUMN `clock_in_ip` varchar(45) DEFAULT NULL AFTER `clock_in_note`,
ADD COLUMN `clock_out_ip` varchar(45) DEFAULT NULL AFTER `clock_out_note`,
ADD COLUMN `total_hours` decimal(5,2) DEFAULT NULL AFTER `total_time_minutes`;

-- Update existing records to have default method
UPDATE `attendance_records` 
SET `clock_in_method` = 'manual' 
WHERE `clock_in_method` IS NULL;

-- Add index for performance
CREATE INDEX `idx_attendance_methods` ON `attendance_records` (`clock_in_method`, `clock_out_method`);
CREATE INDEX `idx_attendance_dates` ON `attendance_records` (`clock_in`, `clock_out`);