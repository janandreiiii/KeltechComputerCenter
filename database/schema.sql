-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS keltech;
USE keltech;

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    type ENUM('component', 'peripheral') NOT NULL DEFAULT 'component',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INT NOT NULL,
    performance_score INT DEFAULT 0,
    power_draw INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Create specifications table
CREATE TABLE IF NOT EXISTS specifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Create batches table
CREATE TABLE IF NOT EXISTS batches (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    remaining INT NOT NULL DEFAULT 0,
    buy_price DECIMAL(10,2) NOT NULL,
    sell_price DECIMAL(10,2) NOT NULL,
    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Add index for faster batch lookups
CREATE INDEX idx_batches_product ON batches(product_id);
CREATE INDEX idx_batches_date ON batches(date_added);

-- Add trigger to update product's updated_at timestamp when batch is modified
DELIMITER //
CREATE TRIGGER update_product_timestamp 
AFTER INSERT ON batches
FOR EACH ROW
BEGIN
    UPDATE products 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.product_id;
END//
DELIMITER ;

-- Add trigger to validate remaining quantity
DELIMITER //
CREATE TRIGGER validate_batch_remaining
BEFORE UPDATE ON batches
FOR EACH ROW
BEGIN
    IF NEW.remaining > NEW.quantity THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Remaining quantity cannot exceed total quantity';
    END IF;
END//
DELIMITER ;

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id VARCHAR(36) NOT NULL,
    batch_id VARCHAR(36) NOT NULL,
    type ENUM('in', 'out') NOT NULL,
    quantity INT NOT NULL,
    buy_price DECIMAL(10,2) NOT NULL,
    sell_price DECIMAL(10,2) NOT NULL,
    profit DECIMAL(10,2),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (batch_id) REFERENCES batches(id)
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    contact_number VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Modify customer_builds table to store build data as JSON
CREATE TABLE IF NOT EXISTS customer_builds (
    id VARCHAR(36) PRIMARY KEY,
    customer_id INT NOT NULL,
    tracking_id VARCHAR(36) UNIQUE NOT NULL,
    build_data JSON NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'processing', 'assembling', 'testing', 'completed') DEFAULT 'pending',
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Create trigger to update batch quantities when a build is saved
DELIMITER //
CREATE TRIGGER after_customer_build_insert
AFTER INSERT ON customer_builds
FOR EACH ROW
BEGIN
    DECLARE build_data JSON;
    SET build_data = NEW.build_data;
    
    -- Update CPU batch
    IF JSON_EXTRACT(build_data, '$.cpu.batch_id') IS NOT NULL THEN
        UPDATE batches 
        SET remaining = remaining - 1
        WHERE id = JSON_UNQUOTE(JSON_EXTRACT(build_data, '$.cpu.batch_id'));
    END IF;
    
    -- Update Motherboard batch
    IF JSON_EXTRACT(build_data, '$.motherboard.batch_id') IS NOT NULL THEN
        UPDATE batches 
        SET remaining = remaining - 1
        WHERE id = JSON_UNQUOTE(JSON_EXTRACT(build_data, '$.motherboard.batch_id'));
    END IF;
    
    -- Update RAM batch
    IF JSON_EXTRACT(build_data, '$.ram.batch_id') IS NOT NULL THEN
        UPDATE batches 
        SET remaining = remaining - 1
        WHERE id = JSON_UNQUOTE(JSON_EXTRACT(build_data, '$.ram.batch_id'));
    END IF;
    
    -- Update Storage batch
    IF JSON_EXTRACT(build_data, '$.storage.batch_id') IS NOT NULL THEN
        UPDATE batches 
        SET remaining = remaining - 1
        WHERE id = JSON_UNQUOTE(JSON_EXTRACT(build_data, '$.storage.batch_id'));
    END IF;
    
    -- Update GPU batch
    IF JSON_EXTRACT(build_data, '$.gpu.batch_id') IS NOT NULL THEN
        UPDATE batches 
        SET remaining = remaining - 1
        WHERE id = JSON_UNQUOTE(JSON_EXTRACT(build_data, '$.gpu.batch_id'));
    END IF;
    
    -- Update PSU batch
    IF JSON_EXTRACT(build_data, '$.psu.batch_id') IS NOT NULL THEN
        UPDATE batches 
        SET remaining = remaining - 1
        WHERE id = JSON_UNQUOTE(JSON_EXTRACT(build_data, '$.psu.batch_id'));
    END IF;
END//
DELIMITER ;

-- Insert default categories
INSERT IGNORE INTO categories (name, type) VALUES
-- Components
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
('Headset', 'peripheral');

-- Create a view for easy access to current prices
CREATE OR REPLACE VIEW current_prices AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.category_id,
    b.id as batch_id,
    b.sell_price,
    b.remaining
FROM products p
JOIN batches b ON p.id = b.product_id
WHERE b.remaining > 0
ORDER BY b.sell_price ASC;

-- Create compatibility view for quick lookups
CREATE OR REPLACE VIEW component_compatibility AS
SELECT 
    p.id,
    p.name,
    c.name as category,
    GROUP_CONCAT(
        CASE 
            WHEN s.name LIKE '%socket%' THEN s.value
            WHEN s.name LIKE '%form factor%' THEN s.value
            WHEN s.name LIKE '%type%' AND c.name IN ('RAM', 'Storage') THEN s.value
        END
    ) as compatibility_info
FROM products p
JOIN categories c ON p.category_id = c.id
LEFT JOIN specifications s ON p.id = s.product_id
GROUP BY p.id;
