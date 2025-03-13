<?php
header('Content-Type: application/json');
require_once 'db.php';

function checkTableExists($db, $tableName) {
    try {
        $stmt = $db->prepare("SHOW TABLES LIKE ?");
        $stmt->execute([$tableName]);
        return $stmt->rowCount() > 0;
    } catch (PDOException $e) {
        return false;
    }
}

function checkTableStructure($db, $tableName, $expectedColumns) {
    try {
        $stmt = $db->prepare("DESCRIBE $tableName");
        $stmt->execute();
        $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        $missingColumns = array_diff($expectedColumns, $columns);
        $extraColumns = array_diff($columns, $expectedColumns);
        
        return [
            'exists' => true,
            'complete' => count($missingColumns) === 0,
            'missing' => $missingColumns,
            'extra' => $extraColumns,
            'columns' => $columns
        ];
    } catch (PDOException $e) {
        return [
            'exists' => false,
            'error' => $e->getMessage()
        ];
    }
}

function fixTable($db, $tableName) {
    $fixes = [];
    
    switch ($tableName) {
        case 'products':
            if (!checkTableExists($db, 'products')) {
                $db->exec("CREATE TABLE products (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    string_id VARCHAR(50) UNIQUE,
                    name VARCHAR(255) NOT NULL,
                    category VARCHAR(50),
                    specifications TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )");
                $fixes[] = "Created products table";
            }
            break;
            
        case 'batches':
            if (!checkTableExists($db, 'batches')) {
                $db->exec("CREATE TABLE batches (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    batch_id VARCHAR(50) UNIQUE,
                    product_id BIGINT UNSIGNED NOT NULL,
                    quantity INT NOT NULL DEFAULT 0,
                    remaining INT NOT NULL DEFAULT 0,
                    buy_price DECIMAL(10,2) NOT NULL,
                    sell_price DECIMAL(10,2) NOT NULL,
                    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
                )");
                $fixes[] = "Created batches table";
            } else {
                // Check and fix column names
                $structure = checkTableStructure($db, 'batches', [
                    'id', 'batch_id', 'product_id', 'quantity', 'remaining', 'buy_price', 'sell_price', 'date_added'
                ]);
                
                // Fix common column name issues
                if (in_array('buyPrice', $structure['columns']) && !in_array('buy_price', $structure['columns'])) {
                    $db->exec("ALTER TABLE batches CHANGE buyPrice buy_price DECIMAL(10,2) NOT NULL");
                    $fixes[] = "Renamed buyPrice to buy_price";
                }
                
                if (in_array('sellPrice', $structure['columns']) && !in_array('sell_price', $structure['columns'])) {
                    $db->exec("ALTER TABLE batches CHANGE sellPrice sell_price DECIMAL(10,2) NOT NULL");
                    $fixes[] = "Renamed sellPrice to sell_price";
                }
                
                if (in_array('dateAdded', $structure['columns']) && !in_array('date_added', $structure['columns'])) {
                    $db->exec("ALTER TABLE batches CHANGE dateAdded date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
                    $fixes[] = "Renamed dateAdded to date_added";
                }
                
                if (in_array('batchId', $structure['columns']) && !in_array('batch_id', $structure['columns'])) {
                    $db->exec("ALTER TABLE batches CHANGE batchId batch_id VARCHAR(50)");
                    $fixes[] = "Renamed batchId to batch_id";
                }
                
                if (in_array('productId', $structure['columns']) && !in_array('product_id', $structure['columns'])) {
                    $db->exec("ALTER TABLE batches CHANGE productId product_id BIGINT UNSIGNED NOT NULL");
                    $fixes[] = "Renamed productId to product_id";
                }
            }
            break;
            
        case 'transactions':
            if (!checkTableExists($db, 'transactions')) {
                $db->exec("CREATE TABLE transactions (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    transaction_id VARCHAR(50) UNIQUE,
                    product_id BIGINT UNSIGNED NOT NULL,
                    batch_id BIGINT UNSIGNED NOT NULL,
                    type ENUM('sale', 'purchase') NOT NULL,
                    quantity INT NOT NULL,
                    price DECIMAL(10,2) NOT NULL,
                    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
                )");
                $fixes[] = "Created transactions table";
            }
            break;
    }
    
    return $fixes;
}

try {
    $db = getDB();
    $action = $_GET['action'] ?? 'check';
    
    $tables = ['products', 'batches', 'transactions'];
    $expected = [
        'products' => ['id', 'string_id', 'name', 'category', 'specifications', 'created_at', 'updated_at'],
        'batches' => ['id', 'batch_id', 'product_id', 'quantity', 'remaining', 'buy_price', 'sell_price', 'date_added'],
        'transactions' => ['id', 'transaction_id', 'product_id', 'batch_id', 'type', 'quantity', 'price', 'date_added']
    ];
    
    if ($action === 'check') {
        $results = [];
        
        foreach ($tables as $table) {
            if (checkTableExists($db, $table)) {
                $results[$table] = checkTableStructure($db, $table, $expected[$table]);
            } else {
                $results[$table] = ['exists' => false];
            }
        }
        
        echo json_encode([
            'success' => true,
            'results' => $results
        ]);
    } elseif ($action === 'fix') {
        $allFixes = [];
        
        foreach ($tables as $table) {
            $fixes = fixTable($db, $table);
            if (count($fixes) > 0) {
                $allFixes[$table] = $fixes;
            }
        }
        
        echo json_encode([
            'success' => true,
            'fixes_applied' => $allFixes
        ]);
    } else {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid action'
        ]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>
