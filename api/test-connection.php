<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'API connection successful',
    'server_time' => date('Y-m-d H:i:s'),
    'php_version' => phpversion(),
    'request_method' => $_SERVER['REQUEST_METHOD'],
    'headers' => getallheaders()
]);
?>
