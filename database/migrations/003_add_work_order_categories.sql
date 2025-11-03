-- Migration: Add work order categories support
-- Description: Adds work order categories table and category_id to work_orders table

-- Create work order categories table
CREATE TABLE IF NOT EXISTS `work_order_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `color` varchar(7) DEFAULT '#007bff',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_work_order_category_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add category_id to work_orders table
ALTER TABLE `work_orders` 
ADD COLUMN `category_id` int DEFAULT NULL AFTER `order_number`,
ADD KEY `fk_work_order_category` (`category_id`),
ADD CONSTRAINT `fk_work_order_category` FOREIGN KEY (`category_id`) REFERENCES `work_order_categories` (`id`) ON DELETE SET NULL;

-- Insert default work order categories
INSERT INTO `work_order_categories` (`name`, `description`, `color`) VALUES
('Standard', 'Standard Auftrag ohne spezielle Kategorie', '#007bff'),
('Wartung', 'Regelmäßige Wartungsarbeiten', '#28a745'),
('Reparatur', 'Reparaturarbeiten an Fahrzeugen', '#dc3545'),
('Inspektion', 'Gesetzliche und herstellervorgeschriebene Inspektionen', '#ffc107'),
('Werkstattpflege', 'Aufräumen und Werkstattinstandhaltung', '#6f42c1'),
('Garantie', 'Garantiearbeiten', '#fd7e14'),
('Sonstiges', 'Andere Arbeiten', '#6c757d');