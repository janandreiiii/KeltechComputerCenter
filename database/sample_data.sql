USE keltech;

-- Insert categories
INSERT INTO categories (name) VALUES
('CPU'),
('Motherboard'),
('RAM'),
('Storage'),
('GPU'),
('PSU'),
('Case'),
('Cooling');

-- Insert products
INSERT INTO products (id, name, category_id, performance_score, power_draw) VALUES
('CPU001', 'AMD Ryzen 7 7800X3D', 1, 85, 120),
('CPU002', 'Intel Core i5-13600K', 1, 80, 125),
('MB001', 'ASUS ROG STRIX B650-F Gaming WiFi', 2, 75, 45),
('MB002', 'MSI PRO Z690-A WiFi', 2, 70, 40),
('RAM001', 'G.Skill Trident Z5 RGB', 3, 90, 15),
('RAM002', 'Corsair Vengeance LPX', 3, 75, 12),
('SSD001', 'Samsung 990 PRO 2TB', 4, 90, 8),
('GPU001', 'NVIDIA RTX 4080 SUPER', 5, 95, 320),
('GPU002', 'AMD RX 7800 XT', 5, 85, 263),
('PSU001', 'Corsair RM1000x', 6, 85, 0),
('PSU002', 'be quiet! Straight Power 11', 6, 80, 0);

-- Insert specifications
INSERT INTO specifications (product_id, name, value) VALUES
-- CPU001 specs
('CPU001', 'Cores', '8 Cores, 16 Threads'),
('CPU001', 'Clock Speed', '4.2GHz (Base) / 5.0GHz (Boost)'),
('CPU001', 'Cache', '104MB (L2+L3)'),
('CPU001', 'Socket', 'AM5'),
-- CPU002 specs
('CPU002', 'Cores', '14 Cores (6P + 8E), 20 Threads'),
('CPU002', 'Clock Speed', '3.5GHz (Base) / 5.1GHz (Boost)'),
('CPU002', 'Cache', '44MB (L2+L3)'),
('CPU002', 'Socket', 'LGA 1700'),
-- MB001 specs
('MB001', 'Socket', 'AM5'),
('MB001', 'Form Factor', 'ATX'),
('MB001', 'Memory Support', 'DDR5, up to 128GB'),
('MB001', 'PCIe', 'PCIe 5.0'),
-- MB002 specs
('MB002', 'Socket', 'LGA 1700'),
('MB002', 'Form Factor', 'ATX'),
('MB002', 'Memory Support', 'DDR4, up to 128GB'),
('MB002', 'PCIe', 'PCIe 5.0');

-- Insert batches
INSERT INTO batches (id, product_id, quantity, remaining, buy_price, sell_price, date_added) VALUES
('BATCH-001', 'CPU001', 10, 8, 20000.00, 24999.00, '2024-02-06 15:55:08'),
('BATCH-002', 'CPU002', 15, 12, 18000.00, 21999.00, '2024-02-06 15:55:08'),
('BATCH-003', 'MB001', 8, 5, 12000.00, 14999.00, '2024-02-06 15:55:08'),
('BATCH-004', 'MB002', 10, 7, 11000.00, 13499.00, '2024-02-06 15:55:08'),
('BATCH-005', 'RAM001', 20, 15, 7000.00, 8999.00, '2024-02-06 15:55:08'),
('BATCH-006', 'RAM002', 25, 18, 5500.00, 6999.00, '2024-02-06 15:55:08'),
('BATCH-007', 'GPU001', 5, 2, 45000.00, 54999.00, '2024-02-06 15:55:08'),
('BATCH-008', 'GPU002', 8, 4, 35000.00, 41999.00, '2024-02-06 15:55:08'),
('BATCH-009', 'SSD001', 12, 8, 9500.00, 11999.00, '2024-02-06 15:55:08'),
('BATCH-010', 'PSU001', 10, 6, 8500.00, 9999.00, '2024-02-06 15:55:08'),
('BATCH-011', 'PSU002', 15, 12, 7500.00, 8999.00, '2024-02-06 15:55:08'); 