<?php
header('Content-Type: application/json');
require_once 'db-connect.php';

try {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!$data) {
        throw new Exception('Invalid input data');
    }
    
    $db->beginTransaction();
    
    // Get category_id from category name
    $stmt = $db->prepare("SELECT id FROM categories WHERE name = ?");
    $stmt->execute([$data['category']]);
    $category_id = $stmt->fetchColumn();
    
    if (!$category_id) {
        throw new Exception('Invalid category');
    }
    
    // Insert product
    $stmt = $db->prepare("
        INSERT INTO products (name, category_id, performance_score, power_draw)
        VALUES (:name, :category_id, :performance_score, :power_draw)
    ");
    
    $stmt->execute([
        ':name' => $data['name'],
        ':category_id' => $category_id,
        ':performance_score' => $data['performance_score'] ?? 0,
        ':power_draw' => $data['power_draw'] ?? 0
    ]);
    
    $productId = $db->lastInsertId();
    
    // Insert specifications
    if (!empty($data['specifications'])) {
        $stmt = $db->prepare("
            INSERT INTO product_specifications (product_id, name, value)
            VALUES (:product_id, :name, :value)
        ");
        
        foreach ($data['specifications'] as $spec) {
            $stmt->execute([
                ':product_id' => $productId,
                ':name' => $spec['name'],
                ':value' => $spec['value']
            ]);
        }
    }
    
    // Insert initial batch
    if (!empty($data['batch'])) {
        $stmt = $db->prepare("
            INSERT INTO product_batches (
                product_id, batch_number, buy_price, sell_price, 
                initial_quantity, remaining, date_added
            )
            VALUES (
                :product_id, :batch_number, :buy_price, :sell_price,
                :initial_quantity, :remaining, NOW()
            )
        ");
        
        $stmt->execute([
            ':product_id' => $productId,
            ':batch_number' => 'BATCH' . str_pad($productId, 4, '0', STR_PAD_LEFT),
            ':buy_price' => $data['batch']['buy_price'],
            ':sell_price' => $data['batch']['sell_price'],
            ':initial_quantity' => $data['batch']['quantity'],
            ':remaining' => $data['batch']['quantity']
        ]);
    }
    
    $db->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Product added successfully',
        'product_id' => $productId
    ]);
    
} catch (Exception $e) {
    if (isset($db)) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
