<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../classes/Database.php';
require_once __DIR__ . '/../classes/Product.php';

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

// Validate batch data
function validateBatchData($data) {
    error_log('Validating batch data: ' . json_encode($data));
    
    // Check required fields
    $required = ['productId', 'quantity', 'buyPrice', 'sellPrice'];
    foreach ($required as $field) {
        if (!isset($data[$field]) || $data[$field] === '') {
            error_log("Missing required field: $field");
            return false;
        }
    }

    // Generate new batch ID if missing or invalid
    if (empty($data['batchId']) || !preg_match('/^BATCH-[0-9a-z-]+$/', $data['batchId'])) {
        $data['batchId'] = 'BATCH-' . time() . '-' . substr(uniqid(), -5);
        error_log("Generated new batch ID: " . $data['batchId']);
    }

    // Validate numeric values
    if (!is_numeric($data['quantity']) || intval($data['quantity']) <= 0) {
        error_log("Invalid quantity: " . $data['quantity']);
        return false;
    }

    if (!is_numeric($data['buyPrice']) || floatval($data['buyPrice']) <= 0) {
        error_log("Invalid buy price: " . $data['buyPrice']);
        return false;
    }

    if (!is_numeric($data['sellPrice']) || floatval($data['sellPrice']) <= 0) {
        error_log("Invalid sell price: " . $data['sellPrice']);
        return false;
    }

    return true;
}

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $db = getDB();
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Log raw request data
    $rawData = file_get_contents('php://input');
    error_log("Raw request data: " . $rawData);
    
    $data = json_decode($rawData, true);
    if (!empty($rawData) && json_last_error() !== JSON_ERROR_NONE) {
        handleError('Invalid JSON data: ' . json_last_error_msg(), 400);
    }
    
    switch ($method) {
        case 'POST':
            // Log received data
            error_log("Processing batch data: " . json_encode($data));
            
            // Validate data
            if (!validateBatchData($data)) {
                handleError('Missing or invalid batch data', 400);
            }
            
            // Get the product ID
            $productId = $data['productId'] ?? null;
            
            if (empty($productId)) {
                handleError('Product ID is required', 400);
            }
            
            try {
                $db->beginTransaction();
                
                // First check if the product exists
                $stmt = $db->prepare("SELECT id FROM products WHERE id = ? OR string_id = ?");
                $stmt->execute([$productId, $productId]);
                $productRow = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$productRow) {
                    $db->rollBack();
                    handleError("Product not found: $productId", 404);
                }
                
                $productDbId = $productRow['id'];
                
                // Check if batch ID already exists
                $stmt = $db->prepare("SELECT id FROM batches WHERE batch_id = ?");
                $stmt->execute([$data['batchId']]);
                
                if ($stmt->rowCount() > 0) {
                    $db->rollBack();
                    handleError('Batch ID already exists', 409);
                }
                
                // Insert the new batch
                $stmt = $db->prepare("
                    INSERT INTO batches 
                    (batch_id, product_id, quantity, remaining, buy_price, sell_price, date_added) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ");
                
                $quantity = (int)$data['quantity'];
                $buyPrice = round((float)$data['buyPrice'], 2);
                $sellPrice = round((float)$data['sellPrice'], 2);
                $dateAdded = date('Y-m-d H:i:s');
                
                $stmt->execute([
                    $data['batchId'],
                    $productDbId,
                    $quantity,
                    $quantity, // Initially, remaining = quantity
                    $buyPrice,
                    $sellPrice,
                    $dateAdded
                ]);
                
                $batchId = $db->lastInsertId();
                
                $db->commit();
                
                echo json_encode([
                    'success' => true,
                    'batchId' => $batchId,
                    'message' => 'Batch created successfully'
                ]);
                
            } catch (PDOException $e) {
                $db->rollBack();
                error_log("Database error: " . $e->getMessage());
                handleError('Database error: ' . $e->getMessage(), 500);
            }
            break;
            
        case 'GET':
            $productId = $_GET['productId'] ?? null;
            
            if (!$productId) {
                handleError('Product ID is required', 400);
            }
            
            // Get batches for a product
            $stmt = $db->prepare("
                SELECT b.* FROM batches b
                JOIN products p ON b.product_id = p.id
                WHERE p.id = ? OR p.string_id = ?
                ORDER BY b.date_added DESC
            ");
            
            $stmt->execute([$productId, $productId]);
            $batches = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'batches' => $batches
            ]);
            break;
            
        default:
            handleError('Method not allowed', 405);
            break;
    }
} catch (Exception $e) {
    error_log("Server error: " . $e->getMessage());
    handleError('Server error: ' . $e->getMessage(), 500);
}
?>