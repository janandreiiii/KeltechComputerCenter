<?php

class ProductMetrics {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    /**
     * Calculate performance score and power draw for a product
     */
    public function calculateMetrics($productId) {
        // Get product category and specifications
        $query = "SELECT p.id, p.name, c.name as category, s.name as spec_name, s.value as spec_value 
                 FROM products p 
                 JOIN categories c ON p.category_id = c.id 
                 LEFT JOIN specifications s ON p.id = s.product_id 
                 WHERE p.id = ?";
        
        $stmt = $this->db->prepare($query);
        $stmt->execute([$productId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($rows)) {
            return false;
        }

        // Group specifications
        $specs = [];
        $category = $rows[0]['category'];
        foreach ($rows as $row) {
            if ($row['spec_name']) {
                $specs[$row['spec_name']] = $row['spec_value'];
            }
        }

        // Calculate metrics based on category
        $metrics = $this->calculateMetricsByCategory($category, $specs);

        // Update product
        $updateQuery = "UPDATE products SET performance_score = ?, power_draw = ? WHERE id = ?";
        $stmt = $this->db->prepare($updateQuery);
        return $stmt->execute([$metrics['performance_score'], $metrics['power_draw'], $productId]);
    }

    /**
     * Calculate metrics based on category and specifications
     */
    private function calculateMetricsByCategory($category, $specs) {
        $metrics = [
            'performance_score' => 0,
            'power_draw' => 0
        ];

        switch ($category) {
            case 'CPU':
                $cores = isset($specs['cores']) ? floatval($specs['cores']) : 0;
                $baseClock = isset($specs['baseClock']) ? floatval($specs['baseClock']) : 0;
                $tdp = isset($specs['tdp']) ? intval($specs['tdp']) : 0;

                $metrics['performance_score'] = min(100, ($cores * 10) + ($baseClock * 5));
                $metrics['power_draw'] = $tdp;
                break;

            case 'GPU':
                $vram = isset($specs['vram']) ? floatval($specs['vram']) : 0;
                
                $metrics['performance_score'] = min(100, $vram * 8);
                if ($vram <= 6) $metrics['power_draw'] = 150;
                elseif ($vram <= 8) $metrics['power_draw'] = 200;
                elseif ($vram <= 12) $metrics['power_draw'] = 250;
                else $metrics['power_draw'] = 300;
                break;

            case 'RAM':
                $capacity = isset($specs['capacity']) ? floatval($specs['capacity']) : 0;
                $speed = isset($specs['speed']) ? floatval($specs['speed']) : 0;

                $metrics['performance_score'] = min(100, ($capacity * 5) + ($speed / 50));
                if ($capacity <= 8) $metrics['power_draw'] = 3;
                elseif ($capacity <= 16) $metrics['power_draw'] = 5;
                else $metrics['power_draw'] = 8;
                break;

            case 'Storage':
                $capacity = isset($specs['capacity']) ? floatval($specs['capacity']) : 0;
                $type = isset($specs['storageType']) ? strtolower($specs['storageType']) : '';

                $typeScore = 0;
                if (strpos($type, 'nvme') !== false) {
                    $typeScore = 50;
                    $metrics['power_draw'] = 8;
                } elseif (strpos($type, 'ssd') !== false) {
                    $typeScore = 30;
                    $metrics['power_draw'] = 5;
                } else {
                    $typeScore = 10;
                    $metrics['power_draw'] = 10;
                }

                $metrics['performance_score'] = min(100, ($capacity / 20) + $typeScore);
                break;

            case 'PSU':
                $wattage = isset($specs['wattage']) ? floatval($specs['wattage']) : 0;
                $efficiency = isset($specs['efficiency']) ? strtolower($specs['efficiency']) : '';

                $efficiencyScore = 0;
                if (strpos($efficiency, 'titanium') !== false) $efficiencyScore = 50;
                elseif (strpos($efficiency, 'platinum') !== false) $efficiencyScore = 40;
                elseif (strpos($efficiency, 'gold') !== false) $efficiencyScore = 30;
                elseif (strpos($efficiency, 'silver') !== false) $efficiencyScore = 20;
                elseif (strpos($efficiency, 'bronze') !== false) $efficiencyScore = 10;

                $metrics['performance_score'] = min(100, ($wattage / 12) + $efficiencyScore);
                break;

            case 'Motherboard':
                $maxRam = isset($specs['maxRam']) ? floatval($specs['maxRam']) : 0;
                $ramType = isset($specs['ramType']) ? strtolower($specs['ramType']) : '';

                $typeScore = 0;
                if (strpos($ramType, 'ddr5') !== false) $typeScore = 50;
                elseif (strpos($ramType, 'ddr4') !== false) $typeScore = 30;
                else $typeScore = 10;

                $metrics['performance_score'] = min(100, ($maxRam / 4) + $typeScore);
                if ($maxRam >= 128) $metrics['power_draw'] = 35;
                elseif ($maxRam >= 64) $metrics['power_draw'] = 25;
                else $metrics['power_draw'] = 15;
                break;
        }

        return $metrics;
    }
} 