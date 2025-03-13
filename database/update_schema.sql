-- Add type column to categories table if it doesn't exist
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS type ENUM('component', 'peripheral') NOT NULL DEFAULT 'component';

-- Update existing categories
UPDATE categories SET type = 'peripheral' WHERE name IN ('Monitor', 'Keyboard', 'Mouse', 'Headset');
UPDATE categories SET type = 'component' WHERE name IN ('CPU', 'Motherboard', 'RAM', 'Storage', 'GPU', 'PSU', 'Case', 'CPU Cooler', 'Case Fan');
