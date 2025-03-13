<?php
header('Content-Type: application/json');
require_once 'db.php';

function handleError($message, $code = 500) {
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'message' => $message,
        'code' => $code
    ]);
    exit;
}

function validateBatchData($batch) {
    return isset($batch['batch_id']) &&
           isset($batch['quantity']) &&
           isset($batch['remaining']) &&
           isset($batch['buy_price']) &&
           isset($batch['sell_price']);
}

function checkTableStructure($db) {
    try {
        // Create tables if they don't exist
        $db->exec("CREATE TABLE IF NOT EXISTS products (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            string_id VARCHAR(50),
            name VARCHAR(255) NOT NULL,
            category VARCHAR(50),
            specifications TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY string_id_unique (string_id)
        ) ENGINE=InnoDB");

        $db->exec("CREATE TABLE IF NOT EXISTS batches (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            batch_id VARCHAR(50),
            product_id BIGINT UNSIGNED NOT NULL,
            quantity INT NOT NULL DEFAULT 0,
            remaining INT NOT NULL DEFAULT 0,
            buy_price DECIMAL(10,2) NOT NULL,
            sell_price DECIMAL(10,2) NOT NULL,
            date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY batch_id_unique (batch_id),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        ) ENGINE=InnoDB");

        $db->exec("CREATE TABLE IF NOT EXISTS transactions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            transaction_id VARCHAR(50),
            product_id BIGINT UNSIGNED NOT NULL,
            batch_id BIGINT UNSIGNED NOT NULL,
            type ENUM('sale', 'purchase') NOT NULL,
            quantity INT NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY transaction_id_unique (transaction_id),
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
        ) ENGINE=InnoDB");

        return true;
    } catch (Exception $e) {
        error_log('Table structure check failed: ' . $e->getMessage());
        throw new Exception('Database structure check failed: ' . $e->getMessage());
    }
}

try {
    $db = getDB();
    
    // Check and fix table structure first
    checkTableStructure($db);
    
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Get ID from either query string or request body
    if ($method === 'DELETE') {
        $productId = $_GET['id'] ?? null;
    
        if (!$productId) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Product ID is required'
            ]);
            exit;
        }

        try {
            $db->beginTransaction();

            // Delete the product (cascading will handle related records)
            $stmt = $db->prepare("DELETE FROM products WHERE id = ?");
            $result = $stmt->execute([$productId]);

            if ($stmt->rowCount() === 0) {
                $db->rollBack();
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Product not found'
                ]);
                exit;
            }

            $db->commit();
            
            echo json_encode([
                'success' => true,
                'message' => 'Product deleted successfully'
            ]);
            
        } catch (PDOException $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
        exit;
    }

    // For non-DELETE requests, proceed with normal request body handling
    $rawData = file_get_contents('php://input');
    error_log("Raw input data: " . $rawData);
    
    $data = json_decode($rawData, true);
    if (!empty($rawData) && json_last_error() !== JSON_ERROR_NONE) {
        handleError('Invalid JSON data: ' . json_last_error_msg());
    }
    
    switch ($method) {
        case 'POST':
            if (!isset($data['name']) || !isset($data['category'])) {
                handleError('Missing required fields: name and category', 400);
            }
            
            // Start transaction
            $db->beginTransaction();
            
            try {
                // Check if string_id exists
                if (isset($data['string_id'])) {
                    $checkStmt = $db->prepare("SELECT id FROM products WHERE string_id = ?");
                    $checkStmt->execute([$data['string_id']]);
                    if ($checkStmt->rowCount() > 0) {
                        handleError('Product with this string_id already exists', 409);
                    }
                }

                // Insert product
                $stmt = $db->prepare("
                    INSERT INTO products (string_id, name, category, specifications) 
                    VALUES (:string_id, :name, :category, :specifications)
                ");
                
                $specifications = is_string($data['specifications']) 
                    ? $data['specifications'] 
                    : json_encode($data['specifications'] ?? []);
                
                $stmt->execute([
                    ':string_id' => $data['string_id'],
                    ':name' => $data['name'],
                    ':category' => $data['category'],
                    ':specifications' => $specifications
                ]);
                
                $productId = $db->lastInsertId();
                
                // Handle batches if present
                if (!empty($data['batches'])) {
                    $batchStmt = $db->prepare("
                        INSERT INTO batches (
                            batch_id, product_id, quantity, remaining, 
                            buy_price, sell_price, date_added
                        ) VALUES (
                            :batch_id, :product_id, :quantity, :remaining,
                            :buy_price, :sell_price, :date_added
                        )
                    ");
                    
                    foreach ($data['batches'] as $batch) {
                        if (!validateBatchData($batch)) {
                            $db->rollBack();
                            handleError('Invalid batch data structure', 400);
                        }
                        
                        try {
                            $batchStmt->execute([
                                ':batch_id' => $batch['batch_id'],
                                ':product_id' => $productId,
                                ':quantity' => $batch['quantity'],
                                ':remaining' => $batch['remaining'],
                                ':buy_price' => $batch['buy_price'],
                                ':sell_price' => $batch['sell_price'],
                                ':date_added' => $batch['date_added'] ?? date('Y-m-d H:i:s')
                            ]);
                        } catch (PDOException $e) {
                            error_log("Batch insertion error: " . $e->getMessage());
                            $db->rollBack();
                            handleError('Error inserting batch: ' . $e->getMessage());
                        }
                    }
                }
                
                $db->commit();
                
                // Return success with product data
                echo json_encode([
                    'success' => true,
                    'id' => $productId,
                    'string_id' => $data['string_id'],
                    'message' => 'Product created successfully'
                ]);
                
            } catch (Exception $e) {
                $db->rollBack();
                error_log("Product creation error: " . $e->getMessage());
                handleError('Error creating product: ' . $e->getMessage());
            }
            break;
            
        case 'PUT':
            // Similar structure for PUT...
            break;

        case 'DELETE':
            if (!isset($data['id'])) {
                handleError('Product ID is required', 400);
            }

            $id = filter_var($data['id'], FILTER_VALIDATE_INT);
            if ($id === false) {
                handleError('Invalid product ID format', 400);
            }

            try {
                // Start transaction
                $db->beginTransaction();

                // Check if product exists first
                $checkStmt = $db->prepare("SELECT id FROM products WHERE id = ?");
                $checkStmt->execute([$id]);
                if ($checkStmt->rowCount() === 0) {
                    $db->rollBack();
                    handleError('Product not found', 404);
                }

                // Delete batches (cascade will handle related transactions)
                $stmt = $db->prepare("DELETE FROM batches WHERE product_id = ?");
                $stmt->execute([$id]);

                // Delete the product
                $stmt = $db->prepare("DELETE FROM products WHERE id = ?");
                $stmt->execute([$id]);

                $db->commit();

                echo json_encode([
                    'success' => true,
                    'message' => 'Product deleted successfully'
                ]);
            } catch (PDOException $e) {
                $db->rollBack();
                error_log('Delete error: ' . $e->getMessage());
                handleError('Database error: ' . $e->getMessage());
            }
            break;
            
        default:
            handleError('Method not allowed', 405);
            break;
    }
} catch (Exception $e) {
    error_log("Server error: " . $e->getMessage());
    handleError('Server error: ' . $e->getMessage());
}
?>