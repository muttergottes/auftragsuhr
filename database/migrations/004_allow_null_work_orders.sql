-- Migration: Allow NULL work orders for activity sessions
-- Version: 004
-- Description: Ermöglicht auftragslose Aktivitäten wie Werkstattpflege

-- Modify work_sessions table to allow NULL work_order_id for activities
ALTER TABLE `work_sessions` 
MODIFY COLUMN `work_order_id` int NULL,
DROP FOREIGN KEY `fk_session_order`,
ADD CONSTRAINT `fk_session_order` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE;

-- Add index for better performance on activity queries
CREATE INDEX `idx_activity_sessions` ON `work_sessions` (`work_order_id`, `category_id`, `start_time`);