<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../classes/Database.php';
require_once __DIR__ . '/../classes/Product.php';

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Parse the URL to get the endpoint
$request = $_SERVER['REQUEST_URI'];
$endpoint = trim(parse_url($request, PHP_URL_PATH), '/');
$endpoint = str_replace('api/', '', $endpoint);

try {
    $product = new Product();
    
    switch ($endpoint) {
        case 'inventory':
            require 'inventory.php';
            break;
            
        case 'products':
            if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                $products = $product->getAll();
                echo json_encode(['products' => $products]);
            } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $result = $product->create($data);
                echo json_encode(['success' => $result]);
            }
            break;
            
        case (preg_match('/^products\/[\w-]+$/', $endpoint) ? true : false):
            $id = substr($endpoint, 9); // Remove 'products/'
            
            if ($_SERVER['REQUEST_METHOD'] === 'GET') {
                $productData = $product->getById($id);
                if ($productData) {
                    $productData['specifications'] = $product->getSpecifications($id);
                    $productData['batches'] = $product->getBatches($id);
                    $productData['transactions'] = $product->getTransactions($id);
                    echo json_encode($productData);
                } else {
                    http_response_code(404);
                    echo json_encode(['error' => 'Product not found']);
                }
            } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
                $data = json_decode(file_get_contents('php://input'), true);
                $result = $product->update($id, $data);
                echo json_encode(['success' => $result]);
            } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
                $result = $product->delete($id);
                echo json_encode(['success' => $result]);
            }
            break;
            
        case (preg_match('/^products\/[\w-]+\/batches$/', $endpoint) ? true : false):
            $id = explode('/', $endpoint)[1];
            
            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $result = $product->addBatch($id, $data);
                echo json_encode(['success' => $result]);
            }
            break;
            
        case (preg_match('/^products\/[\w-]+\/transactions$/', $endpoint) ? true : false):
            $id = explode('/', $endpoint)[1];
            
            if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $result = $product->addTransaction($id, $data);
                echo json_encode(['success' => $result]);
            }
            break;
            
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Endpoint not found']);
            break;
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
} 