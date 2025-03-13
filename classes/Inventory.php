<?php
class Inventory {
    private $db;
    
    public function __construct($db) {
        $this->db = $db;
    }
    
    public function getAll() {
        try {
            $sql = "
                SELECT 
                    p.id,
                    p.string_id,
                    p.name,
                    c.name as category,
                    p.performance_score,
                    p.power_draw,
                    DATE_FORMAT(p.updated_at, '%Y-%m-%d %H:%i:%s') as lastUpdated
                FROM products p
                JOIN categories c ON p.category_id = c.id
                ORDER BY p.id
            ";
            
            $products = $this->db->fetchAll($sql);
            
            // Get additional data for each product
            foreach ($products as &$product) {
                // Use string_id as the main id for frontend
                $product['id'] = $product['string_id'];
                unset($product['string_id']);
                
                // Get specifications and batches
                $product['specifications'] = $this->getSpecifications($product['id']);
                $product['batches'] = $this->getBatches($product['id']);
                
                // Format dates in batches
                foreach ($product['batches'] as &$batch) {
                    $batch['dateAdded'] = date('Y-m-d H:i:s', strtotime($batch['dateAdded']));
                }
            }
            
            return $products;
            
        } catch (Exception $e) {
            error_log("Error in Inventory->getAll: " . $e->getMessage());
            throw $e;
        }
    }
    
    private function getSpecifications($stringId) {
        try {
            // Get numeric ID first
            $product = $this->db->fetch(
                "SELECT id FROM products WHERE string_id = ?",
                [$stringId]
            );
            
            if (!$product) {
                return [];
            }

            $sql = "
                SELECT name, value 
                FROM specifications 
                WHERE product_id = ?
                ORDER BY id
            ";
            return $this->db->fetchAll($sql, [$product['id']]);
            
        } catch (Exception $e) {
            error_log("Error in Inventory->getSpecifications: " . $e->getMessage());
            return [];
        }
    }
    
    private function getBatches($stringId) {
        try {
            // Get numeric ID first
            $product = $this->db->fetch(
                "SELECT id FROM products WHERE string_id = ?",
                [$stringId]
            );
            
            if (!$product) {
                return [];
            }

            $sql = "
                SELECT 
                    id as batchId,
                    quantity,
                    remaining,
                    buy_price as buyPrice,
                    sell_price as sellPrice,
                    DATE_FORMAT(date_added, '%Y-%m-%d %H:%i:%s') as dateAdded
                FROM batches 
                WHERE product_id = ?
                ORDER BY date_added DESC
            ";
            return $this->db->fetchAll($sql, [$product['id']]);
            
        } catch (Exception $e) {
            error_log("Error in Inventory->getBatches: " . $e->getMessage());
            return [];
        }
    }
    
    public function getStats() {
        try {
            // Get total number of products
            $totalProducts = $this->db->fetch("SELECT COUNT(*) as count FROM products")['count'];
            
            // Get total inventory value
            $totalValue = $this->db->fetch("
                SELECT SUM(b.remaining * b.buy_price) as total
                FROM batches b
            ")['total'] ?? 0;
            
            // Get number of products with low stock
            $lowStockCount = $this->db->fetch("
                SELECT COUNT(DISTINCT p.id) as count
                FROM products p
                LEFT JOIN batches b ON p.id = b.product_id
                GROUP BY p.id
                HAVING SUM(COALESCE(b.remaining, 0)) < 5
            ")['count'] ?? 0;
            
            return [
                'totalProducts' => $totalProducts,
                'totalValue' => $totalValue,
                'lowStockCount' => $lowStockCount
            ];
            
        } catch (Exception $e) {
            error_log("Error in Inventory->getStats: " . $e->getMessage());
            throw $e;
        }
    }
}
?> 