<?php
header('Content-Type: application/json');
require_once 'db.php';

// Error handling function
function handleError($message, $code = 500) {
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'message' => $message,
        'code' => $code
    ]);
    exit;
}

// Validate transaction data
function validateTransactionData($data) {
    error_log('Validating transaction data: ' . json_encode($data));
    
    $required = ['productId', 'batchId', 'quantity', 'type'];
    foreach ($required as $field) {
        if (!isset($data[$field]) || $data[$field] === '') {
            error_log("Missing required field: $field");
            return false;
        }
    }

    if (!is_numeric($data['quantity']) || intval($data['quantity']) <= 0) {
        error_log("Invalid quantity: " . $data['quantity']);
        return false;
    }
    
    if (!in_array($data['type'], ['sale', 'purchase'])) {
        error_log("Invalid transaction type: " . $data['type']);
        return false;
    }

    return true;
}

try {
    $db = getDB();
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Get raw JSON data
    $rawData = file_get_contents('php://input');
    $data = json_decode($rawData, true);
    
    if (!empty($rawData) && json_last_error() !== JSON_ERROR_NONE) {
        handleError('Invalid JSON data: ' . json_last_error_msg(), 400);
    }
    
    switch ($method) {
        case 'POST':
            // Validate data
            if (!validateTransactionData($data)) {
                handleError('Missing or invalid transaction data', 400);
            }
            
            // Get the product ID and batch ID
            $productId = $data['productId'];
            $batchId = $data['batchId'];
            $quantity = (int)$data['quantity'];
            $type = $data['type'];
            
            try {
                $db->beginTransaction();
                
                // First check if the product exists
                $stmt = $db->prepare("SELECT id FROM products WHERE id = ? OR string_id = ?");
                $stmt->execute([$productId, $productId]);
                $productRow = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$productRow) {
                    $db->rollBack();
                    handleError('Product not found', 404);
                }
                
                $productDbId = $productRow['id'];
                
                // Check if batch exists and belongs to this product
                $stmt = $db->prepare("
                    SELECT b.id, b.remaining, b.sell_price, b.batch_id
                    FROM batches b
                    WHERE (b.batch_id = ? OR b.id = ?) 
                    AND b.product_id = ?
                ");
                
                // Log the search parameters
                error_log("Looking for batch: " . $batchId . " for product: " . $productDbId);
                
                $stmt->execute([$batchId, $batchId, $productDbId]);
                $batchRow = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$batchRow) {
                    error_log("Batch not found. Search params: batch_id=" . $batchId . ", product_id=" . $productDbId);
                    $db->rollBack();
                    handleError('Batch not found or does not belong to this product. Please check the batch ID.', 404);
                }
                
                $batchDbId = $batchRow['id'];
                
                // For sales, check if there's enough stock
                if ($type === 'sale') {
                    if ($quantity > $batchRow['remaining']) {
                        $db->rollBack();
                        handleError('Not enough stock in this batch', 400);
                    }
                    
                    // Update the batch remaining quantity
                    $stmt = $db->prepare("
                        UPDATE batches 
                        SET remaining = remaining - ? 
                        WHERE id = ?
                    ");
                    $stmt->execute([$quantity, $batchDbId]);
                }
                
                // Generate a transaction ID
                $transactionId = 'TX' . uniqid() . rand(1000, 9999);
                
                // Insert the transaction
                $stmt = $db->prepare("
                    INSERT INTO transactions 
                    (transaction_id, product_id, batch_id, type, quantity, price, date_added) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ");
                
                $price = isset($data['price']) ? (float)$data['price'] : $batchRow['sell_price'];
                $dateAdded = isset($data['date']) ? $data['date'] : date('Y-m-d H:i:s');
                
                $stmt->execute([
                    $transactionId,
                    $productDbId,
                    $batchDbId,
                    $type,
                    $quantity,
                    $price,
                    $dateAdded
                ]);
                
                $transactionDbId = $db->lastInsertId();
                
                $db->commit();
                
                echo json_encode([
                    'success' => true,
                    'transactionId' => $transactionId,
                    'message' => 'Transaction recorded successfully'
                ]);
                
            } catch (PDOException $e) {
                $db->rollBack();
                error_log("Database error: " . $e->getMessage());
                handleError('Database error: ' . $e->getMessage());
            }
            break;
            
        case 'GET':
            $productId = $_GET['productId'] ?? null;
            
            if (!$productId) {
                handleError('Product ID is required', 400);
            }
            
            // Get transactions for a product
            $stmt = $db->prepare("
                SELECT t.* FROM transactions t
                JOIN products p ON t.product_id = p.id
                WHERE p.id = ? OR p.string_id = ?
                ORDER BY t.date_added DESC
            ");
            
            $stmt->execute([$productId, $productId]);
            $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'transactions' => $transactions
            ]);
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