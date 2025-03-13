-- Add type column to categories table
ALTER TABLE categories 
ADD COLUMN type ENUM('component', 'peripheral') NOT NULL DEFAULT 'component';

-- Update existing categories with correct types
UPDATE categories SET type = 'peripheral' 
WHERE name IN ('Monitor', 'Keyboard', 'Mouse', 'Headset');

UPDATE categories SET type = 'component' 
WHERE name IN ('CPU', 'Motherboard', 'RAM', 'Storage', 'GPU', 'PSU', 'Case', 'CPU Cooler', 'Case Fan');

-- Add indexes for better performance
ALTER TABLE categories
ADD INDEX idx_type (type);
