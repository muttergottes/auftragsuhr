-- Add category_id field to work_orders table
-- Migration: 005_add_category_id_to_work_orders.sql

ALTER TABLE work_orders 
ADD COLUMN category_id INT NULL AFTER vehicle_id,
ADD KEY idx_category_id (category_id);

-- Add foreign key constraint
ALTER TABLE work_orders 
ADD CONSTRAINT fk_work_orders_category 
FOREIGN KEY (category_id) REFERENCES categories(id) 
ON DELETE SET NULL ON UPDATE CASCADE;