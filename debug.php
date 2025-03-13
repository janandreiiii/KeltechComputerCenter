<?php
require_once 'api/db-connect.php';

function callEndpoint($url) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return [
        'response' => $response,
        'httpCode' => $httpCode
    ];
}

try {
    $pdo = getDB();
    echo "Database connection successful.\n\n";

    // List all tables
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "Tables in the database:\n";
    foreach ($tables as $table) {
        echo "- $table\n";
    }
    echo "\n";

    // Fetch structure of each table
    foreach ($tables as $table) {
        echo "Structure of table '$table':\n";
        $stmt = $pdo->query("DESCRIBE `$table`");
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($columns as $column) {
            echo $column['Field'] . ' ' . $column['Type'] . ' ' . $column['Null'] . ' ' . $column['Key'] . ' ' . $column['Default'] . ' ' . $column['Extra'] . "\n";
        }
        echo "\n";
    }

} catch (PDOException $e) {
    echo "Database connection failed: " . $e->getMessage() . "\n";
    exit;
}

$baseUrl = 'https://keltechcomputers.com/api/';

// Test fix-id-autoincrement.php
$fixAutoIncrementUrl = $baseUrl . 'fix-id-autoincrement.php';
$fixResult = callEndpoint($fixAutoIncrementUrl);
echo "Testing fix-id-autoincrement.php:\n";
echo "HTTP Code: " . $fixResult['httpCode'] . "\n";
echo "Response: " . $fixResult['response'] . "\n\n";

// Test inventory.php
$inventoryUrl = $baseUrl . 'inventory.php';
$inventoryResult = callEndpoint($inventoryUrl);
echo "Testing inventory.php:\n";
echo "HTTP Code: " . $inventoryResult['httpCode'] . "\n";
echo "Response: " . $inventoryResult['response'] . "\n\n";
?>
