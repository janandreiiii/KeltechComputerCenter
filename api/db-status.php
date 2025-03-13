<?php
header('Content-Type: application/json');
require_once '../config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    
    // Get action parameter
    $action = isset($_GET['action']) ? $_GET['action'] : 'check';
    
    // Map our needs to existing tables - adjust SQL to match existing table structure
    $tables = [
        'categories' => [
            "CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )"
        ],
        'products' => [
            "CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                string_id VARCHAR(20) NOT NULL,
                name VARCHAR(255) NOT NULL,
                category_id INT,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"
        ],
        'specifications' => [  // Renamed from product_specifications
            "CREATE TABLE IF NOT EXISTS specifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"
        ],
        'batches' => [  // Renamed from product_batches
            "CREATE TABLE IF NOT EXISTS batches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                batch_id VARCHAR(50) NOT NULL,
                quantity INT NOT NULL DEFAULT 0,
                remaining INT NOT NULL DEFAULT 0,
                buy_price DECIMAL(10,2) NOT NULL,
                sell_price DECIMAL(10,2) NOT NULL,
                date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"
        ],
        'transactions' => [
            "CREATE TABLE IF NOT EXISTS transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                batch_id VARCHAR(50),
                type VARCHAR(20) NOT NULL,
                quantity INT NOT NULL,
                buy_price DECIMAL(10,2),
                sell_price DECIMAL(10,2),
                profit DECIMAL(10,2),
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"
        ]
    ];
    
    // Get the actual list of tables from the database
    $tableListQuery = "SHOW TABLES";
    $tableListStmt = $conn->prepare($tableListQuery);
    $tableListStmt->execute();
    
    $existingTables = $tableListStmt->fetchAll(PDO::FETCH_COLUMN);
    
    // Check table existence
    $status = [];
    foreach ($tables as $table => $create_sql) {
        $exists = in_array($table, $existingTables);
        $status[$table] = ['exists' => $exists, 'message' => $exists ? 'Table exists' : 'Table does not exist'];
        
        if (!$exists && $action === 'fix') {
            try {
                $conn->exec($create_sql[0]);
                $status[$table]['fixed'] = true;
                $status[$table]['message'] = 'Table created successfully';
            } catch (PDOException $createException) {
                $status[$table]['fixed'] = false;
                $status[$table]['error'] = $createException->getMessage();
            }
        }
    }
    
    // Calculate overall status
    $all_exist = array_reduce($status, function ($carry, $item) {
        return $carry && $item['exists'];
    }, true);
    
    // Add default data if fixing and all tables created successfully
    if ($action === 'fix' && array_reduce($status, function ($carry, $item) {
        return $carry && ($item['exists'] || isset($item['fixed']) && $item['fixed']);
    }, true)) {
        // Add default categories if they don't exist
        $categories = [
            'CPU', 'Motherboard', 'RAM', 'Storage', 'GPU', 'PSU', 'Desktop', 'Laptop'
        ];
        
        foreach ($categories as $category) {
            $checkStmt = $conn->prepare("SELECT id FROM categories WHERE name = ?");
            $checkStmt->execute([$category]);
            
            if (!$checkStmt->fetch()) {
                $insertStmt = $conn->prepare("INSERT INTO categories (name) VALUES (?)");
                $insertStmt->execute([$category]);
            }
        }
        
        $status['default_data'] = [
            'message' => 'Default categories added or already exist'
        ];
    }
    
    echo json_encode([
        'success' => true,
        'database' => [
            'name' => $db->db_name,
            'all_tables_exist' => $all_exist,
            'tables' => $status,
            'existing_tables' => $existingTables
        ],
        'action' => $action
    ]);
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error connecting to database',
        'error' => $e->getMessage(),
        'code' => $e->getCode()
    ]);
}
?>
