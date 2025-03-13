-- Create temporary table to store existing data
CREATE TABLE IF NOT EXISTS customer_builds_temp (
    id INT NOT NULL AUTO_INCREMENT,
    customer_id INT NOT NULL,
    tracking_id VARCHAR(20) NOT NULL,
    build_data JSON NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY tracking_id (tracking_id),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Copy existing data with JSON conversion
INSERT INTO customer_builds_temp (customer_id, tracking_id, total_price, status, date_created, build_data)
SELECT 
    customer_id,
    tracking_id,
    total_price,
    status,
    date_created,
    JSON_OBJECT(
        'cpu', CASE WHEN cpu_id IS NOT NULL THEN 
            JSON_OBJECT(
                'id', cpu_id,
                'price', cpu_price,
                'batch_id', NULL
            )
        ELSE NULL END,
        'motherboard', CASE WHEN motherboard_id IS NOT NULL THEN 
            JSON_OBJECT(
                'id', motherboard_id,
                'price', motherboard_price,
                'batch_id', NULL
            )
        ELSE NULL END,
        'ram', CASE WHEN ram_id IS NOT NULL THEN 
            JSON_OBJECT(
                'id', ram_id,
                'price', ram_price,
                'batch_id', NULL
            )
        ELSE NULL END,
        'storage', CASE WHEN storage_id IS NOT NULL THEN 
            JSON_OBJECT(
                'id', storage_id,
                'price', storage_price,
                'batch_id', NULL
            )
        ELSE NULL END,
        'gpu', CASE WHEN gpu_id IS NOT NULL THEN 
            JSON_OBJECT(
                'id', gpu_id,
                'price', gpu_price,
                'batch_id', NULL
            )
        ELSE NULL END,
        'psu', CASE WHEN psu_id IS NOT NULL THEN 
            JSON_OBJECT(
                'id', psu_id,
                'price', psu_price,
                'batch_id', NULL
            )
        ELSE NULL END
    )
FROM customer_builds;

-- Rename tables
RENAME TABLE customer_builds TO customer_builds_old,
             customer_builds_temp TO customer_builds;

-- Drop old table
DROP TABLE customer_builds_old; 