<?php
// Database connection settings
$host = 'localhost';
$dbname = 'keltech';
$username = 'root';
$password = 'root';

// Function to convert ISO 8601 to MySQL datetime
function convertDateTime($isoDate) {
    return date('Y-m-d H:i:s', strtotime($isoDate));
}

try {
    // Connect to MySQL
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Read JSON file
    $jsonFile = 'data/inventory.json';
    if (!file_exists($jsonFile)) {
        throw new Exception("JSON file not found: $jsonFile");
    }
    
    $jsonContent = file_get_contents($jsonFile);
    if ($jsonContent === false) {
        throw new Exception("Failed to read JSON file: $jsonFile");
    }
    
    $jsonData = json_decode($jsonContent, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("JSON decode error: " . json_last_error_msg());
    }
    
    if (!isset($jsonData['inventory']) || !is_array($jsonData['inventory'])) {
        throw new Exception("Invalid JSON structure: 'inventory' array not found");
    }
    
    // Begin transaction
    $pdo->beginTransaction();
    $hasTransaction = true;
    
    // Prepare statements
    $stmtCategory = $pdo->prepare("INSERT IGNORE INTO categories (name) VALUES (?)");
    $stmtProduct = $pdo->prepare("INSERT INTO products (id, name, category_id, performance_score, power_draw) VALUES (?, ?, (SELECT id FROM categories WHERE name = ?), ?, ?)");
    $stmtSpec = $pdo->prepare("INSERT INTO specifications (product_id, name, value) VALUES (?, ?, ?)");
    $stmtBatch = $pdo->prepare("INSERT INTO batches (id, product_id, quantity, remaining, buy_price, sell_price, date_added) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmtTransaction = $pdo->prepare("INSERT INTO transactions (product_id, batch_id, type, quantity, buy_price, sell_price, profit, transaction_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    
    echo "Starting migration...\n";
    echo "Found " . count($jsonData['inventory']) . " products to migrate\n";
    
    // Insert categories first
    $categories = array_unique(array_column($jsonData['inventory'], 'category'));
    foreach ($categories as $category) {
        $stmtCategory->execute([$category]);
    }
    echo "Inserted " . count($categories) . " categories\n";
    
    $productsProcessed = 0;
    $specificationsProcessed = 0;
    $batchesProcessed = 0;
    $transactionsProcessed = 0;
    
    // Process each product
    foreach ($jsonData['inventory'] as $product) {
        // Insert product
        $stmtProduct->execute([
            $product['id'],
            $product['name'],
            $product['category'],
            $product['performance_score'] ?? null,
            $product['power_draw'] ?? null
        ]);
        $productsProcessed++;
        
        // Insert specifications
        if (isset($product['specifications'])) {
            foreach ($product['specifications'] as $spec) {
                $stmtSpec->execute([
                    $product['id'],
                    $spec['name'],
                    $spec['value']
                ]);
                $specificationsProcessed++;
            }
        }
        
        // Insert batches
        if (isset($product['batches'])) {
            foreach ($product['batches'] as $batch) {
                $stmtBatch->execute([
                    $batch['batchId'],
                    $product['id'],
                    $batch['quantity'],
                    $batch['remaining'],
                    $batch['buyPrice'],
                    $batch['sellPrice'],
                    convertDateTime($batch['dateAdded'])
                ]);
                $batchesProcessed++;
            }
        }
        
        // Insert transactions
        if (isset($product['transactions'])) {
            foreach ($product['transactions'] as $transaction) {
                $stmtTransaction->execute([
                    $product['id'],
                    $transaction['batchId'],
                    $transaction['type'],
                    $transaction['quantity'],
                    $transaction['buyPrice'],
                    $transaction['sellPrice'],
                    $transaction['profit'] ?? null,
                    convertDateTime($transaction['date'])
                ]);
                $transactionsProcessed++;
            }
        }
    }
    
    // Commit transaction
    $pdo->commit();
    $hasTransaction = false;
    
    echo "\nMigration completed successfully!\n";
    echo "Processed:\n";
    echo "- $productsProcessed products\n";
    echo "- $specificationsProcessed specifications\n";
    echo "- $batchesProcessed batches\n";
    echo "- $transactionsProcessed transactions\n";
    
} catch (Exception $e) {
    // Rollback transaction on error
    if (isset($hasTransaction) && $hasTransaction && isset($pdo)) {
        $pdo->rollBack();
    }
    echo "Error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
} 