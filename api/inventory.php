<?php
header('Content-Type: application/json');
require_once 'db.php';

try {
    $db = getDB();
    
    $query = "
        SELECT 
            p.*,
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'batch_id', b.batch_id,
                    'quantity', b.quantity,
                    'remaining', b.remaining,
                    'buyPrice', b.buy_price,
                    'sellPrice', b.sell_price,
                    'dateAdded', b.date_added
                )
            ) as batches
        FROM products p
        LEFT JOIN batches b ON p.id = b.product_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
    ";

    $stmt = $db->prepare($query);
    $stmt->execute();
    
    $inventory = array_map(function($row) {
        $row['specifications'] = json_decode($row['specifications'] ?? '[]', true) ?? [];
        $row['batches'] = array_filter(
            json_decode($row['batches'] ?? '[]', true) ?? [],
            fn($batch) => $batch['batch_id'] !== null
        );
        return $row;
    }, $stmt->fetchAll());

    echo json_encode(['success' => true, 'inventory' => $inventory]);

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>