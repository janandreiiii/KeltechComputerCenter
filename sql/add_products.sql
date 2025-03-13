
-- First add categories if they don't exist
INSERT INTO categories (name, description) VALUES
('CPU', 'High-performance computing processor'),
('Motherboard', 'Main system board with essential connections'),
('RAM', 'High-speed system memory modules'),
('Storage', 'Fast and reliable data storage'),
('GPU', 'Dedicated graphics processing unit'),
('PSU', 'Reliable power delivery system'),
('Case', 'Computer chassis and housing'),
('CPU Cooler', 'Processor cooling solution'),
('Case Fans', 'Additional cooling fans'),
('Monitor', 'Display screen'),
('Keyboard', 'Input device'),
('Mouse', 'Pointing device'),
('Headset', 'Audio device')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Add sample products
-- CPUs
INSERT INTO products (name, category_id, performance_score, power_draw) VALUES 
('Intel Core i9-13900K', (SELECT id FROM categories WHERE name = 'CPU'), 95, 125),
('AMD Ryzen 9 7950X', (SELECT id FROM categories WHERE name = 'CPU'), 93, 170),
('Intel Core i7-13700K', (SELECT id FROM categories WHERE name = 'CPU'), 88, 125),
('AMD Ryzen 7 7700X', (SELECT id FROM categories WHERE name = 'CPU'), 85, 105);

-- Add specifications for CPUs
INSERT INTO product_specifications (product_id, name, value) 
SELECT p.id, spec.name, spec.value
FROM products p
CROSS JOIN (
    VALUES 
    ('Intel Core i9-13900K', 'Socket', 'LGA 1700'),
    ('Intel Core i9-13900K', 'Cores', '24 (8P+16E)'),
    ('Intel Core i9-13900K', 'Base Clock', '3.0 GHz'),
    ('Intel Core i9-13900K', 'Generation', '13th Gen'),
    
    ('AMD Ryzen 9 7950X', 'Socket', 'AM5'),
    ('AMD Ryzen 9 7950X', 'Cores', '16'),
    ('AMD Ryzen 9 7950X', 'Base Clock', '4.5 GHz'),
    ('AMD Ryzen 9 7950X', 'Generation', 'Ryzen 7000')
) AS spec(product_name, name, value)
WHERE p.name = spec.product_name;

-- Motherboards
INSERT INTO products (name, category_id, performance_score, power_draw) VALUES 
('ASUS ROG Maximus Z790', (SELECT id FROM categories WHERE name = 'Motherboard'), 90, 45),
('MSI MEG X670E ACE', (SELECT id FROM categories WHERE name = 'Motherboard'), 88, 45),
('GIGABYTE B660 AORUS', (SELECT id FROM categories WHERE name = 'Motherboard'), 82, 35);

-- RAM
INSERT INTO products (name, category_id, performance_score, power_draw) VALUES 
('Corsair Vengeance 32GB DDR5', (SELECT id FROM categories WHERE name = 'RAM'), 85, 12),
('G.Skill Trident Z5 32GB', (SELECT id FROM categories WHERE name = 'RAM'), 88, 12),
('Crucial 16GB DDR4', (SELECT id FROM categories WHERE name = 'RAM'), 75, 8);

-- Add specifications for RAM
INSERT INTO product_specifications (product_id, name, value)
SELECT p.id, spec.name, spec.value
FROM products p
CROSS JOIN (
    VALUES 
    ('Corsair Vengeance 32GB DDR5', 'Type', 'DDR5'),
    ('Corsair Vengeance 32GB DDR5', 'Capacity', '32GB'),
    ('Corsair Vengeance 32GB DDR5', 'Speed', '6000MHz'),
    
    ('G.Skill Trident Z5 32GB', 'Type', 'DDR5'),
    ('G.Skill Trident Z5 32GB', 'Capacity', '32GB'),
    ('G.Skill Trident Z5 32GB', 'Speed', '6400MHz')
) AS spec(product_name, name, value)
WHERE p.name = spec.product_name;

-- Storage
INSERT INTO products (name, category_id, performance_score, power_draw) VALUES 
('Samsung 990 PRO 2TB', (SELECT id FROM categories WHERE name = 'Storage'), 92, 8),
('WD Black SN850X 1TB', (SELECT id FROM categories WHERE name = 'Storage'), 88, 8),
('Crucial P3 1TB', (SELECT id FROM categories WHERE name = 'Storage'), 78, 6);

-- Add sample batches with prices
INSERT INTO product_batches (product_id, batch_number, buy_price, sell_price, initial_quantity, remaining, date_added)
SELECT 
    p.id,
    'BATCH001',
    CASE 
        WHEN p.name LIKE '%i9%' THEN 28000
        WHEN p.name LIKE '%Ryzen 9%' THEN 27000
        WHEN p.name LIKE '%i7%' THEN 19000
        WHEN p.name LIKE '%Ryzen 7%' THEN 18000
        WHEN p.name LIKE '%990 PRO%' THEN 12000
        WHEN p.name LIKE '%SN850%' THEN 8000
        WHEN p.name LIKE '%Crucial%' THEN 3000
        WHEN p.name LIKE '%Vengeance%' THEN 9000
        WHEN p.name LIKE '%Trident%' THEN 10000
        ELSE 5000
    END as buy_price,
    CASE 
        WHEN p.name LIKE '%i9%' THEN 32000
        WHEN p.name LIKE '%Ryzen 9%' THEN 31000
        WHEN p.name LIKE '%i7%' THEN 22000
        WHEN p.name LIKE '%Ryzen 7%' THEN 21000
        WHEN p.name LIKE '%990 PRO%' THEN 14000
        WHEN p.name LIKE '%SN850%' THEN 9500
        WHEN p.name LIKE '%Crucial%' THEN 3500
        WHEN p.name LIKE '%Vengeance%' THEN 10500
        WHEN p.name LIKE '%Trident%' THEN 11500
        ELSE 6000
    END as sell_price,
    10,
    10,
    NOW()
FROM products p;
