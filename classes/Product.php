<?php
class Product {
    private $db;
    
    public function __construct($db = null) {
        $this->db = $db ?? Database::getInstance();
    }
    
    public function getAll() {
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
            
            $product['specifications'] = $this->getSpecifications($product['id']);
            $product['batches'] = $this->getBatches($product['id']);
            
            // Format dates in batches
            foreach ($product['batches'] as &$batch) {
                $batch['dateAdded'] = date('Y-m-d H:i:s', strtotime($batch['dateAdded']));
            }
        }
        
        return $products;
    }
    
    public function getById($id) {
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
            WHERE p.string_id = ?
        ";
        return $this->db->fetch($sql, [$id]);
    }
    
    public function getSpecifications($stringId) {
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
    }
    
    public function getBatches($stringId) {
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
    }
    
    public function getTransactions($stringId) {
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
                type,
                quantity,
                buy_price as buyPrice,
                sell_price as sellPrice,
                profit,
                transaction_date as date,
                batch_id as batchId
            FROM transactions 
            WHERE product_id = ?
            ORDER BY transaction_date DESC
        ";
        return $this->db->fetchAll($sql, [$product['id']]);
    }
    
    public function create($data) {
        error_log("Starting product creation with data: " . print_r($data, true));

        // Validate required fields
        if (empty($data['name'])) {
            error_log("Product creation failed: name is empty");
            throw new Exception('Product name is required');
        }

        if (empty($data['category'])) {
            error_log("Product creation failed: category is empty");
            throw new Exception('Product category is required');
        }

        $pdo = $this->db->getConnection();
        $pdo->beginTransaction();
        
        try {
            // Insert or get category
            error_log("Inserting/getting category: " . $data['category']);
            $this->db->query(
                "INSERT IGNORE INTO categories (name) VALUES (?)",
                [$data['category']]
            );
            
            $category = $this->db->fetch(
                "SELECT id FROM categories WHERE name = ?",
                [$data['category']]
            );
            
            if (!$category || !isset($category['id'])) {
                throw new Exception('Failed to get category ID');
            }

            // Generate string_id if not provided
            $string_id = isset($data['id']) ? $data['id'] : $this->generateProductId();
            error_log("Using string_id: " . $string_id);

            // Get next numeric ID
            $result = $this->db->fetch("SELECT COALESCE(MAX(id), 0) as max_id FROM products");
            $nextId = ($result && isset($result['max_id'])) ? intval($result['max_id']) + 1 : 1;
            error_log("Next numeric ID: " . $nextId);

            // Verify the ID is not already in use
            $existingProduct = $this->db->fetch("SELECT id FROM products WHERE id = ?", [$nextId]);
            if ($existingProduct) {
                // If ID exists, get the next available ID
                $nextId = $this->db->fetch("
                    SELECT MIN(t1.id + 1) as next_id
                    FROM products t1
                    LEFT JOIN products t2 ON t1.id + 1 = t2.id
                    WHERE t2.id IS NULL
                ")['next_id'];
                
                if (!$nextId) {
                    throw new Exception('Could not generate a unique product ID');
                }
                error_log("Found next available ID: " . $nextId);
            }
            
            // Insert product
            $sql = "INSERT INTO products (id, string_id, name, category_id, performance_score, power_draw) VALUES (?, ?, ?, ?, ?, ?)";
            $params = [
                $nextId,
                $string_id,
                $data['name'],
                $category['id'],
                $data['performance_score'] ?? null,
                $data['power_draw'] ?? null
            ];
            
            error_log("Inserting product with SQL: " . $sql);
            error_log("Parameters: " . print_r($params, true));
            
            $stmt = $this->db->query($sql, $params);
            if (!$stmt) {
                throw new Exception('Failed to insert product');
            }

            // Verify product was inserted
            $verifyProduct = $this->db->fetch("SELECT id FROM products WHERE id = ?", [$nextId]);
            if (!$verifyProduct) {
                throw new Exception('Product insertion failed - could not verify product ID');
            }
            
            // Insert specifications
            if (isset($data['specifications']) && is_array($data['specifications'])) {
                error_log("Processing specifications: " . print_r($data['specifications'], true));
                foreach ($data['specifications'] as $spec) {
                    if (isset($spec['name']) && isset($spec['value'])) {
                        $specSql = "INSERT INTO specifications (product_id, name, value) VALUES (?, ?, ?)";
                        try {
                            $this->db->query($specSql, [$nextId, $spec['name'], $spec['value']]);
                        } catch (Exception $e) {
                            error_log("Error inserting specification: " . $e->getMessage());
                            continue;
                        }
                    }
                }
            }

            // Handle batch creation
            try {
                // Prepare batch data
                $batchData = [
                    'batchId' => 'BATCH-' . date('ymd') . '-' . strtoupper(substr(uniqid(), -4)),
                    'quantity' => isset($data['quantity']) ? intval($data['quantity']) : 1,
                    'remaining' => isset($data['quantity']) ? intval($data['quantity']) : 1,
                    'buyPrice' => isset($data['buyPrice']) ? floatval(str_replace(['₱', ','], '', $data['buyPrice'])) : 0,
                    'sellPrice' => isset($data['sellPrice']) ? floatval(str_replace(['₱', ','], '', $data['sellPrice'])) : 0,
                    'dateAdded' => date('Y-m-d H:i:s')
                ];

                error_log("Prepared batch data: " . print_r($batchData, true));

                // If we have batches array, use that instead
                if (isset($data['batches']) && is_array($data['batches']) && !empty($data['batches'])) {
                    error_log("Processing " . count($data['batches']) . " batches");
                    foreach ($data['batches'] as $batch) {
                        try {
                            $batchId = $this->insertBatch($nextId, $batch);
                            error_log("Successfully inserted batch: " . $batchId);
                        } catch (Exception $e) {
                            error_log("Failed to insert batch: " . $e->getMessage());
                            error_log("Batch data: " . print_r($batch, true));
                            throw $e; // Rethrow to rollback the transaction
                        }
                    }
                }
                // Otherwise, if we have price data, create a single batch
                else if ($batchData['buyPrice'] > 0 || $batchData['sellPrice'] > 0) {
                    error_log("Creating single batch with data: " . print_r($batchData, true));
                    try {
                        $batchId = $this->insertBatch($nextId, $batchData);
                        error_log("Successfully inserted single batch: " . $batchId);
                    } catch (Exception $e) {
                        error_log("Failed to insert single batch: " . $e->getMessage());
                        error_log("Batch data: " . print_r($batchData, true));
                        throw $e; // Rethrow to rollback the transaction
                    }
                }
                // If no price data, log a warning
                else {
                    error_log("Warning: No price data provided for product " . $data['name']);
                }
            } catch (Exception $e) {
                error_log("Error in batch creation process: " . $e->getMessage());
                error_log("Stack trace: " . $e->getTraceAsString());
                throw $e; // Rethrow to rollback the transaction
            }
            
            $pdo->commit();
            error_log("Transaction committed successfully");
            return $string_id;
            
        } catch (Exception $e) {
            $pdo->rollBack();
            error_log("Error in create method: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            throw new Exception("Failed to create product: " . $e->getMessage());
        }
    }
    
    private function generateProductId() {
        $prefix = 'KCC';
        $timestamp = date('ymd');
        $random = strtoupper(substr(uniqid(), -4));
        return $prefix . $timestamp . $random;
    }
    
    public function update($id, $data) {
        if (!isset($data['name']) || empty($data['name'])) {
            throw new Exception('Product name is required');
        }

        if (!isset($data['category']) || empty($data['category'])) {
            throw new Exception('Product category is required');
        }

        $pdo = $this->db->getConnection();
        $pdo->beginTransaction();
        
        try {
            // Get the numeric ID from either string_id or numeric id
            $product = $this->db->fetch(
                "SELECT id FROM products WHERE string_id = ? OR id = ?",
                [$id, $id]
            );
            
            if (!$product || !isset($product['id'])) {
                throw new Exception('Product not found with ID: ' . $id);
            }
            
            $numericId = $product['id'];
            error_log("Found numeric ID: " . $numericId . " for input ID: " . $id);

            // Update or insert category
            $this->db->query(
                "INSERT IGNORE INTO categories (name) VALUES (?)",
                [$data['category']]
            );
            
            $category = $this->db->fetch(
                "SELECT id FROM categories WHERE name = ?",
                [$data['category']]
            );
            
            if (!$category || !isset($category['id'])) {
                throw new Exception('Failed to get category ID');
            }
            
            // Update product using numeric ID
            $this->db->update('products', 
                [
                    'name' => $data['name'],
                    'category_id' => $category['id'],
                    'performance_score' => $data['performance_score'] ?? null,
                    'power_draw' => $data['power_draw'] ?? null,
                    'updated_at' => date('Y-m-d H:i:s')
                ],
                'id = ?',
                [$numericId]
            );
            
            // Update specifications using numeric ID
            if (isset($data['specifications']) && is_array($data['specifications'])) {
                // Delete existing specifications
                $this->db->query("DELETE FROM specifications WHERE product_id = ?", [$numericId]);
                
                // Insert new specifications
                foreach ($data['specifications'] as $spec) {
                    if (isset($spec['name']) && isset($spec['value'])) {
                        $this->db->insert('specifications', [
                            'product_id' => $numericId,
                            'name' => $spec['name'],
                            'value' => $spec['value']
                        ]);
                    }
                }
            }
            
            $pdo->commit();
            return true;
            
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
    
    public function delete($string_id) {
        error_log("Starting product deletion for string_id: " . $string_id);
        
        $pdo = $this->db->getConnection();
        $pdo->beginTransaction();
        
        try {
            // Get the product details first
            $sql = "
                SELECT 
                    p.id,
                    p.string_id,
                    p.name,
                    c.name as category,
                    p.performance_score,
                    p.power_draw
                FROM products p
                JOIN categories c ON p.category_id = c.id
                WHERE p.string_id = ? OR p.id = ?
            ";
            
            $product = $this->db->fetch($sql, [$string_id, $string_id]);
            
            if (!$product) {
                error_log("Product not found with string_id or id: " . $string_id);
                throw new Exception('Product not found');
            }

            $numericId = $product['id'];
            error_log("Found numeric ID: " . $numericId);

            // Delete related records first using numeric ID
            error_log("Deleting related transactions");
            $this->db->query("DELETE FROM transactions WHERE product_id = ?", [$numericId]);
            
            error_log("Deleting related batches");
            $this->db->query("DELETE FROM batches WHERE product_id = ?", [$numericId]);
            
            error_log("Deleting related specifications");
            $this->db->query("DELETE FROM specifications WHERE product_id = ?", [$numericId]);
            
            // Delete the product using numeric ID
            error_log("Deleting product");
            $result = $this->db->query("DELETE FROM products WHERE id = ?", [$numericId]);
            
            if ($result) {
                $pdo->commit();
                error_log("Product deletion successful");
                return true;
            } else {
                throw new Exception('Failed to delete product');
            }
            
        } catch (Exception $e) {
            $pdo->rollBack();
            error_log("Product deletion failed: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            throw $e;
        }
    }
    
    public function addBatch($productId, $batchData) {
        error_log("Starting addBatch for product: " . $productId);
        error_log("Batch data: " . print_r($batchData, true));

        // Validate required fields
        if (!isset($batchData['quantity']) || !isset($batchData['buyPrice']) || !isset($batchData['sellPrice'])) {
            error_log("Missing required batch fields");
            throw new Exception('Quantity, buy price, and sell price are required');
        }

        try {
            // Get numeric ID if string_id was provided
            if (!is_numeric($productId)) {
                $product = $this->db->fetch(
                    "SELECT id FROM products WHERE string_id = ?",
                    [$productId]
                );
                
                if (!$product) {
                    error_log("Product not found with string_id: " . $productId);
                    throw new Exception("Product not found with ID: " . $productId);
                }
                
                $productId = $product['id'];
            }

            // Generate batch ID if not provided
            $batchId = isset($batchData['batchId']) ? $batchData['batchId'] : 'BATCH-' . date('ymd') . '-' . strtoupper(substr(uniqid(), -4));

            // Insert batch using direct SQL
            $sql = "INSERT INTO batches (id, product_id, quantity, remaining, buy_price, sell_price, date_added) VALUES (?, ?, ?, ?, ?, ?, ?)";
            $params = [
                $batchId,
                $productId,
                $batchData['quantity'],
                $batchData['quantity'], // Initially, remaining = quantity
                $batchData['buyPrice'],
                $batchData['sellPrice'],
                $batchData['dateAdded'] ?? date('Y-m-d H:i:s')
            ];

            error_log("Inserting batch with SQL: " . $sql);
            error_log("Parameters: " . print_r($params, true));

            $this->db->query($sql, $params);

            // Update product's last_updated timestamp
            $this->db->query(
                "UPDATE products SET updated_at = NOW() WHERE id = ?",
                [$productId]
            );

            error_log("Batch added successfully. Batch ID: " . $batchId);
            return $batchId;

        } catch (Exception $e) {
            error_log("Error in addBatch: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            throw $e;
        }
    }
    
    public function updateBatch($batchId, $batchData) {
        return $this->db->update(
            'batches',
            [
                'quantity' => $batchData['quantity'],
                'remaining' => $batchData['remaining'],
                'buy_price' => $batchData['buyPrice'],
                'sell_price' => $batchData['sellPrice']
            ],
            'id = ?',
            [$batchId]
        );
    }
    
    public function addTransaction($productId, $transactionData) {
        return $this->db->insert('transactions', [
            'product_id' => $productId,
            'batch_id' => $transactionData['batchId'],
            'type' => $transactionData['type'],
            'quantity' => $transactionData['quantity'],
            'buy_price' => $transactionData['buyPrice'],
            'sell_price' => $transactionData['sellPrice'],
            'profit' => $transactionData['profit'] ?? null,
            'transaction_date' => date('Y-m-d H:i:s')
        ]);
    }
    
    private function insertBatch($productId, $batchData) {
        // Generate batch ID if not provided
        $batchId = isset($batchData['batchId']) ? $batchData['batchId'] : 
                  'BATCH-' . date('ymd') . '-' . strtoupper(substr(uniqid(), -4));
        
        error_log("Starting batch insertion with ID: " . $batchId);
        
        // Clean and convert price values
        $buyPrice = is_numeric($batchData['buyPrice']) ? floatval($batchData['buyPrice']) : 
                   floatval(str_replace(['₱', ','], '', $batchData['buyPrice']));
        $sellPrice = is_numeric($batchData['sellPrice']) ? floatval($batchData['sellPrice']) : 
                    floatval(str_replace(['₱', ','], '', $batchData['sellPrice']));
        
        // Ensure numeric values
        $quantity = intval($batchData['quantity']);
        $remaining = intval($batchData['remaining'] ?? $batchData['quantity']);
        
        error_log("Processed values - Quantity: $quantity, Remaining: $remaining, Buy Price: $buyPrice, Sell Price: $sellPrice");
        
        // Validate values
        if ($quantity <= 0) throw new Exception('Quantity must be greater than 0');
        if ($buyPrice <= 0) throw new Exception('Buy price must be greater than 0');
        if ($sellPrice <= 0) throw new Exception('Sell price must be greater than 0');
        if ($sellPrice < $buyPrice) throw new Exception('Sell price cannot be lower than buy price');
        if ($remaining > $quantity) throw new Exception('Remaining cannot be greater than quantity');
        
        try {
            // Ensure we have a valid product ID
            if (!is_string($productId) && !is_numeric($productId)) {
                throw new Exception("Invalid product ID type: " . gettype($productId));
            }
            
            // Convert numeric ID to string if necessary
            $productId = (string)$productId;
            
            // Verify product exists
            $product = $this->db->fetch(
                "SELECT id FROM products WHERE id = ?",
                [$productId]
            );
            
            if (!$product) {
                throw new Exception("Product not found with ID: " . $productId);
            }
            
            // Format the date properly
            if (isset($batchData['dateAdded'])) {
                // Try to parse the date from ISO format
                $timestamp = strtotime($batchData['dateAdded']);
                if ($timestamp === false) {
                    error_log("Invalid date format received: " . $batchData['dateAdded']);
                    $dateAdded = date('Y-m-d H:i:s'); // Use current time if parsing fails
                } else {
                    $dateAdded = date('Y-m-d H:i:s', $timestamp);
                }
            } else {
                $dateAdded = date('Y-m-d H:i:s');
            }
            
            error_log("Using formatted date: " . $dateAdded);
            
            // Insert the batch
            $batchSql = "INSERT INTO batches (id, product_id, quantity, remaining, buy_price, sell_price, date_added) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)";
            $batchParams = [
                $batchId,
                $productId,
                $quantity,
                $remaining,
                $buyPrice,
                $sellPrice,
                $dateAdded
            ];
            
            error_log("Executing batch insert - SQL: " . $batchSql);
            error_log("Parameters: " . print_r($batchParams, true));
            
            $stmt = $this->db->query($batchSql, $batchParams);
            if (!$stmt) {
                throw new Exception('Failed to insert batch - database error');
            }
            
            // Verify batch was inserted
            $verifyBatch = $this->db->fetch("SELECT id FROM batches WHERE id = ?", [$batchId]);
            if (!$verifyBatch) {
                throw new Exception('Batch insertion failed - could not verify batch ID');
            }
            
            error_log("Batch inserted successfully: " . $batchId);
            return $batchId;
            
        } catch (Exception $e) {
            error_log("Error in insertBatch: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            throw $e;
        }
    }
} 