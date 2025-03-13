<?php
require_once __DIR__ . '/../classes/Database.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $db = Database::getInstance();
    $conn = $db->getConnection();
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Check if type filter is provided
        $type = isset($_GET['type']) ? $_GET['type'] : null;
        
        if ($type) {
            // Get categories by type
            $stmt = $conn->prepare("SELECT id, name, type, description FROM categories WHERE type = ? ORDER BY name");
            $stmt->execute([$type]);
        } else {
            // Get all categories
            $stmt = $conn->query("SELECT id, name, type, description FROM categories ORDER BY type, name");
        }
        
        $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Group categories by type for easier frontend usage
        $groupedCategories = [];
        foreach ($categories as $category) {
            $type = $category['type'];
            if (!isset($groupedCategories[$type])) {
                $groupedCategories[$type] = [];
            }
            $groupedCategories[$type][] = $category;
        }
        
        echo json_encode([
            'success' => true,
            'categories' => $categories,
            'groupedCategories' => $groupedCategories
        ]);
    } else {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => 'Method not allowed'
        ]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
