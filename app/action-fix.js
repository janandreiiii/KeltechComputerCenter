
/**
 * Direct Action System to ensure all buttons work correctly
 * This provides an additional layer of event handling for all action buttons
 */
(function() {
    console.log("📢 Initializing Action Fix System");
    
    // Direct action functions that bypass wrappers
    window.KCActions = {
        recordPurchase: function(productId) {
            console.log("🔵 Direct recordPurchase action with ID:", productId);
            
            // Try all possible handler methods
            if (window.ModalSystem && typeof window.ActionHandlers?.recordPurchase === 'function') {
                // Preferred method - use ModalSystem with ActionHandlers
                window.ActionHandlers.recordPurchase(productId);
            } else if (typeof window.recordPurchase === 'function') {
                // Fallback to global function
                window.recordPurchase(productId);
            } else if (typeof window.ActionHandlers?.recordPurchase === 'function') {
                // Try ActionHandlers directly
                window.ActionHandlers.recordPurchase(productId);
            } else {
                alert(`Cannot record purchase - handler function not found for product ID: ${productId}`);
                console.error("No handler found for recordPurchase action");
            }
        },
        
        recordSale: function(productId) {
            console.log("🔵 Direct recordSale action with ID:", productId);
            
            if (window.ModalSystem && typeof window.ActionHandlers?.recordSale === 'function') {
                window.ActionHandlers.recordSale(productId);
            } else if (typeof window.recordSale === 'function') {
                window.recordSale(productId);
            } else if (typeof window.ActionHandlers?.recordSale === 'function') {
                window.ActionHandlers.recordSale(productId);
            } else {
                alert(`Cannot record sale - handler function not found for product ID: ${productId}`);
                console.error("No handler found for recordSale action");
            }
        },
        
        viewBatches: function(productId) {
            console.log("🔵 Direct viewBatches action with ID:", productId);
            
            if (window.ModalSystem && typeof window.ActionHandlers?.viewBatches === 'function') {
                window.ActionHandlers.viewBatches(productId);
            } else if (typeof window.viewBatches === 'function') {
                window.viewBatches(productId);
            } else if (typeof window.ActionHandlers?.viewBatches === 'function') {
                window.ActionHandlers.viewBatches(productId);
            } else {
                alert(`Cannot view batches - handler function not found for product ID: ${productId}`);
                console.error("No handler found for viewBatches action");
            }
        },
        
        editProduct: function(productId) {
            console.log("🔵 Direct editProduct action with ID:", productId);
            
            if (window.ModalSystem && typeof window.ActionHandlers?.editProduct === 'function') {
                window.ActionHandlers.editProduct(productId);
            } else if (typeof window.editProduct === 'function') {
                window.editProduct(productId);
            } else if (typeof window.ActionHandlers?.editProduct === 'function') {
                window.ActionHandlers.editProduct(productId);
            } else {
                alert(`Cannot edit product - handler function not found for product ID: ${productId}`);
                console.error("No handler found for editProduct action");
            }
        },
        
        deleteProduct: function(productId) {
            console.log("🔵 Direct deleteProduct action with ID:", productId);
            
            if (window.ModalSystem && typeof window.ActionHandlers?.deleteProduct === 'function') {
                window.ActionHandlers.deleteProduct(productId);
            } else if (typeof window.deleteProduct === 'function') {
                window.deleteProduct(productId);
            } else if (typeof window.ActionHandlers?.deleteProduct === 'function') {
                window.ActionHandlers.deleteProduct(productId);
            } else {
                alert(`Cannot delete product - handler function not found for product ID: ${productId}`);
                console.error("No handler found for deleteProduct action");
            }
        }
    };
    
    // Add global action handler to intercept all button clicks
    document.addEventListener('click', function(e) {
        // Look for buttons with data-action attributes
        const button = e.target.closest('button[data-action]');
        if (button) {
            const action = button.getAttribute('data-action');
            const productId = button.getAttribute('data-product-id');
            
            if (action && productId && window.KCActions[action]) {
                console.log(`🎯 Intercepted ${action} click for product ID: ${productId}`);
                e.preventDefault();
                e.stopPropagation();
                window.KCActions[action](productId);
                return;
            }
        }
        
        // Also intercept traditional onclick handlers
        const actionButton = e.target.closest('button[onclick]');
        if (actionButton) {
            const onclickAttr = actionButton.getAttribute('onclick');
            if (onclickAttr) {
                // Try to extract action and ID from onclick attribute
                const match = onclickAttr.match(/(\w+)\s*\(\s*['"]([^'"]+)['"]\s*\)/);
                if (match && match.length === 3) {
                    const action = match[1];
                    const productId = match[2];
                    
                    if (window.KCActions[action]) {
                        console.log(`🎯 Intercepted onclick ${action} for product ID: ${productId}`);
                        e.preventDefault();
                        e.stopPropagation();
                        window.KCActions[action](productId);
                        return;
                    }
                }
            }
        }
    }, true);
    
    // Fix createProductRow function if it exists
    if (typeof window.createProductRow === 'function') {
        console.log("🔧 Patching createProductRow function");
        const originalCreateProductRow = window.createProductRow;
        
        window.createProductRow = function(product, batch) {
            const row = originalCreateProductRow(product, batch);
            
            // Enhance with data attributes for direct action
            const buttons = row.querySelectorAll('button');
            buttons.forEach(button => {
                const classes = button.className;
                let action = '';
                let productId = product.id;
                
                if (classes.includes('purchase-btn')) action = 'recordPurchase';
                else if (classes.includes('sale-btn')) action = 'recordSale';
                else if (classes.includes('batches-btn')) action = 'viewBatches';
                else if (classes.includes('edit-btn')) action = 'editProduct';
                else if (classes.includes('delete-btn')) action = 'deleteProduct';
                
                if (action) {
                    button.setAttribute('data-action', action);
                    button.setAttribute('data-product-id', productId);
                }
            });
            
            return row;
        };
    }
    
    console.log("✅ Action Fix System Initialized");
})();
