-- Add missing date columns to products table
ALTER TABLE products 
ADD COLUMN date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Update existing records with current timestamp
UPDATE products 
SET date_added = CURRENT_TIMESTAMP, 
    last_updated = CURRENT_TIMESTAMP;
