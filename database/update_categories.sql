-- Check if type column exists and drop it (compatible with older MySQL versions)
SET @sql = (SELECT IF(
    EXISTS(
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'categories' 
        AND COLUMN_NAME = 'type'
    ),
    'ALTER TABLE categories DROP COLUMN type',
    'SELECT 1'
));

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add new type column
ALTER TABLE categories 
ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'component';

-- Clean up existing rows
DELETE FROM categories WHERE name IN (
    'Desktop', 'Laptop', 'CPU', 'Motherboard', 'RAM', 'Storage', 
    'GPU', 'PSU', 'Peripherals', 'Case', 'CPU Cooler', 'Case Fan'
);

-- Insert complete set of categories
INSERT INTO categories (name, type) VALUES 
-- Core Components
('CPU', 'component'),
('Motherboard', 'component'),
('RAM', 'component'),
('Storage', 'component'),
('GPU', 'component'),
('PSU', 'component'),
('Case', 'component'),
('CPU Cooler', 'component'),
('Case Fan', 'component'),

-- Peripherals
('Monitor', 'peripheral'),
('Keyboard', 'peripheral'),
('Mouse', 'peripheral'),
('Headset', 'peripheral'),
('Webcam', 'peripheral'),
('Speakers', 'peripheral'),
('Microphone', 'peripheral'),

-- Systems
('Desktop', 'system'),
('Laptop', 'system'),
('All-in-One', 'system');

-- Add index for better performance
ALTER TABLE categories 
ADD INDEX idx_type (type);
