-- Drop and recreate categories table with proper structure
DROP TABLE IF EXISTS categories;
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(20) DEFAULT 'component'
);

-- Insert base categories
INSERT INTO categories (name, type) VALUES
('CPU', 'component'),
('Motherboard', 'component'),
('RAM', 'component'),
('Storage', 'component'),
('GPU', 'component'),
('PSU', 'component'),
('Case', 'component'),
('CPU Cooler', 'component'),
('Case Fan', 'component'),
('Monitor', 'peripheral'),
('Keyboard', 'peripheral'),
('Mouse', 'peripheral'),
('Headset', 'peripheral');
