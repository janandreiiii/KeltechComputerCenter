<?php
require_once '../classes/Database.php';
require_once '../classes/ProductMetrics.php';

header('Content-Type: application/json');

try {
    $db = new Database();
    $metrics = new ProductMetrics($db->getConnection());

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Get POST data
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data) {
            throw new Exception('Invalid request data');
        }

        // Start transaction
        $db->getConnection()->beginTransaction();

        try {
            // Insert product
            $query = "INSERT INTO products (string_id, name, category_id) VALUES (?, ?, ?)";
            $stmt = $db->getConnection()->prepare($query);
            $stmt->execute([$data['string_id'], $data['name'], $data['category_id']]);
            
            $productId = $db->getConnection()->lastInsertId();

            // Insert specifications
            if (isset($data['specifications']) && is_array($data['specifications'])) {
                $query = "INSERT INTO specifications (product_id, name, value) VALUES (?, ?, ?)";
                $stmt = $db->getConnection()->prepare($query);
                
                foreach ($data['specifications'] as $spec) {
                    $stmt->execute([$productId, $spec['name'], $spec['value']]);
                }
            }

            // Calculate metrics
            $metrics->calculateMetrics($productId);

            // Commit transaction
            $db->getConnection()->commit();

            echo json_encode([
                'success' => true,
                'message' => 'Product added successfully',
                'product_id' => $productId
            ]);
        } catch (Exception $e) {
            $db->getConnection()->rollBack();
            throw $e;
        }
    } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        // Get PUT data
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!$data || !isset($data['id'])) {
            throw new Exception('Invalid request data');
        }

        // Start transaction
        $db->getConnection()->beginTransaction();

        try {
            // Update product
            $query = "UPDATE products SET name = ?, category_id = ? WHERE id = ?";
            $stmt = $db->getConnection()->prepare($query);
            $stmt->execute([$data['name'], $data['category_id'], $data['id']]);

            // Update specifications
            if (isset($data['specifications']) && is_array($data['specifications'])) {
                // Delete existing specifications
                $query = "DELETE FROM specifications WHERE product_id = ?";
                $stmt = $db->getConnection()->prepare($query);
                $stmt->execute([$data['id']]);

                // Insert new specifications
                $query = "INSERT INTO specifications (product_id, name, value) VALUES (?, ?, ?)";
                $stmt = $db->getConnection()->prepare($query);
                
                foreach ($data['specifications'] as $spec) {
                    $stmt->execute([$data['id'], $spec['name'], $spec['value']]);
                }
            }

            // Recalculate metrics
            $metrics->calculateMetrics($data['id']);

            // Commit transaction
            $db->getConnection()->commit();

            echo json_encode([
                'success' => true,
                'message' => 'Product updated successfully'
            ]);
        } catch (Exception $e) {
            $db->getConnection()->rollBack();
            throw $e;
        }
    } else {
        throw new Exception('Invalid request method');
    }
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
} 