<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_errors.log'); // Store log in the same directory

// Add required headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Log debugging info
error_log("Request method: " . $_SERVER['REQUEST_METHOD']);
error_log("Request headers: " . print_r(getallheaders(), true));

try {
    // Get raw POST data 
    $rawData = file_get_contents('php://input');
    error_log("Raw input data: " . $rawData);
    
    if (empty($rawData)) {
        throw new Exception("No data received");
    }

    // For debugging - try to save the raw data to a file
    file_put_contents(__DIR__ . '/debug_last_request.json', $rawData);

    // Parse the JSON data
    $data = json_decode($rawData, true);
    $jsonError = json_last_error();
    
    if ($jsonError !== JSON_ERROR_NONE) {
        throw new Exception("JSON parse error: " . json_last_error_msg());
    }
    
    error_log("Parsed data: " . print_r($data, true));

    // For simple testing without a database
    if (!file_exists('../classes/Database.php')) {
        // Generate a fake success response for testing
        $trackingId = 'TEST' . date('ymd') . strtoupper(substr(md5(uniqid()), 0, 6));
        $buildId = rand(1000, 9999);
        
        error_log("Database class not found - generating test response");
        echo json_encode([
            'success' => true,
            'message' => 'Test build saved without database',
            'data' => [
                'customer_id' => rand(1000, 9999),
                'build_id' => $buildId,
                'tracking_id' => $trackingId
            ]
        ]);
        exit;
    }

    // Continue with normal processing
    require_once '../classes/Database.php';

    // Validate required fields
    $requiredFields = ['name', 'contact', 'email', 'address', 'build', 'total_price'];
    foreach ($requiredFields as $field) {
        if (!isset($data[$field]) || (is_string($data[$field]) && trim($data[$field]) === '')) {
            throw new Exception("Missing or empty required field: $field");
        }
    }

    // Get database instance
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    // Start transaction
    $pdo->beginTransaction();
    
    try {
        // Insert customer
        $customer = [
            'name' => $data['name'],
            'contact_number' => $data['contact'],
            'email' => $data['email'],
            'address' => $data['address']
        ];
        
        $customerId = $db->insert('customers', $customer);
        
        // Generate tracking ID
        $trackingId = 'PCB' . date('ymd') . strtoupper(substr(md5(uniqid()), 0, 6));
        
        // Insert build
        $buildData = [
            'customer_id' => $customerId,
            'tracking_id' => $trackingId,
            'build_data' => json_encode($data['build']),
            'total_price' => $data['total_price'],
            'created_at' => date('Y-m-d H:i:s')
        ];
        
        $buildId = $db->insert('customer_builds', $buildData);
        
        // Commit transaction
        $pdo->commit();
        
        // Send success response
        echo json_encode([
            'success' => true,
            'message' => 'Build saved successfully',
            'data' => [
                'customer_id' => $customerId,
                'build_id' => $buildId,
                'tracking_id' => $trackingId
            ]
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
    
} catch (Exception $e) {
    error_log("Error: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
