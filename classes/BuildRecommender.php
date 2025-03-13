<?php

class BuildRecommender {
    private $db;
    private $requiredComponents = [
        'CPU',
        'Motherboard',
        'RAM',
        'Storage',
        'GPU',
        'PSU',
        'Case'
    ];
    
    private $optionalComponents = [
        'CPU Cooler',
        'Case Fan'
    ];
    
    private $basicPeripherals = [
        'Monitor',
        'Keyboard',
        'Mouse'
    ];
    
    private $advancedPeripherals = [
        'Headset',
        'Webcam',
        'Speakers',
        'Microphone'
    ];

    // Component weights for different usage types
    private const USAGE_WEIGHTS = [
        'gaming' => [
            'cpu' => 0.25,
            'gpu' => 0.40,
            'ram' => 0.15,
            'storage' => 0.10,
            'motherboard' => 0.05,
            'psu' => 0.05
        ],
        'workstation' => [
            'cpu' => 0.35,
            'gpu' => 0.20,
            'ram' => 0.25,
            'storage' => 0.10,
            'motherboard' => 0.05,
            'psu' => 0.05
        ],
        'office' => [
            'cpu' => 0.30,
            'gpu' => 0.10,
            'ram' => 0.25,
            'storage' => 0.20,
            'motherboard' => 0.10,
            'psu' => 0.05
        ]
    ];

    public function __construct($db) {
        $this->db = $db;
        $this->loadInventory();
    }

    private function loadInventory() {
        $query = "SELECT p.*, 
                        GROUP_CONCAT(DISTINCT ps.name, ':', ps.value) as specifications,
                        GROUP_CONCAT(DISTINCT pb.batch_id, ',', pb.sell_price, ',', pb.remaining) as batches
                 FROM products p
                 LEFT JOIN product_specifications ps ON p.id = ps.product_id
                 LEFT JOIN product_batches pb ON p.id = pb.product_id
                 WHERE pb.remaining > 0
                 GROUP BY p.id";
        
        $result = $this->db->query($query);
        $this->inventory = [];
        
        while ($row = $result->fetch_assoc()) {
            // Parse specifications
            $specs = [];
            $specsStr = explode(',', $row['specifications']);
            foreach ($specsStr as $spec) {
                list($name, $value) = explode(':', $spec);
                $specs[] = ['name' => $name, 'value' => $value];
            }
            
            // Parse batches
            $batches = [];
            $batchesStr = explode(',', $row['batches']);
            for ($i = 0; $i < count($batchesStr); $i += 3) {
                if (isset($batchesStr[$i+2]) && intval($batchesStr[$i+2]) > 0) {
                    $batches[] = [
                        'batch_id' => $batchesStr[$i],
                        'sell_price' => floatval($batchesStr[$i+1]),
                        'remaining' => intval($batchesStr[$i+2])
                    ];
                }
            }
            
            // Add to inventory if has available stock
            if (!empty($batches)) {
                $row['specifications'] = $specs;
                $row['batches'] = $batches;
                $this->inventory[] = $row;
            }
        }
    }

    public function recommendBuild($usage = 'gaming', $budget = 50000, $includePeripherals = false) {
        // Determine performance priority based on usage
        $cpuPriority = 0.3;
        $gpuPriority = 0.3;
        
        switch (strtolower($usage)) {
            case 'gaming':
                $gpuPriority = 0.5;
                $cpuPriority = 0.2;
                break;
            case 'workstation':
                $cpuPriority = 0.5;
                $gpuPriority = 0.2;
                break;
            case 'office':
                $cpuPriority = 0.4;
                $gpuPriority = 0.1;
                break;
        }
        
        // Budget allocation
        $componentBudget = $includePeripherals ? $budget * 0.8 : $budget;
        $peripheralBudget = $includePeripherals ? $budget * 0.2 : 0;
        
        // Get components by category
        $components = [];
        $totalPrice = 0;
        $totalPerformance = 0;
        $totalPowerDraw = 0;
        
        // Allocate budget percentages for required components
        $budgetAllocation = [
            'CPU' => $cpuPriority * $componentBudget,
            'Motherboard' => 0.15 * $componentBudget,
            'RAM' => 0.1 * $componentBudget,
            'Storage' => 0.1 * $componentBudget,
            'GPU' => $gpuPriority * $componentBudget,
            'PSU' => 0.1 * $componentBudget,
            'Case' => 0.05 * $componentBudget
        ];
        
        // First pass: try to get best components within budget allocation
        foreach ($this->requiredComponents as $category) {
            $component = $this->getBestComponent($category, $budgetAllocation[$category]);
            if ($component) {
                $components[$category] = $component;
                $totalPrice += $component['price'];
                $totalPerformance += $component['performance_score'];
                $totalPowerDraw += $component['power_draw'] ?? 0;
            }
        }
        
        // Second pass: adjust if we have leftover budget for components
        $remainingComponentBudget = $componentBudget - $totalPrice;
        if ($remainingComponentBudget > 0) {
            // Prioritize upgrading GPU for gaming, CPU for workstation
            $upgradeCategory = strtolower($usage) === 'gaming' ? 'GPU' : 'CPU';
            $betterComponent = $this->getBetterComponent($upgradeCategory, $components[$upgradeCategory]['price'], $remainingComponentBudget);
            
            if ($betterComponent) {
                $priceDifference = $betterComponent['price'] - $components[$upgradeCategory]['price'];
                $components[$upgradeCategory] = $betterComponent;
                $totalPrice += $priceDifference;
                $totalPerformance += ($betterComponent['performance_score'] - $components[$upgradeCategory]['performance_score']);
                $totalPowerDraw += ($betterComponent['power_draw'] ?? 0) - ($components[$upgradeCategory]['power_draw'] ?? 0);
            }
        }
        
        // Add peripherals if requested
        if ($includePeripherals) {
            foreach ($this->basicPeripherals as $category) {
                $peripheral = $this->getCheapestComponent($category, $peripheralBudget / count($this->basicPeripherals));
                if ($peripheral) {
                    $components[$category] = $peripheral;
                    $totalPrice += $peripheral['price'];
                }
            }
        }
        
        // Calculate final performance score (weighted average)
        $finalPerformance = $totalPerformance / count($this->requiredComponents);
        
        return [
            'components' => $components,
            'total_price' => $totalPrice,
            'performance_score' => $finalPerformance,
            'power_draw' => $totalPowerDraw
        ];
    }

    private function selectComponent($category, $maxBudget) {
        $components = array_filter($this->inventory, function($item) use ($category) {
            return $item['category'] === $category;
        });

        if (empty($components)) return null;

        // Sort by performance score and price
        usort($components, function($a, $b) use ($maxBudget) {
            $scoreA = $this->calculateComponentScore($a);
            $scoreB = $this->calculateComponentScore($b);
            $priceA = $this->getComponentPrice($a);
            $priceB = $this->getComponentPrice($b);

            // Filter out components above budget
            if ($priceA > $maxBudget && $priceB > $maxBudget) return 0;
            if ($priceA > $maxBudget) return 1;
            if ($priceB > $maxBudget) return -1;

            // Compare price-to-performance ratio
            $ratioA = $scoreA / $priceA;
            $ratioB = $scoreB / $priceB;
            
            return $ratioB <=> $ratioA;
        });

        return reset($components);
    }

    private function selectCompatibleMotherboard($cpu, $maxBudget) {
        if (!$cpu) return null;

        $cpuSocket = $this->getSpecValue($cpu, 'Socket');
        
        $compatibleMotherboards = array_filter($this->inventory, function($item) use ($cpuSocket) {
            return $item['category'] === 'Motherboard' && 
                   $this->getSpecValue($item, 'Socket') === $cpuSocket;
        });

        if (empty($compatibleMotherboards)) return null;

        // Sort by features and price
        usort($compatibleMotherboards, function($a, $b) use ($maxBudget) {
            $scoreA = $this->calculateComponentScore($a);
            $scoreB = $this->calculateComponentScore($b);
            $priceA = $this->getComponentPrice($a);
            $priceB = $this->getComponentPrice($b);

            if ($priceA > $maxBudget && $priceB > $maxBudget) return 0;
            if ($priceA > $maxBudget) return 1;
            if ($priceB > $maxBudget) return -1;

            return $scoreB <=> $scoreA;
        });

        return reset($compatibleMotherboards);
    }

    private function selectPSU($requiredWattage, $maxBudget) {
        $psus = array_filter($this->inventory, function($item) use ($requiredWattage) {
            if ($item['category'] !== 'PSU') return false;
            $wattage = intval($this->getSpecValue($item, 'Wattage'));
            return $wattage >= $requiredWattage;
        });

        if (empty($psus)) return null;

        usort($psus, function($a, $b) use ($maxBudget) {
            $priceA = $this->getComponentPrice($a);
            $priceB = $this->getComponentPrice($b);

            if ($priceA > $maxBudget && $priceB > $maxBudget) return 0;
            if ($priceA > $maxBudget) return 1;
            if ($priceB > $maxBudget) return -1;

            // Compare efficiency ratings
            $efficiencyA = $this->getPSUEfficiencyScore($a);
            $efficiencyB = $this->getPSUEfficiencyScore($b);

            return $efficiencyB <=> $efficiencyA;
        });

        return reset($psus);
    }

    private function calculateComponentScore($component) {
        $score = 0;
        
        switch ($component['category']) {
            case 'CPU':
                $cores = intval($this->getSpecValue($component, 'Cores'));
                $clockSpeed = floatval($this->getSpecValue($component, 'Clock Speed'));
                $score = ($cores * 10) + ($clockSpeed * 20);
                break;
                
            case 'GPU':
                $vram = intval($this->getSpecValue($component, 'VRAM'));
                $coreClock = floatval($this->getSpecValue($component, 'Core Clock'));
                $score = ($vram * 15) + ($coreClock * 25);
                break;
                
            case 'RAM':
                $capacity = intval($this->getSpecValue($component, 'Capacity'));
                $speed = intval($this->getSpecValue($component, 'Speed'));
                $score = ($capacity * 5) + ($speed / 100);
                break;
                
            case 'Storage':
                $capacity = intval($this->getSpecValue($component, 'Capacity'));
                $type = $this->getSpecValue($component, 'Type');
                $score = $capacity;
                if (stripos($type, 'SSD') !== false) {
                    $score *= 2;
                }
                break;
                
            case 'Motherboard':
                $score = 50; // Base score
                if (stripos($this->getSpecValue($component, 'Form Factor'), 'ATX') !== false) {
                    $score += 20;
                }
                break;
        }
        
        return $score;
    }

    private function calculateBuildScore($build, $usage) {
        $weights = self::USAGE_WEIGHTS[$usage];
        $score = 0;
        $totalWeight = 0;

        foreach ($build as $type => $component) {
            if ($component && isset($weights[$type])) {
                $score += $this->calculateComponentScore($component) * $weights[$type];
                $totalWeight += $weights[$type];
            }
        }

        return $totalWeight > 0 ? round(($score / $totalWeight) * 100) : 0;
    }

    private function getComponentPrice($component) {
        if (!$component || empty($component['batches'])) return 0;
        
        // Get the cheapest available batch
        usort($component['batches'], function($a, $b) {
            return $a['sell_price'] <=> $b['sell_price'];
        });
        
        return floatval($component['batches'][0]['sell_price']);
    }

    private function getSpecValue($component, $specName) {
        foreach ($component['specifications'] as $spec) {
            if ($spec['name'] === $specName) {
                return $spec['value'];
            }
        }
        return null;
    }

    private function calculateTotalPower($build) {
        $totalPower = 0;
        
        // Add power draw from each component
        foreach ($build as $component) {
            if ($component) {
                $powerDraw = intval($this->getSpecValue($component, 'Power Draw') ?? 0);
                $totalPower += $powerDraw;
            }
        }
        
        // Add 20% overhead for safety
        return ceil($totalPower * 1.2);
    }

    private function getPSUEfficiencyScore($psu) {
        $efficiency = $this->getSpecValue($psu, 'Efficiency');
        
        if (stripos($efficiency, 'Platinum') !== false) return 4;
        if (stripos($efficiency, 'Gold') !== false) return 3;
        if (stripos($efficiency, 'Silver') !== false) return 2;
        if (stripos($efficiency, 'Bronze') !== false) return 1;
        
        return 0;
    }

    /**
     * Get the best component in a category within budget
     */
    private function getBestComponent($category, $maxPrice) {
        try {
            $conn = $this->db->getConnection();
            
            $query = "
                SELECT 
                    p.id, 
                    p.name, 
                    p.performance_score,
                    p.power_draw,
                    MIN(b.sell_price) as price
                FROM 
                    products p
                JOIN 
                    categories c ON p.category_id = c.id
                LEFT JOIN 
                    batches b ON p.id = b.product_id
                WHERE 
                    c.name = ? AND
                    b.remaining > 0 AND
                    b.sell_price <= ?
                GROUP BY 
                    p.id, p.name, p.performance_score, p.power_draw
                ORDER BY 
                    p.performance_score DESC
                LIMIT 1
            ";
            
            $stmt = $conn->prepare($query);
            $stmt->execute([$category, $maxPrice]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            error_log("Error in getBestComponent: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Get a better component than the current one within additional budget
     */
    private function getBetterComponent($category, $currentPrice, $additionalBudget) {
        try {
            $conn = $this->db->getConnection();
            $maxPrice = $currentPrice + $additionalBudget;
            
            $query = "
                SELECT 
                    p.id, 
                    p.name, 
                    p.performance_score,
                    p.power_draw,
                    MIN(b.sell_price) as price
                FROM 
                    products p
                JOIN 
                    categories c ON p.category_id = c.id
                LEFT JOIN 
                    batches b ON p.id = b.product_id
                WHERE 
                    c.name = ? AND
                    b.remaining > 0 AND
                    b.sell_price > ? AND
                    b.sell_price <= ?
                GROUP BY 
                    p.id, p.name, p.performance_score, p.power_draw
                ORDER BY 
                    p.performance_score DESC
                LIMIT 1
            ";
            
            $stmt = $conn->prepare($query);
            $stmt->execute([$category, $currentPrice, $maxPrice]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            error_log("Error in getBetterComponent: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Get the cheapest component in a category
     */
    private function getCheapestComponent($category, $maxPrice) {
        try {
            $conn = $this->db->getConnection();
            
            $query = "
                SELECT 
                    p.id, 
                    p.name, 
                    p.performance_score,
                    p.power_draw,
                    MIN(b.sell_price) as price
                FROM 
                    products p
                JOIN 
                    categories c ON p.category_id = c.id
                LEFT JOIN 
                    batches b ON p.id = b.product_id
                WHERE 
                    c.name = ? AND
                    b.remaining > 0 AND
                    b.sell_price <= ?
                GROUP BY 
                    p.id, p.name, p.performance_score, p.power_draw
                ORDER BY 
                    b.sell_price ASC
                LIMIT 1
            ";
            
            $stmt = $conn->prepare($query);
            $stmt->execute([$category, $maxPrice]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            error_log("Error in getCheapestComponent: " . $e->getMessage());
            return null;
        }
    }
}
?>