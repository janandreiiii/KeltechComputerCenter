// Create a global ActionHandlers object to store all the handler functions
window.ActionHandlers = {
    // Add debug helper function
    _debugInventory: function() {
        console.log("DEBUG INVENTORY:");
        console.log("Inventory type:", typeof window.inventory);
        console.log("Inventory length:", window.inventory?.length || 0);
        if (window.inventory?.length > 0) {
            console.log("First product:", window.inventory[0]);
            console.log("Available IDs:", window.inventory.map(p => p.id));
        } else {
            console.log("Inventory is empty or not available");
        }
    },

    // Helper function to find product reliably
    _findProduct: function(productId) {
        // Debug inventory state
        this._debugInventory();
        
        if (!window.inventory || !window.inventory.length) {
            console.error("Inventory not available");
            return null;
        }

        // Try to find the product using loose comparison (== instead of ===)
        // This handles cases where IDs might be stored as strings vs numbers
        const product = window.inventory.find(p => 
            p && (p.id == productId || p.string_id == productId)
        );

        // Log the search results
        if (product) {
            console.log(`Found product with ID ${productId}:`, product);
        } else {
            console.error(`Product with ID ${productId} not found in inventory of ${window.inventory.length} items`);
            
            // Check each product ID to debug
            window.inventory.forEach((p, i) => {
                console.log(`Item ${i}: ID=${p?.id}, type: ${typeof p?.id}, string_id=${p?.string_id}`);
            });
        }
        
        return product;
    },

    // Record Purchase Handler
    recordPurchase: function(productId) {
        console.log("⚠️ recordPurchase handler called with ID:", productId);
        
        // Get product using the reliable method
        const product = this._findProduct(productId);
        
        if (!product) {
            this._showErrorModal(`Product with ID ${productId} not found. Try refreshing the page.`);
            return;
        }

        console.log("Creating modal for product:", product.name);
        
        // Use the modal system instead
        window.ModalSystem.showForm({
            title: `Record Purchase: ${product.name}`,
            fields: [
                {
                    id: 'purchaseQuantity',
                    name: 'quantity',
                    label: 'Quantity',
                    type: 'number',
                    min: 1,
                    required: true
                },
                {
                    id: 'purchaseBuyPrice',
                    name: 'buyPrice',
                    label: 'Buy Price (₱)',
                    type: 'price',
                    value: product.batches?.[0]?.buyPrice || 0,
                    min: 0,
                    step: 0.01,
                    required: true
                },
                {
                    id: 'purchaseSellPrice',
                    name: 'sellPrice',
                    label: 'Sell Price (₱)',
                    type: 'price',
                    value: product.batches?.[0]?.sellPrice || 0,
                    min: 0,
                    step: 0.01,
                    required: true
                }
            ],
            submitText: 'Save Purchase',
            onSubmit: async (formData) => {
                try {
                    const batch = {
                        productId: productId,
                        quantity: parseInt(formData.quantity),
                        buyPrice: parseFloat(formData.buyPrice),
                        sellPrice: parseFloat(formData.sellPrice),
                        dateAdded: new Date().toISOString().slice(0, 19).replace('T', ' ')
                        // Remove batchId - let server generate it
                    };

                    // Log the batch data being sent
                    console.log("Sending batch data to API:", batch);

                    const response = await fetch('../api/batches.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(batch)
                    });

                    if (!response.ok) {
                        let errorMessage = 'Server error';
                        try {
                            const errorData = await response.json();
                            errorMessage = errorData.message || errorMessage;
                        } catch (e) {
                            console.error('Error parsing error response:', e);
                        }
                        throw new Error('Failed to record purchase: ' + errorMessage);
                    }

                    const result = await response.json();
                    if (result.success) {
                        window.showToast?.('Purchase recorded successfully!', 'success') ||
                        alert('Purchase recorded successfully!');
                        window.loadProducts?.() || location.reload();
                        return true;
                    } else {
                        throw new Error(result.message || 'Failed to record purchase');
                    }
                } catch (error) {
                    console.error('Error recording purchase:', error);
                    throw error;
                }
            }
        });
    },

    // Add a method to show error modal with modal system
    _showErrorModal: function(errorMessage) {
        console.error(errorMessage);
        
        window.ModalSystem.alert({
            title: 'Error',
            message: errorMessage
        });
    },

    // Record Sale Handler
    recordSale: function(productId) {
        console.log("⚠️ recordSale handler called with ID:", productId);
        
        const product = this._findProduct(productId);
        
        if (!product) {
            this._showErrorModal(`Product with ID ${productId} not found. Try refreshing the page.`);
            return;
        }

        const availableBatches = (product.batches || []).filter(b => parseInt(b.remaining) > 0);
        if (availableBatches.length === 0) {
            window.showToast?.('No stock available!', 'error') || alert('No stock available!');
            return;
        }

        console.log("Creating sale modal for product:", product.name);
        console.log("Available batches:", availableBatches);

        // Use first batch as default selection
        const defaultBatch = availableBatches[0];
        
        window.ModalSystem.showForm({
            title: `Record Sale: ${product.name}`,
            fields: [
                {
                    id: 'saleBatchSelect',
                    name: 'batchId',
                    label: 'Select Batch',
                    type: 'select',
                    value: defaultBatch.batchId, // Set default value
                    options: availableBatches.map(batch => ({
                        value: batch.batchId,
                        label: `Batch ${batch.batchId} - ${batch.remaining} units at ₱${batch.sellPrice}`
                    })),
                    required: true
                },
                {
                    id: 'saleQuantity',
                    name: 'quantity',
                    label: 'Quantity',
                    type: 'number',
                    min: 1,
                    max: Math.max(...availableBatches.map(b => parseInt(b.remaining) || 0)),
                    required: true,
                    help: 'Make sure to check the available stock in the selected batch.'
                }
            ],
            submitText: 'Record Sale',
            onSubmit: async (formData) => {
                try {
                    const selectedBatch = availableBatches.find(b => 
                        String(b.batchId).toLowerCase() === String(formData.batchId).toLowerCase()
                    );
                    
                    if (!selectedBatch) {
                        throw new Error('Selected batch not found');
                    }

                    // Validate quantity
                    const quantity = parseInt(formData.quantity);
                    if (isNaN(quantity) || quantity <= 0) {
                        throw new Error('Please enter a valid quantity');
                    }

                    if (quantity > selectedBatch.remaining) {
                        throw new Error(`Cannot sell ${quantity} units. Only ${selectedBatch.remaining} available.`);
                    }

                    const transactionData = {
                        productId: productId,
                        batchId: selectedBatch.batchId,
                        quantity: quantity,
                        type: 'sale',
                        price: selectedBatch.sellPrice
                    };

                    console.log("Sending transaction data:", transactionData);

                    const response = await fetch('../api/transactions.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(transactionData)
                    });

                    if (!response.ok) {
                        let errorMessage = 'Server error';
                        try {
                            const errorData = await response.json();
                            errorMessage = errorData.message || errorMessage;
                        } catch (e) {
                            console.error('Error parsing error response:', e);
                        }
                        throw new Error(errorMessage);
                    }

                    const result = await response.json();
                    
                    if (result.success) {
                        window.showToast?.('Sale recorded successfully!', 'success') || 
                        alert('Sale recorded successfully!');
                        window.loadProducts?.() || location.reload();
                        return true;
                    } else {
                        throw new Error(result.message || 'Failed to record sale');
                    }
                } catch (error) {
                    console.error('Error recording sale:', error);
                    throw error;
                }
            }
        });
    },

    // View Batches Handler - update to use modal system
    viewBatches: function(productId) {
        console.log("⚠️ viewBatches handler called with ID:", productId);
        
        const product = this._findProduct(productId);
        
        if (!product) {
            this._showErrorModal(`Product with ID ${productId} not found. Try refreshing the page.`);
            return;
        }

        console.log("Creating batches modal for product:", product.name);
        
        const batchesTable = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch ID</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Added</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Initial Qty</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Buy Price</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sell Price</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${(product.batches || []).map(batch => `
                            <tr>
                                <td class="px-6 py-4 text-sm text-gray-900">${batch.batchId}</td>
                                <td class="px-6 py-4 text-sm text-gray-900">
                                    ${new Date(batch.dateAdded).toLocaleDateString()}
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-900">${batch.quantity}</td>
                                <td class="px-6 py-4 text-sm text-gray-900">${batch.remaining}</td>
                                <td class="px-6 py-4 text-sm text-gray-900">₱${parseFloat(batch.buyPrice).toFixed(2)}</td>
                                <td class="px-6 py-4 text-sm text-gray-900">₱${parseFloat(batch.sellPrice).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        window.ModalSystem.show({
            title: `Batches: ${product.name}`,
            content: batchesTable,
            size: 'lg'
        });
    },

    // Edit Product Handler - update to use modal system
    editProduct: function(productId) {
        console.log("⚠️ editProduct handler called with ID:", productId);
        
        const product = this._findProduct(productId);
        
        if (!product) {
            this._showErrorModal(`Product with ID ${productId} not found. Try refreshing the page.`);
            return;
        }

        console.log("Creating edit modal for product:", product.name);
        
        const categoryOptions = [
            { value: 'CPU', label: 'CPU (Processor)' },
            { value: 'Motherboard', label: 'Motherboard' },
            { value: 'RAM', label: 'RAM (Memory)' },
            { value: 'Storage', label: 'Storage' },
            { value: 'GPU', label: 'Graphics Card' },
            { value: 'PSU', label: 'Power Supply' },
            { value: 'Desktop', label: 'Desktop PC' },
            { value: 'Laptop', label: 'Laptop' }
        ];
        
        window.ModalSystem.showForm({
            title: `Edit Product: ${product.name}`,
            fields: [
                {
                    id: 'editName',
                    name: 'name',
                    label: 'Product Name',
                    value: product.name,
                    required: true
                },
                {
                    id: 'editCategory',
                    name: 'category',
                    label: 'Category',
                    type: 'select',
                    options: categoryOptions,
                    value: product.category,
                    required: true
                }
            ],
            submitText: 'Save Changes',
            onSubmit: async (formData) => {
                try {
                    const updatedProduct = {   
                        id: productId,       
                        name: formData.name,             
                        category: formData.category                  
                    };                        

                    console.log("Updating product:", updatedProduct);                    
                    
                    const response = await fetch(`../api/products.php?id=${productId}`, {            
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updatedProduct)
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                        window.showToast?.('Product updated successfully!', 'success') || 
                        alert('Product updated successfully!');
                        
                        // Refresh inventory data
                        window.loadProducts?.() || location.reload();
                        return true;
                    } else {
                        throw new Error(result.message || 'Failed to update product');
                    }
                } catch (error) {
                    console.error('Error updating product:', error);
                    throw error; // Re-throw to show in form
                }
            }
        });
    },

    // Delete Product Handler - update to use modern confirmation
    deleteProduct: function(productId) {
        console.log("⚠️ deleteProduct handler called with ID:", productId);
        
        window.ModalSystem.confirm({
            title: 'Confirm Deletion',
            message: 'Are you sure you want to delete this product?',
            color: 'red',
            confirmText: 'Delete'
        }).then(confirmed => {
            if (!confirmed) return;
            
            fetch(`../api/products.php?id=${encodeURIComponent(productId)}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json'
                }
            })
            .then(response => response.text())
            .then(text => {
                try {
                    return JSON.parse(text);
                } catch(e) {
                    throw new Error('Invalid JSON response: ' + text);
                }
            })
            .then(data => {
                if (data.success) {
                    if (window.inventory) {
                        window.inventory = window.inventory.filter(p => p.id !== productId);
                    }
                    
                    if (window.updateInventoryTable) {
                        window.updateInventoryTable();
                    } else {
                        const row = document.querySelector(`tr[data-product-id="${productId}"]`);
                        if (row) row.remove();
                    }
                    
                    window.showToast?.('Product deleted successfully', 'success') ||
                    alert('Product deleted successfully');
                } else {
                    throw new Error(data.message || 'Failed to delete product');
                }
            })
            .catch(error => {
                console.error('Error deleting product:', error);
                window.showToast?.(`Failed to delete product: ${error.message}`, 'error') ||
                alert(`Failed to delete product: ${error.message}`);
            });
        });
    }
};

// Add a direct function to reload inventory data
window.reloadInventoryData = async function() {
    try {
        console.log("[RELOAD] Reloading inventory data from server...");
               const response = await fetch('../api/inventory.php');
        const data = await response.json();
        
        if (data.success && Array.isArray(data.inventory)) {
            window.inventory = data.inventory;
            console.log(`✅ Inventory reloaded with ${data.inventory.length} products`);
            
            // Update UI
            if (typeof window.updateInventoryTable === 'function') {
                window.updateInventoryTable();
            }
            return data.inventory;
        } else {
            console.error("Failed to reload inventory:", data);
            return [];
        }
    } catch(error) {
        console.error("Error reloading inventory:", error);
        return [];
    }
};

// Update the batch ID generation function
function generateBatchId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 10);
    return `BATCH-${timestamp}${random}`;
}

window.generateBatchId = generateBatchId;

// Initialize global references to functions
window.recordPurchase = function(productId) {
    console.log("recordPurchase wrapper called with ID:", productId);
    // Try to reload inventory if product not found
    if (!window.inventory || window.inventory.length === 0) {
        window.reloadInventoryData().then(() => {
            window.ActionHandlers.recordPurchase(productId);
        });
    } else {
        window.ActionHandlers.recordPurchase(productId);
    }
};

window.recordSale = function(productId) {
    console.log("recordSale wrapper called with ID:", productId);
    if (!window.inventory || window.inventory.length === 0) {
        window.reloadInventoryData().then(() => {
            window.ActionHandlers.recordSale(productId);
        });
    } else {
        window.ActionHandlers.recordSale(productId);
    }
};

window.viewBatches = function(productId) {
    console.log("viewBatches wrapper called with ID:", productId);
    if (!window.inventory || window.inventory.length === 0) {
        window.reloadInventoryData().then(() => {
            window.ActionHandlers.viewBatches(productId);
        });
    } else {
        window.ActionHandlers.viewBatches(productId);
    }
};

window.editProduct = function(productId) {
    console.log("editProduct wrapper called with ID:", productId);
    if (!window.inventory || window.inventory.length === 0) {
        window.reloadInventoryData().then(() => {
            window.ActionHandlers.editProduct(productId);
        });
    } else {
        window.ActionHandlers.editProduct(productId);
    }
};

window.deleteProduct = function(productId) {
    console.log("deleteProduct wrapper called with ID:", productId);
    if (!window.inventory || window.inventory.length === 0) {
        window.reloadInventoryData().then(() => {
            window.ActionHandlers.deleteProduct(productId);
        });
    } else {
        window.ActionHandlers.deleteProduct(productId);
    }
};

console.log("✅ Action handlers initialized and attached to window object");

// Check inventory on load
document.addEventListener('DOMContentLoaded', function() {
    if (!window.inventory || window.inventory.length === 0) {
        console.warn("⚠️ Inventory not found on page load, attempting to initialize...");
        window.reloadInventoryData();
    } else {
        console.log(`✅ Inventory loaded with ${window.inventory.length} products`);
    }
});
