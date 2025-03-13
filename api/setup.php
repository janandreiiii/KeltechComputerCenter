<?php
header('Content-Type: application/json');
require_once '../config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    
    // Enable foreign key support for SQLite
    if ($conn->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $conn->exec('PRAGMA foreign_keys = ON');
    }
    
    // First check what tables already exist
    $existingTables = [];
    $tableQuery = "SHOW TABLES";
    $tableStmt = $conn->query($tableQuery);
    
    while ($tableRow = $tableStmt->fetch(PDO::FETCH_NUM)) {
        $existingTables[] = $tableRow[0];
    }
    
    // Get DB system info for better diagnosis
    $dbInfo = [
        'db_name' => $db->db_name,
        'existing_tables' => $existingTables,
        'driver' => $conn->getAttribute(PDO::ATTR_DRIVER_NAME),
        'server_version' => $conn->getAttribute(PDO::ATTR_SERVER_VERSION),
        'client_version' => $conn->getAttribute(PDO::ATTR_CLIENT_VERSION)
    ];
    
    $conn->exec("SET FOREIGN_KEY_CHECKS = 0");
    
    // Create tables with proper structure
    $conn->exec("CREATE TABLE IF NOT EXISTS products (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        string_id VARCHAR(50) UNIQUE,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50),
        specifications TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB");

    $conn->exec("CREATE TABLE IF NOT EXISTS batches (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        batch_id VARCHAR(50) UNIQUE,
        product_id BIGINT UNSIGNED NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        remaining INT NOT NULL DEFAULT 0,
        buy_price DECIMAL(10,2) NOT NULL,
        sell_price DECIMAL(10,2) NOT NULL,
        date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB");

    $conn->exec("SET FOREIGN_KEY_CHECKS = 1");

    echo json_encode(['success' => true, 'message' => 'Database setup completed']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
