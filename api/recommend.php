<?php
require_once '../classes/Database.php';
require_once '../classes/BuildRecommender.php';

header('Content-Type: application/json');

try {
    // Get parameters
    $usage = $_GET['usage'] ?? 'gaming';
    $budget = floatval($_GET['budget'] ?? 50000);

    // Validate parameters
    if ($budget < 20000) {
        throw new Exception('Budget must be at least ₱20,000');
    }

    // Initialize recommender
    $db = new Database();
    $recommender = new BuildRecommender($db);

    // Get recommendation
    $recommendation = $recommender->recommendBuild($usage, $budget);

    // Return response
    echo json_encode([
        'success' => true,
        'build' => $recommendation['components'],
        'total_price' => $recommendation['total_price'],
        'performance_score' => $recommendation['performance_score']
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?> 