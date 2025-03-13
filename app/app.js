//** Developed by: Jan Andrei Fernando of ITMAWD 12-A (STI College San Fernando, Pampanga) */
//** Developed on: February 6, 2025 */

// Function to validate and format prices
function validateAndFormatPrices(rowData) {
    try {
        // Extract price values
        let buyPrice = rowData.buyPrice;
        let sellPrice = rowData.sellPrice;

        // Handle string values with currency symbols and commas
        if (typeof buyPrice === 'string') {
            buyPrice = parseFloat(buyPrice.replace(/[₱,]/g, ''));
        }
        if (typeof sellPrice === 'string') {
            sellPrice = parseFloat(sellPrice.replace(/[₱,]/g, ''));
        }

        // Convert to numbers
        buyPrice = parseFloat(buyPrice);
        sellPrice = parseFloat(sellPrice);

        // Validate values
        if (isNaN(buyPrice) || buyPrice <= 0) {
            return { valid: false, error: 'Buy price must be greater than 0' };
        }
        if (isNaN(sellPrice) || sellPrice <= 0) {
            return { valid: false, error: 'Sell price must be greater than 0' };
        }
        if (sellPrice < buyPrice) {
            return { valid: false, error: 'Sell price cannot be lower than buy price' };
        }

        // Calculate margin
        const margin = ((sellPrice - buyPrice) / buyPrice) * 100;
        if (margin > 100) {
            console.warn(`High margin detected: ${margin.toFixed(1)}%`);
        }

        return {
            valid: true,
            buyPrice: buyPrice,
            sellPrice: sellPrice,
            margin: margin
        };
    } catch (error) {
        console.error('Error validating prices:', error);
        return { valid: false, error: 'Invalid price format' };
    }
}

// Function to detect category from product data
function detectCategory(rowData) {
    // First check if a valid category is already provided
    const validCategories = ['CPU', 'Motherboard', 'RAM', 'Storage', 'GPU', 'PSU', 'Desktop', 'Laptop'];
    if (rowData.category && validCategories.includes(rowData.category)) {
        return rowData.category;
    }

    // Initialize patterns for each category
    const patterns = {
        CPU: [
            /processor|cpu|ryzen|core\s*i[3579]|pentium|celeron/i,
            /intel|amd|processor/i,
            /\d+\s*cores?|\d+\s*threads?/i
        ],
        Motherboard: [
            /motherboard|mainboard|mobo/i,
            /\b(ATX|mATX|ITX)\b/i,
            /(B|H|Z|X)\d{3}/i,
            /socket\s*(AM4|AM5|LGA)/i
        ],
        RAM: [
            /\bram\b|memory|dimm/i,
            /ddr[45]|sdram/i,
            /\d+\s*gb\s*ram/i,
            /\d+\s*mhz/i
        ],
        Storage: [
            /ssd|hdd|nvme|storage/i,
            /\d+\s*(gb|tb)\b/i,
            /m\.2|sata|pcie/i
        ],
        GPU: [
            /gpu|graphics|video\s*card/i,
            /nvidia|radeon|geforce|rtx|gtx/i,
            /\d+\s*gb\s*vram/i
        ],
        PSU: [
            /psu|power\s*supply/i,
            /\d+\s*watts?|[68]0\s*plus|\d+w/i,
            /bronze|silver|gold|platinum/i
        ],
        Desktop: [
            /desktop|pc|computer|workstation/i,
            /gaming\s*pc|custom\s*build/i,
            /tower|system/i
        ],
        Laptop: [
            /laptop|notebook|portable/i,
            /battery|touchpad|screen/i,
            /\d+\s*wh|\d+\\s*nits/i
        ]
    };

    // Check product name and specifications against patterns
    let scores = {};
    validCategories.forEach(category => {
        scores[category] = 0;
        
        // Check product name
        patterns[category].forEach(pattern => {
            if (pattern.test(rowData.name)) {
                scores[category] += 2; // Higher weight for name matches
            }
        });
        
        // Check specifications if available
        if (rowData.specifications) {
            let specs = typeof rowData.specifications === 'string' 
                ? rowData.specifications 
                : JSON.stringify(rowData.specifications);
                
            patterns[category].forEach(pattern => {
                if (pattern.test(specs)) {
                    scores[category] += 1;
                }
            });
        }
    });

    // Find category with highest score
    let bestCategory = null;
    let highestScore = 0;
    
    Object.entries(scores).forEach(([category, score]) => {
        if (score > highestScore) {
            highestScore = score;
            bestCategory = category;
        }
    });

    // Return detected category or default to 'Other'
    return highestScore > 0 ? bestCategory : 'Other';
}

// Store inventory data
let inventory = [];

// DOM Elements
const inventorySection = document.getElementById('inventorySection');
const addProductSection = document.getElementById('addProductSection');
const reportsSection = document.getElementById('reportsSection');
const addProductForm = document.getElementById('addProductForm');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const mobileMenu = document.getElementById('mobileMenu');

// API endpoints
const API_BASE_URL = '/api';

// API functions
async function apiRequest(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        // Map endpoints to direct PHP files
        let url;
        if (endpoint.startsWith('products/') && method === 'DELETE') {
            // Handle product deletion
            const productId = endpoint.split('/')[1];
            url = `/api/products.php?id=${encodeURIComponent(productId)}`;
        } else if (endpoint.startsWith('products/') && endpoint.includes('/batches')) {
            // Handle batch operations
            const productId = endpoint.split('/')[1];
            url = `/api/batches.php?productId=${encodeURIComponent(productId)}`;
        } else if (endpoint.startsWith('products/') && endpoint.includes('/transactions')) {
            // Handle transaction operations
            const productId = endpoint.split('/')[1];
            url = `/api/transactions.php?productId=${encodeURIComponent(productId)}`;
        } else {
            // Handle simple endpoints
            switch (endpoint) {
                case 'inventory':
                    url = '/api/inventory.php';
                    break;
                case 'products':
                    url = '/api/products.php';
                    break;
                default:
                    url = `/api/${endpoint}.php`;
            }
        }

        // For PUT requests to products.php, add the ID as a query parameter
        if (method === 'PUT' && endpoint === 'products' && data?.id) {
            url = `${url}?id=${encodeURIComponent(data.id)}`;
        }

        console.log('Making API request to:', url, 'with options:', options);
        
        const response = await fetch(url, options);
        const responseData = await response.json();
        
        if (!response.ok) {
            console.error('API Error Response:', responseData);
            throw new Error(responseData.error || 'API request failed');
        }
        
        return responseData;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

// Load inventory from server
async function loadInventory() {
    try {
        const data = await apiRequest('inventory');
        inventory = data.inventory || [];
        
        // Only fix categories if we have inventory items
        if (inventory.length > 0) {
            await fixInventoryCategories();
        }
        
        return inventory;
    } catch (error) {
        console.error('Error loading inventory:', error);
        showToast('Error loading inventory', 'error');
        return [];
    }
}

// Update saveProduct function
async function saveProduct(productData) {
    try {
        // Try to fix database structure and auto-increment first
        try {
            const fixResponse = await fetch('../api/fix-autoincrement.php');
            const fixResult = await fixResponse.json();
            if (fixResult.fixes_applied?.length > 0) {
                console.log('Applied database fixes:', fixResult.fixes_applied);
            }
        } catch (fixError) {
            console.warn('Database fix attempt failed:', fixError);
        }

        // Format the data according to database schema
        const formattedData = {
            string_id: productData.string_id || generateProductId(),
            name: productData.name,
            category: productData.category,
            specifications: productData.specifications || [],
        };

        // Handle batch data if present
        if (productData.batch || productData.batches) {
            formattedData.batches = [];
            const batches = Array.isArray(productData.batches) ? 
                          productData.batches : 
                          [productData.batch];

            formattedData.batches = batches.map(batch => ({
                batch_id: batch.batchId || generateBatchId(),
                quantity: parseInt(batch.quantity),
                remaining: parseInt(batch.remaining || batch.quantity),
                buy_price: parseFloat(batch.buyPrice),
                sell_price: parseFloat(batch.sellPrice),
                date_added: batch.dateAdded || new Date().toISOString()
            }));
        }

        console.log('Sending formatted product data:', JSON.stringify(formattedData));
        
        const response = await fetch('../api/products.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formattedData)
        });

        const text = await response.text();
        console.log('Server response:', text); // Debug log

        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.error('Invalid JSON response:', text);
            throw new Error('Server returned invalid JSON');
        }
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to save product');
        }
        
        // Reload inventory after successful save
        await loadInventory();
        return true;
    } catch (error) {
        console.error('Error saving product:', error);
        throw error;
    }
}

// Function to fix database issues
async function fixDatabaseIfNeeded() {
    try {
        console.log("Running database fix utility...");
        const response = await fetch('../api/table-fix.php?action=fix');
        const result = await response.json();
        
        console.log("Database fix result:", result);
        
        // Also try to fix the auto_increment issue specifically
        try {
            console.log("Running auto_increment fix utility...");
            const autoIncrResponse = await fetch('../api/fix-id-autoincrement.php');
            const autoIncrResult = await autoIncrResponse.json();
            console.log("Auto increment fix result:", autoIncrResult);
            
            if (autoIncrResult.success) {
                console.log("Successfully fixed auto_increment issues");
                if (autoIncrResult.fixes_applied && autoIncrResult.fixes_applied.length > 0) {
                    showToast("Fixed database auto_increment", 'success');
                }
            }
        } catch (autoIncrError) {
            console.error("Error during auto-increment fix:", autoIncrError);
        }
        
        // Also try to run the batch-fix utility to ensure correct column names
        try {
            console.log("Running batch table fix utility...");
            const batchFixResponse = await fetch('../api/batch-fix.php');
            
            // Handle potential 404 error for batch-fix.php
            if (!batchFixResponse.ok) {
                if (batchFixResponse.status === 404) {
                    console.warn("Batch fix utility not found (404). This is expected if you haven't created the file yet.");
                    // We can continue without this fix since we'll handle the error gracefully
                } else {
                    throw new Error(`Batch fix HTTP error: ${batchFixResponse.status}`);
                }
            } else {
                // Only try to parse JSON if the response was successful
                const batchFixResult = await batchFixResponse.json();
                console.log("Batch fix result:", batchFixResult);
                
                if (batchFixResult.success && batchFixResult.results.fixes_applied.length > 0) {
                    console.log("Applied batch table fixes:", batchFixResult.results.fixes_applied);
                    showToast("Fixed batch table structure: " + batchFixResult.results.fixes_applied.join(", "), 'success');
                }
            }
        } catch (batchError) {
            // Don't let the batch fix error stop the process
            console.error("Error during batch table fix (continuing anyway):", batchError);
        }
        
        if (result.success) {
            if (result.results.fixes_applied.length > 0) {
                showToast("Database tables fixed: " + result.results.fixes_applied.join(", "), 'success');
            }
            return true;
        } else {
            console.error("Database fix failed:", result.error);
            showToast("Failed to fix database: " + result.error, 'error');
            return false;
        }
    } catch (error) {
        console.error("Error during database fix:", error);
        showToast("Error fixing database", 'error');
        return false;
    }
}

// Update product on server
async function updateProduct(productId, productData) {
    try {
        // Validate required fields
        if (!productData.name || !productData.category) {
            throw new Error('Product name and category are required');
        }

        // Add the ID to the product data
        productData.id = productId;
        
        // Add category_id while keeping the category name
        productData.category_id = getCategoryId(productData.category);

        const result = await apiRequest('products', 'PUT', productData);
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to update product');
        }
        
        // Reload inventory after successful update
        await loadInventory();
        return true;
    } catch (error) {
        console.error('Error updating product:', error);
        throw error; // Propagate the error to be handled by the caller
    }
}

// Helper function to convert category name to ID
function getCategoryId(categoryName) {
    const categoryMap = {
        'CPU': 1,
        'Motherboard': 2,
        'RAM': 3,
        'Storage': 4,
        'GPU': 5,
        'PSU': 6,
        'Desktop': 7,
        'Laptop': 8
    };
    return categoryMap[categoryName] || 1; // Default to 1 if category not found
}

// Delete product from server
async function deleteProduct(productId) {
    try {
        const result = await apiRequest(`products/${productId}`, 'DELETE');
        if (result.success) {
            await loadInventory();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('Error deleting product', 'error');
        return false;
    }
}

// Add batch to product
async function addBatch(productId, batchData) {
    try {
        // Validate batch data
        if (!batchData.batchId || !batchData.quantity || !batchData.buyPrice || !batchData.sellPrice) {
            throw new Error('Missing required batch data');
        }

        // Ensure numeric values
        const cleanedData = {
            batchId: batchData.batchId,
            quantity: parseInt(batchData.quantity),
            buyPrice: parseFloat(batchData.buyPrice),
            sellPrice: parseFloat(batchData.sellPrice),
            dateAdded: batchData.dateAdded || new Date().toISOString()
        };

        // Validate values
        if (cleanedData.quantity <= 0) throw new Error('Quantity must be greater than 0');
        if (cleanedData.buyPrice <= 0) throw new Error('Buy price must be greater than 0');
        if (cleanedData.sellPrice <= 0) throw new Error('Sell price must be greater than 0');
        if (cleanedData.sellPrice < cleanedData.buyPrice) {
            throw new Error('Sell price cannot be lower than buy price');
        }

        console.log('Sending batch data:', cleanedData, 'for product:', productId);

        const result = await apiRequest(`products/${productId}/batches`, 'POST', cleanedData);
        
        if (result.success) {
            await loadInventory(); // Reload inventory after successful batch addition
            return true;
        }
        
        throw new Error(result.error || 'Failed to add batch');
    } catch (error) {
        console.error('Error adding batch:', error);
        showToast(error.message || 'Error adding batch', 'error');
        throw error;
    }
}

// Add transaction to product
async function addTransaction(productId, transactionData) {
    try {
        const result = await apiRequest(`products/${productId}/transactions`, 'POST', transactionData);
        if (result.success) {
            await loadInventory();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error adding transaction:', error);
        showToast('Error adding transaction', 'error');
        return false;
    }
}

// Generate unique IDs
function generateProductId() {
    const prefix = 'KCC';
    const timestamp = Date.now().toString(36);  // Use full timestamp in base36
    const random = Math.random().toString(36).substr(2, 5);  // 5 random chars
    return `${prefix}${timestamp}${random}`.toUpperCase();
}

function generateBatchId() {
    return 'BATCH-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Toast notification function
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (toast && toastMessage) {
        toast.className = `fixed bottom-4 right-4 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white px-6 py-3 rounded-lg shadow-lg flex items-center`;
        toastMessage.textContent = message;
        toast.classList.remove('hidden');
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
}

// Function to format specifications for display
function formatSpecifications(product) {
    if (!product.specifications || !Array.isArray(product.specifications)) {
        return '';
    }

    return product.specifications
        .filter(spec => spec && spec.name && spec.value) // Filter out invalid specs
        .map(spec => {
            const name = spec.name.charAt(0).toUpperCase() + spec.name.slice(1);
            return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                ${name}: ${spec.value}
            </span>`;
        })
        .join(' ');
}

// Move updateInventoryTable definition before DOMContentLoaded
// Make it a global function
window.updateInventoryTable = function() {
    const tableBody = document.getElementById('inventoryTableBody');
    if (!tableBody) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    const categoryValue = categoryFilter.value;

    const filteredInventory = inventory.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                            product.id.toLowerCase().includes(searchTerm);
        const matchesCategory = !categoryValue || product.category === categoryValue;
        return matchesSearch && matchesCategory;
    });

    tableBody.innerHTML = filteredInventory.map(product => {
        // Calculate total quantity and get active batch
        const batches = product.batches || [];
        const totalQuantity = batches.reduce((sum, batch) => sum + (parseInt(batch.remaining) || 0), 0);
        
        // Get active batch (batch with remaining stock)
        const activeBatch = batches.find(batch => parseInt(batch.remaining) > 0);
        
        const stockClass = totalQuantity < 5 ? 'text-red-600 font-medium' : 'text-gray-900';
        
        // Format prices and calculate margin
        const buyPrice = activeBatch ? parseFloat(activeBatch.buyPrice) : 0;
        const sellPrice = activeBatch ? parseFloat(activeBatch.sellPrice) : 0;
        const margin = buyPrice > 0 ? ((sellPrice - buyPrice) / buyPrice * 100) : 0;
        
        // Format specifications
        const specificationsHtml = formatSpecifications(product);
        
        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${product.id}</td>
                <td class="px-6 py-4 text-sm text-gray-900">
                    <div class="font-medium">${product.name}</div>
                    <div class="text-xs text-gray-500 mt-1">
                        ${specificationsHtml}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${product.category}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${buyPrice > 0 ? `₱${buyPrice.toFixed(2)}` : '₱0.00'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${sellPrice > 0 ? `₱${sellPrice.toFixed(2)}` : '₱0.00'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${margin > 0 ? `${margin.toFixed(2)}%` : '0.00%'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${stockClass}">${totalQuantity}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button class="text-green-600 hover:text-green-800 transition-colors purchase-btn" 
                            data-action="recordPurchase" data-product-id="${product.id}"
                            title="Record Purchase">
                        <i class="fas fa-shopping-cart"></i>
                    </button>
                    <button class="text-blue-600 hover:text-blue-800 transition-colors sale-btn"
                            data-action="recordSale" data-product-id="${product.id}"
                            ${totalQuantity === 0 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
                            title="Record Sale">
                        <i class="fas fa-cash-register"></i>
                    </button>
                    <button class="text-purple-600 hover:text-purple-800 transition-colors batches-btn" 
                            data-action="viewBatches" data-product-id="${product.id}"
                            title="View Batches">
                        <i class="fas fa-layer-group"></i>
                    </button>
                    <button class="text-yellow-600 hover:text-yellow-800 transition-colors edit-btn" 
                            data-action="editProduct" data-product-id="${product.id}"
                            title="Edit Product">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-600 hover:text-red-800 transition-colors delete-btn" 
                            data-action="deleteProduct" data-product-id="${product.id}"
                            title="Delete Product">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

// Move updateReports definition before DOMContentLoaded
window.updateReports = function() {
    const totalProducts = inventory.length;
    const totalValue = inventory.reduce((sum, product) => {
        const totalBatchValue = (product.batches || []).reduce((batchSum, batch) => 
            batchSum + (batch.remaining * batch.buyPrice), 0);
        return sum + totalBatchValue;
    }, 0);
    const lowStockItems = inventory.filter(product => 
        (product.batches || []).reduce((sum, batch) => sum + batch.remaining, 0) < 5
    ).length;

    const totalProductsElement = document.getElementById('totalProducts');
    const totalValueElement = document.getElementById('totalValue');
    const lowStockCountElement = document.getElementById('lowStockCount');

    if (totalProductsElement) totalProductsElement.textContent = totalProducts;
    if (totalValueElement) totalValueElement.textContent = `₱${totalValue.toFixed(2)}`;
    if (lowStockCountElement) lowStockCountElement.textContent = lowStockItems;
};

// Move addSpecificationField function definition outside DOMContentLoaded
window.addSpecificationField = function() {
    const container = document.getElementById('specifications-container');
    if (!container) {
        console.error('Specifications container not found');
        return;
    }
    
    const specDiv = document.createElement('div');
    specDiv.className = 'specification-input flex gap-2 mt-2';
    specDiv.innerHTML = `
        <div class="flex-1">
            <input type="text" name="specName" placeholder="Specification Name"
                   class="w-full border border-gray-300 rounded-lg p-2">
        </div>
        <div class="flex-1">
            <input type="text" name="specValue" placeholder="Value"
                   class="w-full border border-gray-300 rounded-lg p-2">
        </div>
        <button type="button" onclick="this.closest('.specification-input').remove()"
                class="px-2 py-2 text-red-600 hover:text-red-800">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(specDiv);
};

// Update the toggleSpecificationFields function
function toggleSpecificationFields() {
    const category = document.getElementById('productCategory').value;
    const componentSpecs = document.getElementById('componentSpecs');
    
    // Hide all spec divs first
    document.querySelectorAll('[id$="Specs"]').forEach(div => {
        div.classList.add('hidden');
    });

    // Show component specs section based on category
    const pcComponents = ['CPU', 'Motherboard', 'RAM', 'Storage', 'GPU', 'PSU', 'Case', 'CPU Cooler', 'Case Fan'];
    const pcSystems = ['Desktop', 'Laptop', 'All-in-One'];
    const peripherals = ['Monitor', 'Keyboard', 'Mouse', 'Headset', 'Webcam', 'Speakers', 'Microphone'];
    
    if ([...pcComponents, ...pcSystems, ...peripherals].includes(category)) {
        componentSpecs.classList.remove('hidden');
        
        // Show specific component's specs
        const specDiv = document.getElementById(`${category.toLowerCase().replace(/\s+/g, '')}Specs`);
        if (specDiv) {
            specDiv.classList.remove('hidden');
            // Reset fields
            specDiv.querySelectorAll('input, select').forEach(input => {
                input.value = '';
            });
        } else if (pcSystems.includes(category)) {
            // For PC systems, show desktop or laptop specs
            if (category === 'All-in-One') {
                const desktopSpecs = document.getElementById('desktopSpecs');
                if (desktopSpecs) {
                    desktopSpecs.classList.remove('hidden');
                    desktopSpecs.querySelectorAll('input, select').forEach(input => {
                        input.value = '';
                    });
                }
            } else {
                const systemSpecs = document.getElementById(`${category.toLowerCase()}Specs`);
                if (systemSpecs) {
                    systemSpecs.classList.remove('hidden');
                    systemSpecs.querySelectorAll('input, select').forEach(input => {
                        input.value = '';
                    });
                }
            }
        } else if (peripherals.includes(category)) {
            // Handle peripherals - you could add specific spec sections for peripherals later
        }
    } else {
        componentSpecs.classList.add('hidden');
    }
}

// Update the DOMContentLoaded event listener structure
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Load inventory from server
        inventory = await loadInventory();
        
        // If server load fails, try loading from localStorage
        if (!inventory || inventory.length === 0) {
            inventory = JSON.parse(localStorage.getItem('inventory')) || [];
        }
        
        // Update the UI
        updateInventoryTable();
        updateReports();

        // Initialize specifications container if it exists
        const specsContainer = document.getElementById('specifications-container');
        if (specsContainer) {
            // Clear any existing fields
            specsContainer.innerHTML = '';
            // Add initial specification field
            addSpecificationField();
        }

        // Add button for adding new specification fields
        const addSpecButton = document.getElementById('addSpecificationButton');
        if (addSpecButton) {
            addSpecButton.addEventListener('click', function(e) {
                e.preventDefault();
                addSpecificationField();
            });
        }

        // Add event listeners for search and filter
        if (searchInput) {
            searchInput.addEventListener('input', updateInventoryTable);
        }
        if (categoryFilter) {
            categoryFilter.addEventListener('change', updateInventoryTable);
        }

        // Update the product form submission
        if (addProductForm) {
            addProductForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                try {
                    // Get basic form values
                    const name = document.getElementById('productName')?.value.trim();
                    const category = document.getElementById('productCategory')?.value;
                    const initialPrice = parseFloat(document.getElementById('productBuyPrice')?.value || '0');
                    const sellPrice = parseFloat(document.getElementById('productSellPrice')?.value || '0');
                    const initialQuantity = parseInt(document.getElementById('productQuantity')?.value || '0');
                    
                    // Get component-specific specifications
                    let specifications = [];

                    const pcComponents = ['CPU', 'Motherboard', 'RAM', 'Storage', 'GPU', 'PSU', 'Case', 'CPU Cooler', 'Case Fan'];
                    const pcSystems = ['Desktop', 'Laptop', 'All-in-One'];
                    const peripherals = ['Monitor', 'Keyboard', 'Mouse', 'Headset', 'Webcam', 'Speakers', 'Microphone'];
                    
                    if ([...pcComponents, ...pcSystems, ...peripherals].includes(category)) {
                        // First try category-specific div
                        const specDiv = document.getElementById(`${category.toLowerCase().replace(/\s+/g, '')}Specs`);
                        
                        // For All-in-One, use desktop specs
                        if (category === 'All-in-One' && !specDiv) {
                            const desktopSpecs = document.getElementById('desktopSpecs');
                            if (desktopSpecs) {
                                desktopSpecs.querySelectorAll('input, select').forEach(input => {
                                    if (input.value) {
                                        specifications.push({
                                            name: input.name,
                                            value: input.value,
                                            label: input.previousElementSibling?.textContent || input.name
                                        });
                                    }
                                });
                            }
                        }
                        // For other categories, use their specific specs div
                        else if (specDiv) {
                            specDiv.querySelectorAll('input, select').forEach(input => {
                                if (input.value) {
                                    specifications.push({
                                        name: input.name,
                                        value: input.value,
                                        label: input.previousElementSibling?.textContent || input.name
                                    });
                                }
                            });
                        }
                    }

                    // Debug log specifications
                    console.log('Collected specifications:', specifications);

                    // Validate required values
                    if (!name || !category) {
                        showToast('Product name and category are required', 'error');
                        return;
                    }
                    if (isNaN(initialPrice) || isNaN(sellPrice) || isNaN(initialQuantity)) {
                        showToast('Please enter valid prices and quantity', 'error');
                        return;
                    }

                    // Create the product object
                    const product = {
                        id: generateProductId(),
                        name: name,
                        category: category,
                        specifications: specifications,
                        batches: [],
                        transactions: [],
                        lastUpdated: new Date().toISOString()
                    };

                    // Add initial batch with both buy and sell prices
                    if (initialQuantity > 0) {
                        product.batches.push({
                            batchId: generateBatchId(),
                            quantity: initialQuantity,
                            buyPrice: initialPrice,
                            sellPrice: sellPrice,
                            dateAdded: new Date().toISOString(),
                            remaining: initialQuantity
                        });
                    }

                    // Debug log the product
                    console.log('New product data:', product);

                    try {
                        // Save the product
                        await saveProduct(product);
                        
                        // Update UI
                        await loadInventory();
                        updateInventoryTable();
                        updateReports();
                        
                        // Reset form
                        e.target.reset();
                        const specsContainer = document.getElementById('specifications-container');
                        if (specsContainer) {
                            specsContainer.innerHTML = '';
                            addSpecificationField();
                        }
                        
                        showToast('Product added successfully!');
                    } catch (error) {
                        console.error('Error saving product:', error);
                        showToast(error.message || 'Error saving product', 'error');
                    }
                } catch (error) {
                    console.error('Error adding product:', error);
                    showToast(error.message || 'Error adding product', 'error');
                }
            });
        }

        // Product Management
        function addProductBatch(productId, quantity, buyPrice, sellPrice) {
            const product = inventory.find(p => p.id === productId);
            if (product) {
                product.batches = product.batches || [];
                product.batches.push({
                    batchId: generateBatchId(),
                    quantity: quantity,
                    buyPrice: buyPrice,
                    sellPrice: sellPrice,
                    dateAdded: new Date().toISOString(),
                    remaining: quantity
                });
                product.lastUpdated = new Date().toISOString();
                saveProduct(product);
                updateInventoryTable();
            }
        }

        // Record Purchase (New Delivery)
        window.recordPurchase = function(productId) {
            const product = inventory.find(p => p.id === productId);
            if (!product) return;

            // Get the latest batch for default values
            const latestBatch = product.batches && product.batches.length > 0 
                ? product.batches[product.batches.length - 1] 
                : null;

            // Create modal for new delivery
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center';
            modal.innerHTML = `
                <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
                    <h3 class="text-xl font-semibold mb-4">New Delivery for ${product.name}</h3>
                    <form id="newDeliveryForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                            <input type="number" id="newQuantity" required min="1" 
                                   class="w-full border border-gray-300 rounded-lg p-2.5">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">New Buy Price</label>
                            <div class="relative">
                                <span class="absolute left-3 top-2.5 text-gray-500">₱</span>
                                <input type="number" id="newBuyPrice" required min="0" step="0.01" 
                                       value="${latestBatch ? parseFloat(latestBatch.buyPrice) || 0 : ''}"
                                       class="w-full pl-7 border border-gray-300 rounded-lg p-2.5">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">New Sell Price</label>
                            <div class="relative">
                                <span class="absolute left-3 top-2.5 text-gray-500">₱</span>
                                <input type="number" id="newSellPrice" required min="0" step="0.01"
                                       value="${latestBatch ? parseFloat(latestBatch.sellPrice) || 0 : ''}"
                                       class="w-full pl-7 border border-gray-300 rounded-lg p-2.5">
                            </div>
                        </div>
                        <div class="flex justify-end space-x-3">
                            <button type="button" onclick="this.closest('.fixed').remove()" 
                                    class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                                Cancel
                            </button>
                            <button type="submit" 
                                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                Add Delivery
                            </button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);

            document.getElementById('newDeliveryForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                try {
                    const quantity = parseInt(document.getElementById('newQuantity').value) || 0;
                    const newBuyPrice = parseFloat(document.getElementById('newBuyPrice').value) || 0;
                    const newSellPrice = parseFloat(document.getElementById('newSellPrice').value) || 0;

                    if (quantity <= 0) throw new Error('Quantity must be greater than 0');
                    if (newBuyPrice <= 0) throw new Error('Buy price must be greater than 0');
                    if (newSellPrice <= 0) throw new Error('Sell price must be greater than 0');
                    if (newSellPrice < newBuyPrice) throw new Error('Sell price cannot be lower than buy price');

                    const batchData = {
                        batchId: generateBatchId(),
                        quantity: quantity,
                        buyPrice: newBuyPrice,
                        sellPrice: newSellPrice,
                        dateAdded: new Date().toISOString(),
                        remaining: quantity
                    };

                    await addBatch(productId, batchData);
                    modal.remove();
                    showToast('New delivery recorded successfully!');
                } catch (error) {
                    console.error('Error recording delivery:', error);
                    showToast(error.message || 'Error recording delivery', 'error');
                }
            });
        };

        // Update the Record Sale function
        window.recordSale = function(productId) {
            const product = inventory.find(p => p.id === productId);
            if (!product || !product.batches) return;

            // Filter only batches with remaining stock
            const availableBatches = product.batches
                .filter(batch => parseInt(batch.remaining) > 0)
                .sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));

            if (availableBatches.length === 0) {
                showToast('No stock available!', 'error');
                return;
            }

            // Create modal for sale
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center';
            modal.innerHTML = `
                <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl">
                    <h3 class="text-xl font-semibold mb-4">Record Sale for ${product.name}</h3>
                    
                    <!-- Batch Selection -->
                    <div class="mb-6">
                        <h4 class="font-medium text-gray-700 mb-2">Select Batch to Sell From:</h4>
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Select</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Batch Date</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Buy Price</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sell Price</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    ${availableBatches.map((batch, index) => {
                                        const buyPrice = parseFloat(batch.buyPrice) || 0;
                                        const sellPrice = parseFloat(batch.sellPrice) || 0;
                                        const remaining = parseInt(batch.remaining) || 0;
                                        const margin = buyPrice > 0 ? ((sellPrice - buyPrice) / buyPrice * 100) : 0;
                                        
                                        return `
                                            <tr class="hover:bg-gray-50">
                                                <td class="px-4 py-2 text-sm">
                                                    <input type="radio" name="selectedBatch" value="${batch.batchId}"
                                                           class="form-radio h-4 w-4 text-blue-600" 
                                                           onchange="updateSaleDetails('${batch.batchId}')"
                                                           ${index === 0 ? 'checked' : ''}>
                                                </td>
                                                <td class="px-4 py-2 text-sm">
                                                    ${new Date(batch.dateAdded).toLocaleDateString()}
                                                </td>
                                                <td class="px-4 py-2 text-sm">₱${buyPrice.toFixed(2)}</td>
                                                <td class="px-4 py-2 text-sm">₱${sellPrice.toFixed(2)}</td>
                                                <td class="px-4 py-2 text-sm">${remaining}</td>
                                                <td class="px-4 py-2 text-sm">${margin.toFixed(1)}%</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Sale Details -->
                    <div id="saleDetails" class="bg-green-50 p-4 rounded-lg mb-6">
                        <!-- Will be updated by updateSaleDetails function -->
                    </div>

                    <form id="recordSaleForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Quantity to Sell</label>
                            <input type="number" id="saleQuantity" required min="1"
                                   class="w-full border border-gray-300 rounded-lg p-2.5">
                            <p class="text-sm text-amber-600 mt-2">
                                <i class="fas fa-info-circle mr-1"></i>
                                Note: Make sure to check the available stock in the selected batch.
                            </p>
                        </div>

                        <div class="flex justify-end space-x-3">
                            <button type="button" onclick="this.closest('.fixed').remove()" 
                                    class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                                Cancel
                            </button>
                            <button type="submit" 
                                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                Record Sale
                            </button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);

            // Function to update sale details when batch selection changes
            window.updateSaleDetails = function(batchId) {
                const selectedBatch = availableBatches.find(b => b.batchId === batchId);
                if (!selectedBatch) return;

                const buyPrice = parseFloat(selectedBatch.buyPrice) || 0;
                const sellPrice = parseFloat(selectedBatch.sellPrice) || 0;
                const remaining = parseInt(selectedBatch.remaining) || 0;
                const margin = buyPrice > 0 ? ((sellPrice - buyPrice) / buyPrice * 100) : 0;

                const saleDetails = document.getElementById('saleDetails');
                if (saleDetails) {
                    saleDetails.innerHTML = `
                        <h4 class="font-medium text-gray-800 mb-2">Selected Batch Details:</h4>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="text-gray-600">Batch Date:</span>
                                <span class="font-medium">${new Date(selectedBatch.dateAdded).toLocaleDateString()}</span>
                            </div>
                            <div>
                                <span class="text-gray-600">Selling Price:</span>
                                <span class="font-medium">₱${sellPrice.toFixed(2)}</span>
                            </div>
                            <div>
                                <span class="text-gray-600">Available Stock:</span>
                                <span class="font-medium">${remaining}</span>
                            </div>
                            <div>
                                <span class="text-gray-600">Margin:</span>
                                <span class="font-medium">${margin.toFixed(1)}%</span>
                            </div>
                        </div>
                    `;
                }

                // Update quantity input max value
                const quantityInput = document.getElementById('saleQuantity');
                if (quantityInput) {
                    quantityInput.max = remaining;
                    quantityInput.value = ''; // Reset value when changing batch
                }
            };

            // Initialize sale details for the first batch
            updateSaleDetails(availableBatches[0].batchId);

            // Handle form submission
            document.getElementById('recordSaleForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                try {
                    const selectedBatchId = document.querySelector('input[name="selectedBatch"]:checked')?.value;
                    if (!selectedBatchId) {
                        throw new Error('Please select a batch');
                    }

                    const currentBatch = availableBatches.find(b => b.batchId === selectedBatchId);
                    if (!currentBatch) {
                        throw new Error('Selected batch not found');
                    }

                    const quantity = parseInt(document.getElementById('saleQuantity').value) || 0;
                    const buyPrice = parseFloat(currentBatch.buyPrice) || 0;
                    const sellPrice = parseFloat(currentBatch.sellPrice) || 0;
                    const remaining = parseInt(currentBatch.remaining) || 0;
                    
                    // Validate quantity
                    if (quantity <= 0) {
                        throw new Error('Quantity must be greater than 0');
                    }
                    if (quantity > remaining) {
                        throw new Error('Cannot sell more than available in selected batch');
                    }

                    // Update batch remaining quantity
                    currentBatch.remaining = remaining - quantity;
                    
                    // Record the sale transaction
                    const transactionData = {
                        type: 'sale',
                        quantity: quantity,
                        batchId: currentBatch.batchId,
                        sellPrice: sellPrice,
                        buyPrice: buyPrice,
                        date: new Date().toISOString(),
                        profit: (sellPrice - buyPrice) * quantity
                    };

                    await addTransaction(productId, transactionData);
                    modal.remove();
                    
                    // Show appropriate message
                    if (currentBatch.remaining === 0) {
                        showToast('Batch sold out!', 'success');
                    } else {
                        showToast('Sale recorded successfully!');
                    }
                } catch (error) {
                    console.error('Error recording sale:', error);
                    showToast(error.message || 'Error recording sale', 'error');
                }
            });
        };

        // Add view batches functionality
        window.viewBatches = function(productId) {
            const product = inventory.find(p => p.id === productId);
            if (!product || !product.batches) return;

            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center';
            modal.innerHTML = `
                <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl">
                    <h3 class="text-xl font-semibold mb-4">Batch Details for ${product.name}</h3>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch ID</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Added</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Buy Price</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sell Price</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Initial Qty</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${product.batches.map(batch => {
                                    // Convert price values to numbers
                                    const buyPrice = parseFloat(batch.buyPrice) || 0;
                                    const sellPrice = parseFloat(batch.sellPrice) || 0;
                                    const quantity = parseInt(batch.quantity) || 0;
                                    const remaining = parseInt(batch.remaining) || 0;
                                    
                                    return `
                                        <tr>
                                            <td class="px-6 py-4 text-sm text-gray-900">${batch.batchId}</td>
                                            <td class="px-6 py-4 text-sm text-gray-900">
                                                ${new Date(batch.dateAdded).toLocaleDateString()}
                                            </td>
                                            <td class="px-6 py-4 text-sm text-gray-900">₱${buyPrice.toFixed(2)}</td>
                                            <td class="px-6 py-4 text-sm text-gray-900">₱${sellPrice.toFixed(2)}</td>
                                            <td class="px-6 py-4 text-sm text-gray-900">${quantity}</td>
                                            <td class="px-6 py-4 text-sm text-gray-900">${remaining}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-4 flex justify-end">
                        <button onclick="this.closest('.fixed').remove()" 
                                class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                            Close
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
        }

        // Move deleteProduct inside DOMContentLoaded and make it global
        window.deleteProduct = async function(productId) {
            if (confirm('Are you sure you want to delete this product?')) {
                try {
                    console.log("Attempting to delete product: " + productId);
                    const result = await apiRequest(`products/${productId}`, 'DELETE');
                    
                    if (result.success) {
                        // Remove from local inventory
                        inventory = inventory.filter(product => product.id !== productId);
                        updateInventoryTable();
                        updateReports();
                        showToast('Product deleted successfully!');
                    } else {
                        throw new Error(result.error || 'Failed to delete product');
                    }
                } catch (error) {
                    console.error('Error deleting product:', error);
                    showToast(error.message || 'Error deleting product', 'error');
                }
            }
        };

        // Initial UI update
        updateInventoryTable();
        updateReports();
    } catch (error) {
        console.error('Error in initialization:', error);
        showToast('Error initializing application', 'error');
    }
}); // End of DOMContentLoaded

// Make sure navigation functions are defined at the global scope
window.showInventory = function() {
    const inventorySection = document.getElementById('inventorySection');
    const addProductSection = document.getElementById('addProductSection');
    const reportsSection = document.getElementById('reportsSection');
    const mobileMenu = document.getElementById('mobileMenu');

    if (inventorySection && addProductSection && reportsSection) {
        inventorySection.classList.remove('hidden');
        addProductSection.classList.add('hidden');
        reportsSection.classList.add('hidden');
        if (mobileMenu) mobileMenu.classList.add('hidden');
    }
};

window.showAddProduct = function() {
    const inventorySection = document.getElementById('inventorySection');
    const addProductSection = document.getElementById('addProductSection');
    const reportsSection = document.getElementById('reportsSection');
    const mobileMenu = document.getElementById('mobileMenu');

    if (inventorySection && addProductSection && reportsSection) {
        inventorySection.classList.add('hidden');
        addProductSection.classList.remove('hidden');
        reportsSection.classList.add('hidden');
        if (mobileMenu) mobileMenu.classList.add('hidden');
    }
};

window.showReports = function() {
    const inventorySection = document.getElementById('inventorySection');
    const addProductSection = document.getElementById('addProductSection');
    const reportsSection = document.getElementById('reportsSection');
    const mobileMenu = document.getElementById('mobileMenu');

    if (inventorySection && addProductSection && reportsSection) {
        inventorySection.classList.add('hidden');
        addProductSection.classList.add('hidden');
        reportsSection.classList.remove('hidden');
        if (mobileMenu) mobileMenu.classList.add('hidden');
        updateReports();
    }
};

window.toggleMobileMenu = function() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.toggle('hidden');
    }
};

// Event Listeners
// searchInput.addEventListener('input', updateInventoryTable);
// categoryFilter.addEventListener('change', updateInventoryTable); 

// Function to validate and format prices
function validateAndFormatPrices(rowData) {
    try {
        // Extract price values
        let buyPrice = rowData.buyPrice;
        let sellPrice = rowData.sellPrice;

        // Handle string values with currency symbols and commas
        if (typeof buyPrice === 'string') {
            buyPrice = parseFloat(buyPrice.replace(/[₱,]/g, ''));
        }
        if (typeof sellPrice === 'string') {
            sellPrice = parseFloat(sellPrice.replace(/[₱,]/g, ''));
        }

        // Convert to numbers
        buyPrice = parseFloat(buyPrice);
        sellPrice = parseFloat(sellPrice);

        // Validate values
        if (isNaN(buyPrice) || buyPrice <= 0) {
            return { valid: false, error: 'Buy price must be greater than 0' };
        }
        if (isNaN(sellPrice) || sellPrice <= 0) {
            return { valid: false, error: 'Sell price must be greater than 0' };
        }
        if (sellPrice < buyPrice) {
            return { valid: false, error: 'Sell price cannot be lower than buy price' };
        }

        // Calculate margin
        const margin = ((sellPrice - buyPrice) / buyPrice) * 100;
        if (margin > 100) {
            console.warn(`High margin detected: ${margin.toFixed(1)}%`);
        }

        return {
            valid: true,
            buyPrice: buyPrice,
            sellPrice: sellPrice,
            margin: margin
        };
    } catch (error) {
        console.error('Error validating prices:', error);
        return { valid: false, error: 'Invalid price format' };
    }
}

// Add the Excel import function
window.importFromExcel = async function(input) {
    try {
        const file = input.files[0];
        if (!file) {
            showToast('No file selected', 'error');
            return;
        }

        // Validate file type
        if (!file.name.match(/\.(xls|xlsx)$/i)) {
            showToast('Please select an Excel file (.xls or .xlsx)', 'error');
            return;
        }

        // Show loading toast
        showToast('Processing Excel file...', 'info');

        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                console.log('Starting Excel file processing...');
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Validate workbook
                if (!workbook.SheetNames.length) {
                    throw new Error('Excel file is empty');
                }

                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                // Validate data
                if (!jsonData.length) {
                    throw new Error('No data found in Excel file');
                }

                console.log('Excel data parsed successfully:', {
                    sheets: workbook.SheetNames,
                    rowCount: jsonData.length,
                    sampleRow: jsonData[0]
                });

                // Intelligent column mapping
                const columnMap = intelligentlyMapColumns(Object.keys(jsonData[0]));
                console.log('Column mapping:', columnMap);
                
                // Smart data processing with validation
                const processedData = [];
                const errors = [];
                const warnings = [];

                for (let [index, row] of jsonData.entries()) {
                    try {
                        console.log(`Processing row ${index + 2}:`, row);
                        
                        // Map row data
                        const mappedRow = mapRowData(row, columnMap);
                        console.log(`Mapped row data:`, mappedRow);

                        // Validate prices
                        const prices = validateAndFormatPrices(mappedRow);
                        if (!prices.valid) {
                            console.warn(`Price validation failed for row ${index + 2}:`, prices.error, mappedRow);
                            throw new Error(prices.error);
                        }

                        // Detect category
                        const detectedCategory = detectCategory(mappedRow);
                        console.log(`Detected category for row ${index + 2}:`, detectedCategory);

                        // Initialize the product object
                        const product = {
                            id: mappedRow.id || generateProductId(),
                            name: mappedRow.name,
                            category: detectedCategory,
                            specifications: [],
                            batches: [],
                            lastUpdated: new Date().toISOString()
                        };

                        // Validate product name
                        if (!product.name) {
                            throw new Error('Product name is required');
                        }

                        // Extract specifications
                        const specs = extractSpecifications(mappedRow, product.category);
                        console.log(`Extracted specifications for row ${index + 2}:`, specs);
                        if (specs.length > 0) {
                            product.specifications = specs;
                        }

                        // Create batch
                        const batch = {
                            batchId: generateBatchId(),
                            quantity: parseInt(mappedRow.quantity) || 0,
                            buyPrice: prices.buyPrice,
                            sellPrice: prices.sellPrice,
                            dateAdded: new Date().toISOString(),
                            remaining: parseInt(mappedRow.quantity) || 0
                        };

                        // Validate margins
                        const margin = ((batch.sellPrice - batch.buyPrice) / batch.buyPrice) * 100;
                        if (margin < 0) {
                            warnings.push(`Row ${index + 2}: Selling price is lower than buying price for ${product.name}`);
                        } else if (margin > 100) {
                            warnings.push(`Row ${index + 2}: Unusually high margin (${margin.toFixed(1)}%) for ${product.name}`);
                        }

                        product.batches.push(batch);
                        processedData.push(product);
                        console.log(`Successfully processed row ${index + 2}`);

                    } catch (error) {
                        console.error(`Error processing row ${index + 2}:`, error);
                        errors.push(`Row ${index + 2}: ${error.message}`);
                    }
                }

                // Show warnings if any
                if (warnings.length > 0) {
                    console.warn('Import warnings:', warnings);
                    showToast(`Imported with ${warnings.length} warnings. Check console for details.`, 'warning');
                }

                // Handle errors if any
                if (errors.length > 0) {
                    console.error('Import errors:', errors);
                    if (errors.length === jsonData.length) {
                        throw new Error('Failed to process any rows from the Excel file');
                    }
                    showToast(`Failed to import ${errors.length} rows. Check console for details.`, 'error');
                }

                if (processedData.length > 0) {
                    // Smart merge with existing inventory
                    console.log('Starting inventory merge...');
                    const mergeResult = await smartMergeInventory(processedData);
                    console.log('Merge completed:', mergeResult);

                    // Update UI
                    updateInventoryTable();
                    updateReports();
                    showToast(`Successfully imported ${mergeResult.added} new and updated ${mergeResult.updated} existing products!`);
                    input.value = '';
                } else {
                    throw new Error('No valid data could be imported');
                }

            } catch (error) {
                console.error('Error processing Excel file:', error);
                showToast(error.message || 'Error processing Excel file', 'error');
            }
        };

        reader.onerror = function(error) {
            console.error('Error reading Excel file:', error);
            showToast('Error reading Excel file', 'error');
        };

        reader.readAsArrayBuffer(file);
    } catch (error) {
        console.error('Error importing Excel file:', error);
        showToast(error.message || 'Error importing Excel file', 'error');
    }
};

// Add this function to fix existing inventory categories
async function fixInventoryCategories() {
    try {
        let updated = false;
        const updatedInventory = inventory.map(product => {
            if (!product.name || !product.category) {
                console.warn('Invalid product data:', product);
                return product;
            }

            const detectedCategory = detectCategory({ 
                name: product.name, 
                category: product.category 
            });
            
            if (product.category !== detectedCategory) {
                console.log(`Updating category for ${product.name} from ${product.category} to ${detectedCategory}`);
                return {
                    ...product,
                    category: detectedCategory
                };
            }
            return product;
        });

        // Only update if changes were made
        const changedProducts = updatedInventory.filter((product, index) => 
            product.category !== inventory[index].category
        );

        if (changedProducts.length > 0) {
            console.log(`Updating ${changedProducts.length} products with new categories`);
            
            // Update each changed product individually
            for (const product of changedProducts) {
                try {
                    await saveProduct(product);
                    updated = true;
                } catch (error) {
                    console.warn(`Failed to update category for ${product.name}:`, error);
                }
            }
        }

        if (updated) {
            // Update local inventory
            inventory = updatedInventory;
            console.log('Updated inventory categories');
        }
        
        return updated;
    } catch (error) {
        console.error('Error fixing inventory categories:', error);
        return false;
    }
}

// Add the edit product function
window.editProduct = function(productId) {
    const product = inventory.find(p => p.id === productId);
    if (!product) return;

    // Create modal for editing
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center overflow-y-auto';
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl m-4">
            <h3 class="text-xl font-semibold mb-4">Edit Product: ${product.name}</h3>
            <form id="editProductForm" class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
                        <input type="text" id="editName" value="${product.name}" required
                               class="w-full border border-gray-300 rounded-lg p-2.5">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
                        <select id="editCategory" class="w-full border border-gray-300 rounded-lg p-2.5">
                            <option value="CPU" ${product.category === 'CPU' ? 'selected' : ''}>CPU (Processor)</option>
                            <option value="Motherboard" ${product.category === 'Motherboard' ? 'selected' : ''}>Motherboard</option>
                            <option value="RAM" ${product.category === 'RAM' ? 'selected' : ''}>RAM (Memory)</option>
                            <option value="Storage" ${product.category === 'Storage' ? 'selected' : ''}>Storage</option>
                            <option value="GPU" ${product.category === 'GPU' ? 'selected' : ''}>Graphics Card</option>
                            <option value="PSU" ${product.category === 'PSU' ? 'selected' : ''}>Power Supply</option>
                            <option value="Desktop" ${product.category === 'Desktop' ? 'selected' : ''}>Desktop PC</option>
                            <option value="Laptop" ${product.category === 'Laptop' ? 'selected' : ''}>Laptop</option>
                        </select>
                    </div>
                </div>

                <!-- Specifications -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Specifications</label>
                    <div id="editSpecifications" class="space-y-2">
                        ${product.specifications.map((spec, index) => `
                            <div class="flex gap-2 items-center specification-row">
                                <input type="text" name="specName" value="${spec.name}" placeholder="Name"
                                       class="flex-1 border border-gray-300 rounded-lg p-2">
                                <input type="text" name="specValue" value="${spec.value}" placeholder="Value"
                                       class="flex-1 border border-gray-300 rounded-lg p-2">
                                <button type="button" onclick="this.closest('.specification-row').remove()"
                                        class="px-2 py-2 text-red-600 hover:text-red-800">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <button type="button" onclick="addEditSpecification()"
                            class="mt-2 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                        <i class="fas fa-plus mr-2"></i>Add Specification
                    </button>
                </div>

                <!-- Latest Batch Information -->
                <div class="border-t pt-4">
                    <h4 class="font-medium mb-4">Current Batch Information</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Buy Price</label>
                            <div class="relative">
                                <span class="absolute left-3 top-2.5 text-gray-500">₱</span>
                                <input type="number" id="editBuyPrice" 
                                       value="${product.batches[0]?.buyPrice || 0}"
                                       class="w-full pl-7 border border-gray-300 rounded-lg p-2.5">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Sell Price</label>
                            <div class="relative">
                                <span class="absolute left-3 top-2.5 text-gray-500">₱</span>
                                <input type="number" id="editSellPrice" 
                                       value="${product.batches[0]?.sellPrice || 0}"
                                       class="w-full pl-7 border border-gray-300 rounded-lg p-2.5">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Current Stock</label>
                            <input type="number" id="editStock" readonly
                                   value="${product.batches.reduce((sum, batch) => sum + batch.remaining, 0)}"
                                   class="w-full border border-gray-300 rounded-lg p-2.5 bg-gray-50">
                        </div>
                    </div>
                </div>

                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="this.closest('.fixed').remove()" 
                            class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" 
                            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Add form submit handler
    document.getElementById('editProductForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            // Create updated product object
            const updatedProduct = {
                id: product.id,  // Keep the existing product ID
                string_id: product.string_id,  // Keep the existing string_id
                name: document.getElementById('editName').value.trim(),
                category: document.getElementById('editCategory').value,
                specifications: Array.from(document.querySelectorAll('#editSpecifications .specification-row'))
                    .map(row => ({
                        name: row.querySelector('[name="specName"]').value.trim(),
                        value: row.querySelector('[name="specValue"]').value.trim()
                    }))
                    .filter(spec => spec.name && spec.value)
            };

            // Validate required fields
            if (!updatedProduct.name || !updatedProduct.category) {
                throw new Error('Product name and category are required');
            }

            // Update the product
            await updateProduct(product.id, updatedProduct);
            
            // Update local state and UI
            const index = inventory.findIndex(p => p.id === product.id);
            if (index !== -1) {
                inventory[index] = {
                    ...inventory[index],
                    ...updatedProduct,
                    lastUpdated: new Date().toISOString()
                };
            }
            
            updateInventoryTable();
            modal.remove();
            showToast('Product updated successfully!');
        } catch (error) {
            console.error('Error updating product:', error);
            showToast(error.message || 'Error updating product', 'error');
        }
    });
};

// Add specification row in edit modal
window.addEditSpecification = function() {
    const container = document.getElementById('editSpecifications');
    if (!container) return;

    const specRow = document.createElement('div');
    specRow.className = 'flex gap-2 items-center specification-row';
    specRow.innerHTML = `
        <input type="text" name="specName" placeholder="Name"
               class="flex-1 border border-gray-300 rounded-lg p-2">
        <input type="text" name="specValue" placeholder="Value"
               class="flex-1 border border-gray-300 rounded-lg p-2">
        <button type="button" onclick="this.closest('.specification-row').remove()"
                class="px-2 py-2 text-red-600 hover:text-red-800">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(specRow);
};

// Enhanced Specification Learning System
const SpecificationLearningSystem = {
    patterns: {},
    valueNormalizers: {
        storage: value => {
            const match = value.match(/(\d+(?:\.\d+)?)\s*(GB|TB|MB|KB)/i);
            if (!match) return value;
            const [_, num, unit] = match;
            const normalized = parseFloat(num);
            switch (unit.toUpperCase()) {
                case 'TB': return (normalized * 1024) + ' GB';
                case 'MB': return (normalized / 1024) + ' GB';
                case 'KB': return (normalized / (1024 * 1024)) + ' GB';
                default: return normalized + ' GB';
            }
        },
        frequency: value => {
            const match = value.match(/(\d+(?:\.\d+)?)\s*(GHz|MHz|KHz)/i);
            if (!match) return value;
            const [_, num, unit] = match;
            const normalized = parseFloat(num);
            switch (unit.toUpperCase()) {
                case 'MHZ': return (normalized / 1000) + ' GHz';
                case 'KHZ': return (normalized / 1000000) + ' GHz';
                default: return normalized + ' GHz';
            }
        },
        memory: value => {
            const match = value.match(/(\d+)\s*(GB|MB)/i);
            if (!match) return value;
            const [_, num, unit] = match;
            return unit.toUpperCase() === 'MB' ? 
                (parseInt(num) / 1024) + ' GB' : 
                parseInt(num) + ' GB';
        },
        cores: value => {
            const match = value.match(/(\d+)\s*(?:cores?)?/i);
            return match ? match[1] + ' cores' : value;
        },
        threads: value => {
            const match = value.match(/(\d+)\s*(?:threads?)?/i);
            return match ? match[1] + ' threads' : value;
        },
        power: value => {
            const match = value.match(/(\d+)\s*(?:W|Watts?)?/i);
            return match ? match[1] + 'W' : value;
        }
    },

    categoryPatterns: {
        CPU: {
            required: ['cores', 'frequency', 'socket'],
            optional: ['cache', 'threads', 'tdp'],
            aliases: {
                cores: ['core count', 'number of cores', 'cores', 'cpu cores'],
                frequency: ['clock speed', 'ghz', 'speed', 'frequency', 'base clock', 'boost clock'],
                socket: ['socket type', 'cpu socket', 'socket', 'platform'],
                cache: ['l3 cache', 'cache size', 'cache', 'l3', 'l2 cache'],
                threads: ['thread count', 'threads', 'logical processors'],
                tdp: ['power consumption', 'wattage', 'tdp', 'thermal design power']
            },
            patterns: {
                cores: /(\d+)\s*cores?/i,
                frequency: /(\d+(?:\.\d+)?)\s*(?:GHz|MHz)/i,
                socket: /(AM[1-5]|FM[1-2]|LGA\s*\d+)/i,
                cache: /(\d+(?:\.\d+)?)\s*(?:MB|KB)\s*(?:L[23])?\s*Cache/i,
                threads: /(\d+)\s*threads?/i,
                tdp: /(\d+)\s*W/i
            }
        },
        GPU: {
            required: ['memory', 'memory_type'],
            optional: ['core_clock', 'memory_clock', 'tdp', 'interface'],
            aliases: {
                memory: ['vram', 'memory size', 'video memory', 'graphics memory'],
                memory_type: ['memory technology', 'vram type', 'gddr'],
                core_clock: ['gpu clock', 'boost clock', 'engine clock'],
                memory_clock: ['memory speed', 'effective memory clock'],
                tdp: ['power consumption', 'wattage', 'board power'],
                interface: ['bus interface', 'pci express', 'pcie']
            },
            patterns: {
                memory: /(\d+)\s*GB/i,
                memory_type: /(GDDR[56X])/i,
                core_clock: /(\d+)\s*MHz/i,
                memory_clock: /(\d+)\s*MHz/i,
                tdp: /(\d+)\s*W/i,
                interface: /(PCIe\s*[0-9.x]+)/i
            }
        },
        RAM: {
            required: ['capacity', 'speed'],
            optional: ['timing', 'voltage', 'type'],
            aliases: {
                capacity: ['size', 'memory size', 'ram size', 'total capacity'],
                speed: ['frequency', 'mhz', 'clock speed', 'memory speed'],
                timing: ['cas latency', 'cl timing', 'latency', 'timings'],
                voltage: ['operating voltage', 'volt', 'recommended voltage'],
                type: ['memory type', 'ddr type', 'ram type']
            },
            patterns: {
                capacity: /(\d+)\s*GB/i,
                speed: /(\d+)\s*MHz/i,
                timing: /CL(\d+)/i,
                voltage: /(\d+(?:\.\d+)?)\s*V/i,
                type: /(DDR[34])/i
            }
        }
    },

    learn(category, name, value, success) {
        if (!this.patterns[category]) {
            this.patterns[category] = {
                values: new Map(),
                frequencies: new Map(),
                correlations: new Map()
            };
        }

        const categoryData = this.patterns[category];
        const normalizedName = name.toLowerCase().trim();
        
        // Update value frequencies
        if (!categoryData.values.has(normalizedName)) {
            categoryData.values.set(normalizedName, new Set());
        }
        if (!categoryData.frequencies.has(normalizedName)) {
            categoryData.frequencies.set(normalizedName, new Map());
        }

        const valueSet = categoryData.values.get(normalizedName);
        const freqMap = categoryData.frequencies.get(normalizedName);

        if (success) {
            valueSet.add(value);
            freqMap.set(value, (freqMap.get(value) || 0) + 1);

            // Learn correlations with other specifications
            if (!categoryData.correlations.has(normalizedName)) {
                categoryData.correlations.set(normalizedName, new Map());
            }
            const correlations = categoryData.correlations.get(normalizedName);

            // Update correlations with other specifications in the same product
            Object.entries(this.patterns[category].values).forEach(([otherName, otherValues]) => {
                if (otherName !== normalizedName) {
                    if (!correlations.has(otherName)) {
                        correlations.set(otherName, new Map());
                    }
                    const correlation = correlations.get(otherName);
                    correlation.set(value, (correlation.get(value) || 0) + 1);
                }
            });
        }
    },

    normalizeValue(category, name, value) {
        const normalizedName = name.toLowerCase().trim();
        
        // Try category-specific normalization first
        const categoryConfig = this.categoryPatterns[category];
        if (categoryConfig) {
            for (const [specType, aliases] of Object.entries(categoryConfig.aliases)) {
                if (aliases.includes(normalizedName) || normalizedName === specType) {
                    const pattern = categoryConfig.patterns[specType];
                    if (pattern) {
                        const match = value.match(pattern);
                        if (match) {
                            const normalizer = this.valueNormalizers[specType];
                            return normalizer ? normalizer(value) : match[1];
                        }
                    }
                }
            }
        }

        // Try generic normalizers
        for (const [type, normalizer] of Object.entries(this.valueNormalizers)) {
            if (normalizedName.includes(type)) {
                return normalizer(value);
            }
        }

        return value;
    },

    getConfidence(category, name, value) {
        if (!this.patterns[category]?.values.has(name)) return 0;

        const categoryData = this.patterns[category];
        const freqMap = categoryData.frequencies.get(name);
        const totalOccurrences = Array.from(freqMap.values()).reduce((a, b) => a + b, 0);
        
        if (totalOccurrences === 0) return 0;

        let confidence = 0;

        // Base confidence from frequency
        const valueFreq = freqMap.get(value) || 0;
        confidence += valueFreq / totalOccurrences;

        // Boost confidence based on correlations
        const correlations = categoryData.correlations.get(name);
        if (correlations) {
            let correlationScore = 0;
            correlations.forEach((correlation, otherName) => {
                const valueCorrelation = correlation.get(value) || 0;
                correlationScore += valueCorrelation / totalOccurrences;
            });
            confidence += correlationScore / correlations.size;
        }

        // Boost confidence if value matches known patterns
        const categoryConfig = this.categoryPatterns[category];
        if (categoryConfig) {
            for (const [specType, pattern] of Object.entries(categoryConfig.patterns)) {
                if (pattern.test(value)) {
                    confidence += 0.2;
                    break;
                }
            }
        }

        return Math.min(confidence, 1);
    },

    suggestMissingSpecs(category, existingSpecs) {
        const suggestions = [];
        const categoryConfig = this.categoryPatterns[category];
        
        if (!categoryConfig) return suggestions;

        // Check for missing required specifications
        categoryConfig.required.forEach(specName => {
            if (!existingSpecs.some(spec => 
                spec.name === specName || 
                categoryConfig.aliases[specName]?.includes(spec.name)
            )) {
                suggestions.push({
                    name: specName,
                    priority: 'high',
                    message: `Missing required specification: ${specName}`
                });
            }
        });

        // Check for missing optional specifications
        categoryConfig.optional.forEach(specName => {
            if (!existingSpecs.some(spec => 
                spec.name === specName || 
                categoryConfig.aliases[specName]?.includes(spec.name)
            )) {
                suggestions.push({
                    name: specName,
                    priority: 'medium',
                    message: `Consider adding optional specification: ${specName}`
                });
            }
        });

        return suggestions;
    }
};

// Enhanced Batch Handling System
const BatchManager = {
    mergeBatches(existingBatches, newBatches) {
        const mergedBatches = [...existingBatches];
        
        newBatches.forEach(newBatch => {
            // Look for similar batches
            const similarBatch = mergedBatches.find(existing => 
                this.areBatchesSimilar(existing, newBatch)
            );

            if (similarBatch) {
                // Update existing batch
                this.updateBatch(similarBatch, newBatch);
            } else {
                // Add new batch
                mergedBatches.push(this.normalizeBatch(newBatch));
            }
        });

        // Sort batches by date
        return mergedBatches.sort((a, b) => 
            new Date(b.dateAdded) - new Date(a.dateAdded)
        );
    },

    areBatchesSimilar(batch1, batch2) {
        const priceTolerance = 0.05; // 5% price difference tolerance
        
        const buyPriceDiff = Math.abs(
            (batch1.buyPrice - batch2.buyPrice) / batch1.buyPrice
        );
        const sellPriceDiff = Math.abs(
            (batch1.sellPrice - batch2.sellPrice) / batch1.sellPrice
        );

        return buyPriceDiff <= priceTolerance && 
               sellPriceDiff <= priceTolerance &&
               this.isDateClose(batch1.dateAdded, batch2.dateAdded, 24); // 24 hours tolerance
    },

    isDateClose(date1, date2, hoursTolerance) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diff = Math.abs(d1 - d2) / (1000 * 60 * 60); // difference in hours
        return diff <= hoursTolerance;
    },

    updateBatch(existingBatch, newBatch) {
        // Update quantities
        existingBatch.quantity += newBatch.quantity;
        existingBatch.remaining += newBatch.remaining;

        // Update prices using weighted average
        const totalQuantity = existingBatch.quantity + newBatch.quantity;
        existingBatch.buyPrice = (
            (existingBatch.buyPrice * existingBatch.quantity) +
            (newBatch.buyPrice * newBatch.quantity)
        ) / totalQuantity;
        
        existingBatch.sellPrice = (
            (existingBatch.sellPrice * existingBatch.quantity) +
            (newBatch.sellPrice * newBatch.quantity)
        ) / totalQuantity;

        // Keep the earlier date
        existingBatch.dateAdded = new Date(Math.min(
            new Date(existingBatch.dateAdded),
            new Date(newBatch.dateAdded)
        )).toISOString();
    },

    normalizeBatch(batch) {
        return {
            batchId: batch.batchId || generateBatchId(),
            quantity: parseInt(batch.quantity) || 0,
            remaining: parseInt(batch.remaining) || batch.quantity || 0,
            buyPrice: parseFloat(batch.buyPrice) || 0,
            sellPrice: parseFloat(batch.sellPrice) || 0,
            dateAdded: new Date(batch.dateAdded || Date.now()).toISOString()
        };
    },

    validateBatch(batch) {
        const errors = [];
        
        if (!batch.quantity || batch.quantity <= 0) {
            errors.push('Quantity must be greater than 0');
        }
        if (!batch.buyPrice || batch.buyPrice <= 0) {
            errors.push('Buy price must be greater than 0');
        }
        if (!batch.sellPrice || batch.sellPrice <= 0) {
            errors.push('Sell price must be greater than 0');
        }
        if (batch.sellPrice < batch.buyPrice) {
            errors.push('Sell price cannot be lower than buy price');
        }
        if (batch.remaining > batch.quantity) {
            errors.push('Remaining quantity cannot exceed total quantity');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
};

// Update the smart merge function to use the enhanced systems
async function smartMergeInventory(newProducts) {
    const stats = { added: 0, updated: 0, warnings: [] };
    
    for (const newProduct of newProducts) {
        try {
            // Look for existing product
            const existingIndex = inventory.findIndex(p => 
                p.id === newProduct.id || 
                p.name.toLowerCase() === newProduct.name.toLowerCase()
            );
            
            if (existingIndex === -1) {
                // Validate and normalize new product
                newProduct.specifications = newProduct.specifications.map(spec => ({
                    name: spec.name.toLowerCase().trim(),
                    value: SpecificationLearningSystem.normalizeValue(
                        newProduct.category,
                        spec.name,
                        spec.value
                    )
                }));

                // Check for missing specifications
                const missingSuggestions = SpecificationLearningSystem.suggestMissingSpecs(
                    newProduct.category,
                    newProduct.specifications
                );
                
                if (missingSuggestions.length > 0) {
                    stats.warnings.push({
                        product: newProduct.name,
                        suggestions: missingSuggestions
                    });
                }

                // Validate batches
                newProduct.batches = newProduct.batches.filter(batch => {
                    const validation = BatchManager.validateBatch(batch);
                    if (!validation.valid) {
                        stats.warnings.push({
                            product: newProduct.name,
                            batch: batch.batchId,
                            errors: validation.errors
                        });
                        return false;
                    }
                    return true;
                });

                // Add new product
                inventory.push(newProduct);
                stats.added++;
            } else {
                // Update existing product
                const existing = inventory[existingIndex];
                
                // Merge specifications with learning
                const mergedSpecs = [...existing.specifications];
                newProduct.specifications.forEach(newSpec => {
                    const normalizedValue = SpecificationLearningSystem.normalizeValue(
                        newProduct.category,
                        newSpec.name,
                        newSpec.value
                    );

                    const existingSpecIndex = mergedSpecs.findIndex(
                        s => s.name.toLowerCase() === newSpec.name.toLowerCase()
                    );
                    
                    if (existingSpecIndex === -1) {
                        mergedSpecs.push({
                            name: newSpec.name.toLowerCase().trim(),
                            value: normalizedValue
                        });
                        
                        SpecificationLearningSystem.learn(
                            newProduct.category,
                            newSpec.name,
                            normalizedValue,
                            true
                        );
                    } else {
                        // Update if new value has higher confidence
                        const existingConfidence = SpecificationLearningSystem.getConfidence(
                            existing.category,
                            mergedSpecs[existingSpecIndex].name,
                            mergedSpecs[existingSpecIndex].value
                        );
                        const newConfidence = SpecificationLearningSystem.getConfidence(
                            newProduct.category,
                            newSpec.name,
                            normalizedValue
                        );
                        
                        if (newConfidence > existingConfidence) {
                            mergedSpecs[existingSpecIndex].value = normalizedValue;
                            SpecificationLearningSystem.learn(
                                newProduct.category,
                                newSpec.name,
                                normalizedValue,
                                true
                            );
                        }
                    }
                });

                // Merge batches intelligently
                const mergedBatches = BatchManager.mergeBatches(
                    existing.batches,
                    newProduct.batches
                );
                
                // Update the product
                inventory[existingIndex] = {
                    ...existing,
                    name: newProduct.name,
                    category: newProduct.category,
                    specifications: mergedSpecs,
                    batches: mergedBatches,
                    lastUpdated: new Date().toISOString()
                };
                stats.updated++;
            }
            
            // Save after each successful merge
            await saveProduct(inventory[existingIndex] || newProduct);
            
        } catch (error) {
            console.error('Error merging product:', error);
            stats.warnings.push({
                product: newProduct.name,
                error: error.message
            });
        }
    }
    
    return stats;
}

// Column Mapping System
const ColumnMappingSystem = {
    patterns: {
        id: {
            exact: ['id', 'productid', 'product_id', 'sku', 'code'],
            contains: ['item_id', 'product_code', 'item_code']
        },
        name: {
            exact: ['name', 'productname', 'product_name', 'title'],
            contains: ['item_name', 'description', 'product_title']
        },
        category: {
            exact: ['category', 'type', 'product_type'],
            contains: ['product_category', 'item_type', 'item_category']
        },
        buyPrice: {
            exact: ['buyprice', 'buy_price', 'cost', 'purchase_price'],
            contains: ['buying_price', 'cost_price', 'purchase_cost']
        },
        sellPrice: {
            exact: ['sellprice', 'sell_price', 'price', 'retail_price'],
            contains: ['selling_price', 'retail', 'sale_price']
        },
        quantity: {
            exact: ['quantity', 'qty', 'stock', 'inventory'],
            contains: ['stock_level', 'inventory_level', 'stock_qty']
        },
        specifications: {
            exact: ['specifications', 'specs', 'features', 'details'],
            contains: ['product_specs', 'technical_specs', 'tech_details']
        }
    },

    // Calculate similarity score between two strings
    calculateSimilarity(str1, str2) {
        const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
        const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (s1 === s2) return 1;
        if (s1.includes(s2) || s2.includes(s1)) return 0.8;
        
        let matches = 0;
        const windowSize = 2;
        const s1Grams = new Set();
        const s2Grams = new Set();
        
        for (let i = 0; i < s1.length - windowSize + 1; i++) {
            s1Grams.add(s1.slice(i, i + windowSize));
        }
        
        for (let i = 0; i < s2.length - windowSize + 1; i++) {
            const gram = s2.slice(i, i + windowSize);
            s2Grams.add(gram);
            if (s1Grams.has(gram)) matches++;
        }
        
        return matches / Math.max(s1Grams.size, s2Grams.size);
    },

    // Find best match for a header
    findBestMatch(header, patterns) {
        let bestScore = 0;
        let bestMatch = null;
        
        const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Check exact matches first
        if (patterns.exact.includes(normalizedHeader)) {
            return { score: 1, match: header };
        }
        
        // Check contains patterns
        for (const pattern of patterns.contains) {
            if (normalizedHeader.includes(pattern.replace(/[^a-z0-9]/g, ''))) {
                return { score: 0.9, match: header };
            }
        }
        
        // Calculate similarity scores
        for (const exact of patterns.exact) {
            const score = this.calculateSimilarity(header, exact);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = header;
            }
        }
        
        for (const contains of patterns.contains) {
            const score = this.calculateSimilarity(header, contains);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = header;
            }
        }
        
        return bestScore > 0.5 ? { score: bestScore, match: bestMatch } : null;
    }
};

// Intelligent Column Mapping Function
function intelligentlyMapColumns(headers) {
    const mapping = {};
    const usedHeaders = new Set();
    
    // First pass: Look for exact and high-confidence matches
    for (const [field, patterns] of Object.entries(ColumnMappingSystem.patterns)) {
        for (const header of headers) {
            if (usedHeaders.has(header)) continue;
            
            const match = ColumnMappingSystem.findBestMatch(header, patterns);
            if (match && match.score > 0.8) {
                mapping[field] = header;
                usedHeaders.add(header);
                break;
            }
        }
    }
    
    // Second pass: Look for lower confidence matches for unmapped fields
    for (const [field, patterns] of Object.entries(ColumnMappingSystem.patterns)) {
        if (mapping[field]) continue;
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const header of headers) {
            if (usedHeaders.has(header)) continue;
            
            const match = ColumnMappingSystem.findBestMatch(header, patterns);
            if (match && match.score > bestScore) {
                bestMatch = header;
                bestScore = match.score;
            }
        }
        
        if (bestMatch && bestScore > 0.5) {
            mapping[field] = bestMatch;
            usedHeaders.add(bestMatch);
        }
    }
    
    // Handle specifications: map remaining headers as potential specifications
    const specHeaders = headers.filter(header => !usedHeaders.has(header));
    if (specHeaders.length > 0) {
        mapping.specifications = specHeaders;
    }
    
    console.log('Column mapping results:', mapping);
    return mapping;
}

// Function to map row data using the column mapping
function mapRowData(row, columnMap) {
    const mappedData = {};
    
    // Map basic fields
    for (const [key, header] of Object.entries(columnMap)) {
        if (key === 'specifications') continue; // Handle specifications separately
        if (header && row[header] !== undefined) {
            mappedData[key] = row[header];
        }
    }
    
    // Extract specifications from unmapped columns and specification columns
    const specifications = [];
    
    // Process specification columns
    if (Array.isArray(columnMap.specifications)) {
        columnMap.specifications.forEach(header => {
            if (row[header] !== undefined && row[header] !== null && row[header] !== '') {
                specifications.push({
                    name: header.toLowerCase()
                        .replace(/[_-]/g, ' ')
                        .replace(/^spec(?:ification)?s?\s*/i, '')
                        .trim(),
                    value: String(row[header]).trim()
                });
            }
        });
    }
    
    // Add specifications to mapped data if any were found
    if (specifications.length > 0) {
        mappedData.specifications = specifications;
    }
    
    return mappedData;
}

// Function to extract and normalize specifications
function extractSpecifications(rowData, category) {
    const specifications = [];
    
    // Handle specifications that are objects or arrays
    if (rowData.Specifications || rowData.specifications) {
        const specs = rowData.Specifications || rowData.specifications;
        
        if (Array.isArray(specs)) {
            // Handle array of specification objects
            specs.forEach(spec => {
                if (spec && typeof spec === 'object') {
                    const name = spec.name || spec.Name;
                    const value = spec.value || spec.Value;
                    if (name && value) {
                        specifications.push({
                            name: name.toLowerCase().trim(),
                            value: SpecificationLearningSystem.normalizeValue(category, name, String(value))
                        });
                    }
                }
            });
        } else if (typeof specs === 'string') {
            // Handle string format (comma-separated or key-value pairs)
            const specPairs = specs.split(',').map(pair => pair.trim());
            specPairs.forEach(pair => {
                if (pair.includes(':')) {
                    const [key, value] = pair.split(':').map(part => part.trim());
                    if (key && value) {
                        specifications.push({
                            name: key.toLowerCase(),
                            value: SpecificationLearningSystem.normalizeValue(category, key, value)
                        });
                    }
                } else if (pair !== '[object Object]') {
                    // Handle simple values if they're not [object Object]
                    specifications.push({
                        name: 'specification',
                        value: SpecificationLearningSystem.normalizeValue(category, 'specification', pair)
                    });
                }
            });
        } else if (typeof specs === 'object' && specs !== null) {
            // Handle single specification object
            Object.entries(specs).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    specifications.push({
                        name: key.toLowerCase().trim(),
                        value: SpecificationLearningSystem.normalizeValue(category, key, String(value))
                    });
                }
            });
        }
    }
    
    // Also check for individual specification columns
    Object.entries(rowData).forEach(([key, value]) => {
        // Skip non-specification fields and empty values
        if (['id', 'Id', 'ID', 'Product ID', 'name', 'Name', 'category', 'Category', 
             'buyPrice', 'BuyPrice', 'Buy Price', 'sellPrice', 'SellPrice', 'Sell Price', 
             'quantity', 'Quantity', 'Specifications', 'specifications'].includes(key)) {
            return;
        }
        if (!value || value === '' || value === '[object Object]') {
            return;
        }

        // Add as specification
        specifications.push({
            name: key.toLowerCase()
                .replace(/[_-]/g, ' ')
                .trim(),
            value: SpecificationLearningSystem.normalizeValue(category, key, String(value))
        });
    });

    // For Desktop category, add default specifications if none are provided
    if (category === 'Desktop' && specifications.length === 0) {
        specifications.push(
            { name: 'processor', value: 'Not specified' },
            { name: 'ram', value: 'Not specified' },
            { name: 'storage', value: 'Not specified' },
            { name: 'graphics', value: 'Not specified' }
        );
    }

    // Validate specifications based on category
    const suggestions = SpecificationLearningSystem.suggestMissingSpecs(category, specifications);
    if (suggestions.length > 0) {
        console.log(`Specification suggestions for ${rowData.name || rowData.Name}:`, suggestions);
    }

    // Remove any duplicate specifications
    const uniqueSpecs = new Map();
    specifications.forEach(spec => {
        const key = spec.name.toLowerCase();
        if (!uniqueSpecs.has(key) || spec.value !== 'Not specified') {
            uniqueSpecs.set(key, spec);
        }
    });

    return Array.from(uniqueSpecs.values());
}

// ... rest of the code ...

// Store inventory data globally

// API Functions
async function loadProducts() {
    try {
        const response = await fetch('../api/inventory.php');
        const data = await response.json();
        if (data.success) {
            inventory = data.inventory || [];
            updateInventoryTable();
            updateReports();
        } else {
            throw new Error(data.message || 'Failed to load products');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('Error loading products: ' + error.message, 'error');
    }
}

// UI Functions
function updateInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('categoryFilter')?.value || '';
    
    // Filter inventory
    const filteredInventory = inventory.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                            product.id.toLowerCase().includes(searchTerm);
        const matchesCategory = !categoryFilter || product.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });
    
    // Clear and rebuild table
    tbody.innerHTML = '';
    filteredInventory.forEach(product => {
        const latestBatch = product.batches?.[0] || {};
        const row = createProductRow(product, latestBatch);
        tbody.appendChild(row);
    });
}

// Update createProductRow function to handle missing product data and use data attributes
function createProductRow(product, batch = {}) {  // Add default empty object
    if (!product || !product.id) {
        console.error("Attempted to create row with invalid product:", product);
        return document.createElement('tr'); // Return empty row to avoid errors
    }

    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    row.setAttribute('data-product-id', product.id);
    
    // Set safe default values for batch properties
    const buyPrice = parseFloat(batch?.buyPrice) || 0;
    const sellPrice = parseFloat(batch?.sellPrice) || 0;
    const stock = parseInt(batch?.remaining) || 0;
    const margin = sellPrice > 0 ? ((sellPrice - buyPrice) / buyPrice * 100).toFixed(2) : '0';
    
    // Create the HTML content with data attributes instead of onclick
    row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.id}</td>
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm text-gray-900">${product.name}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.category}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱${buyPrice.toFixed(2)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₱${sellPrice.toFixed(2)}</td>
        <td class="px-6 py-4 whitespace-nowrap">
            <span class="text-sm ${margin >= 20 ? 'text-green-600' : 'text-yellow-600'}">${margin}%</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 py-1 text-sm rounded-full ${
                stock > 10 ? 'bg-green-100 text-green-800' :
                stock > 0 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
            }">
                ${stock}
            </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            <div class="flex items-center space-x-3">
                <button class="text-green-600 hover:text-green-800 transition-colors purchase-btn" 
                        data-action="recordPurchase" data-product-id="${product.id}"
                        title="Record Purchase">
                    <i class="fas fa-shopping-cart"></i>
                </button>
                <button class="text-blue-600 hover:text-blue-800 transition-colors sale-btn"
                        data-action="recordSale" data-product-id="${product.id}"
                        ${stock === 0 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
                        title="Record Sale">
                    <i class="fas fa-cash-register"></i>
                </button>
                <button class="text-purple-600 hover:text-purple-800 transition-colors batches-btn" 
                        data-action="viewBatches" data-product-id="${product.id}"
                        title="View Batches">
                    <i class="fas fa-layer-group"></i>
                </button>
                <button class="text-yellow-600 hover:text-yellow-800 transition-colors edit-btn" 
                        data-action="editProduct" data-product-id="${product.id}"
                        title="Edit Product">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="text-red-600 hover:text-red-800 transition-colors delete-btn" 
                        data-action="deleteProduct" data-product-id="${product.id}"
                        title="Delete Product">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// Ensure loadProducts correctly initializes the inventory array
async function loadProducts() {
    try {
        const response = await fetch('../api/inventory.php');
        const data = await response.json();
        
        if (data.success) {
            window.inventory = data.inventory || [];
            console.log('Loaded inventory with', window.inventory.length, 'products');
            updateInventoryTable();
            return window.inventory;
        } else {
            throw new Error(data.message || 'Failed to load products');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('Error loading products: ' + error.message, 'error');
        window.inventory = window.inventory || []; // Ensure inventory is at least an empty array
        return [];
    }
}

// Make inventory globally accessible and ensure it's an array
window.inventory = window.inventory || [];

// Make utility functions globally accessible 
window.generateProductId = generateProductId;
window.generateBatchId = generateBatchId;
window.showToast = showToast;
window.loadProducts = loadProducts;
window.updateInventoryTable = updateInventoryTable;

function getStockClass(stock) {
    if (stock > 10) return 'bg-green-100 text-green-800';
    if (stock > 0) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
}

function updateReports() {
    const totalProducts = inventory.length;
    const totalValue = inventory.reduce((sum, product) => {
        const batchValue = (product.batches || []).reduce((batchSum, batch) => 
            batchSum + (batch.remaining * batch.buyPrice), 0);
        return sum + batchValue;
    }, 0);
    const lowStockItems = inventory.filter(product => 
        (product.batches || []).reduce((sum, batch) => sum + batch.remaining, 0) < 5
    ).length;

    document.getElementById('totalProducts').textContent = totalProducts;
    document.getElementById('totalValue').textContent = `₱${totalValue.toFixed(2)}`;
    document.getElementById('lowStockCount').textContent = lowStockItems;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    
    // Search and filter
    document.getElementById('searchInput')?.addEventListener('input', updateInventoryTable);
    document.getElementById('categoryFilter')?.addEventListener('change', updateInventoryTable);
    
    // Navigation
    document.getElementById('mobileMenu')?.addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            document.getElementById('mobileMenu').classList.add('hidden');
        }
    });
});

// Utility Functions
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (toast && toastMessage) {
        const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';
        toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center`;
        toastMessage.textContent = message;
        toast.classList.remove('hidden');
        
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
}

// Export functions for global use
window.showInventory = function() {
    document.getElementById('inventorySection').classList.remove('hidden');
    document.getElementById('addProductSection').classList.add('hidden');
    document.getElementById('reportsSection').classList.add('hidden');
    updateInventoryTable();
};

window.showAddProduct = function() {
    document.getElementById('inventorySection').classList.add('hidden');
    document.getElementById('addProductSection').classList.remove('hidden');
    document.getElementById('reportsSection').classList.add('hidden');
};

window.showReports = function() {
    document.getElementById('inventorySection').classList.add('hidden');
    document.getElementById('addProductSection').classList.add('hidden');
    document.getElementById('reportsSection').classList.remove('hidden');
    updateReports();
};

window.toggleMobileMenu = function() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.toggle('hidden');
    }
};

// Edit Product Handler
window.editProduct = async function(productId) {
    const product = inventory.find(p => p.id === productId);
    if (!product) return;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 class="text-xl font-semibold mb-4">Edit Product: ${product.name}</h3>
            <form id="editProductForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
                    <input type="text" id="editName" value="${product.name}" required
                           class="w-full border border-gray-300 rounded-lg p-2.5">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select id="editCategory" class="w-full border border-gray-300 rounded-lg p-2.5" required>
                        ${generateCategoryOptions(product.category)}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Buy Price</label>
                    <input type="number" id="editBuyPrice" value="${product.batches?.[0]?.buyPrice || 0}" required min="0" step="0.01"
                           class="w-full border border-gray-300 rounded-lg p-2.5">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Sell Price</label>
                    <input type="number" id="editSellPrice" value="${product.batches?.[0]?.sellPrice || 0}" required min="0" step="0.01"
                           class="w-full border border-gray-300 rounded-lg p-2.5">
                </div>
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="this.closest('.fixed').remove()"
                            class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit"
                            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Handle form submission
    document.getElementById('editProductForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const updatedProduct = {
                id: productId,
                name: document.getElementById('editName').value.trim(),
                category: document.getElementById('editCategory').value,
                buyPrice: parseFloat(document.getElementById('editBuyPrice').value),
                sellPrice: parseFloat(document.getElementById('editSellPrice').value)
            };

            const response = await fetch(`../api/products.php?id=${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedProduct)
            });

            const result = await response.json();
            if (result.success) {
                await loadProducts(); // Refresh inventory
                modal.remove();
                showToast('Product updated successfully');
            } else {
                throw new Error(result.message || 'Failed to update product');
            }
        } catch (error) {
            console.error('Error updating product:', error);
            showToast(error.message || 'Error updating product', 'error');
        }
    });
};

// Record Purchase Handler
window.recordPurchase = async function(productId) {
    const product = inventory.find(p => p.id === productId);
    if (!product) return;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 class="text-xl font-semibold mb-4">Record Purchase: ${product.name}</h3>
            <form id="purchaseForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                    <input type="number" id="purchaseQuantity" required min="1"
                           class="w-full border border-gray-300 rounded-lg p-2.5">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Buy Price</label>
                    <input type="number" id="purchaseBuyPrice" required min="0" step="0.01"
                           value="${product.batches?.[0]?.buyPrice || 0}"
                           class="w-full border border-gray-300 rounded-lg p-2.5">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Sell Price</label>
                    <input type="number" id="purchaseSellPrice" required min="0" step="0.01"
                           value="${product.batches?.[0]?.sellPrice || 0}"
                           class="w-full border border-gray-300 rounded-lg p-2.5">
                </div>
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="this.closest('.fixed').remove()"
                            class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit"
                            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Record Purchase
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('purchaseForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const quantity = parseInt(document.getElementById('purchaseQuantity').value);
            const buyPrice = parseFloat(document.getElementById('purchaseBuyPrice').value);
            const sellPrice = parseFloat(document.getElementById('purchaseSellPrice').value);

            const response = await fetch('../api/batches.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    productId: productId,
                    quantity: quantity,
                    buyPrice: buyPrice,
                    sellPrice: sellPrice,
                    batchId: generateBatchId()
                })
            });

            const result = await response.json();
            if (result.success) {
                await loadProducts(); // Refresh inventory
                modal.remove();
                showToast('Purchase recorded successfully');
            } else {
                throw new Error(result.message || 'Failed to record purchase');
            }
        } catch (error) {
            console.error('Error recording purchase:', error);
            showToast(error.message || 'Error recording purchase', 'error');
        }
    });
};

// Record Sale Handler
window.recordSale = async function(productId) {
    const product = inventory.find(p => p.id === productId);
    if (!product) return;

    // Get available batches
    const availableBatches = (product.batches || []).filter(b => b.remaining > 0);
    if (availableBatches.length === 0) {
        showToast('No stock available for sale', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 class="text-xl font-semibold mb-4">Record Sale: ${product.name}</h3>
            <form id="saleForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Batch</label>
                    <select id="saleBatch" required class="w-full border border-gray-300 rounded-lg p-2.5">
                        ${availableBatches.map(batch => `
                            <option value="${batch.batchId}">
                                Batch ${batch.batchId} (${batch.remaining} available) - ₱${batch.sellPrice}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                    <input type="number" id="saleQuantity" required min="1"
                           max="${Math.max(...availableBatches.map(b => b.remaining))}"
                           class="w-full border border-gray-300 rounded-lg p-2.5">
                </div>
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="this.closest('.fixed').remove()"
                            class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit"
                            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Record Sale
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('saleForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        try {
            const batchId = document.getElementById('saleBatch').value;
            const quantity = parseInt(document.getElementById('saleQuantity').value);
            const selectedBatch = availableBatches.find(b => b.batchId === batchId);

            if (quantity > selectedBatch.remaining) {
                throw new Error('Cannot sell more than available stock');
            }

            const response = await fetch('../api/transactions.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    productId: productId,
                    batchId: batchId,
                    quantity: quantity,
                    type: 'sale'
                })
            });

            const result = await response.json();
            if (result.success) {
                await loadProducts(); // Refresh inventory
                modal.remove();
                showToast('Sale recorded successfully');
            } else {
                throw new Error(result.message || 'Failed to record sale');
            }
        } catch (error) {
            console.error('Error recording sale:', error);
            showToast(error.message || 'Error recording sale', 'error');
        }
    });
};

// Helper function to generate category options
function generateCategoryOptions(selectedCategory) {
    const categories = [
        'Desktop', 'Laptop', 'CPU', 'Motherboard', 'RAM', 'Storage',
        'GPU', 'PSU', 'Case', 'Monitor', 'Keyboard', 'Mouse'
    ];
    
    return categories.map(category => `
        <option value="${category}" ${category === selectedCategory ? 'selected' : ''}>
            ${category}
        </option>
    `).join('');
}