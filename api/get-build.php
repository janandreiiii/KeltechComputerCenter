<?php
header('Content-Type: application/json');
require_once '../classes/Database.php';

try {
    // Get tracking ID from query parameters
    $trackingId = isset($_GET['tracking_id']) ? trim($_GET['tracking_id']) : '';
    
    if (empty($trackingId)) {
        throw new Exception('Tracking ID is required');
    }

    // Initialize database connection
    $db = new Database();
    $conn = $db->getConnection();

    // Prepare the query to fetch build data with customer information
    $query = "
        SELECT 
            cb.id,
            cb.tracking_id,
            cb.build_data,
            cb.total_price,
            cb.status,
            cb.date_created,
            c.name as customer_name,
            c.email as customer_email,
            c.contact_number as customer_contact,
            c.address as customer_address
        FROM customer_builds cb
        JOIN customers c ON cb.customer_id = c.id
        WHERE cb.tracking_id = :tracking_id
    ";

    $stmt = $conn->prepare($query);
    $stmt->bindParam(':tracking_id', $trackingId);
    $stmt->execute();

    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$result) {
        throw new Exception('No build found with this tracking number');
    }

    // Format the response data
    $buildData = json_decode($result['build_data'], true);
    
    // The build data already contains the component information
    // No need to add additional price fields since they are stored in the build_data JSON

    $response = [
        'success' => true,
        'data' => [
            'build_id' => $result['id'],
            'tracking_id' => $result['tracking_id'],
            'build' => $buildData,
            'total_price' => floatval($result['total_price']),
            'status' => $result['status'],
            'date_created' => $result['date_created'],
            'customer' => [
                'name' => $result['customer_name'],
                'email' => $result['customer_email'],
                'contact' => $result['customer_contact'],
                'address' => $result['customer_address']
            ]
        ]
    ];

    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
} 