/**
 * Debug utility for Keltech Inventory System
 */
(function() {
    // Debug console styling
    const styles = {
        info: 'background:#2563EB;color:white;padding:2px 5px;border-radius:3px;',
        error: 'background:#DC2626;color:white;padding:2px 5px;border-radius:3px;',
        success: 'background:#059669;color:white;padding:2px 5px;border-radius:3px;',
        warning: 'background:#D97706;color:white;padding:2px 5px;border-radius:3px;'
    };
    
    // Create global debug object
    window.KCDebug = {
        // General log
        log: function(message, data) {
            console.log(`%c KC-DEBUG ${message}`, styles.info, data || '');
        },
        
        // Error log
        error: function(message, error) {
            console.error(`%c KC-ERROR ${message}`, styles.error, error || '');
        },
        
        // Check inventory state
        checkInventory: function() {
            this.log('INVENTORY CHECK');
            if (!window.inventory) {
                this.error('Inventory not defined!');
                return false;
            }
            
            console.log(`Inventory length: ${window.inventory.length}`);
            
            if (window.inventory.length > 0) {
                console.log('First product:', window.inventory[0]);
                console.log('Available IDs:', window.inventory.map(p => p.id));
                return true;
            } else {
                this.warning('Inventory is empty');
                return false;
            }
        },
        
        // Warning log
        warning: function(message, data) {
            console.warn(`%c KC-WARNING ${message}`, styles.warning, data || '');
        },
        
        // Success log
        success: function(message, data) {
            console.log(`%c KC-SUCCESS ${message}`, styles.success, data || '');
        },
        
        // Check if functions exist
        checkFunctions: function() {
            this.log('FUNCTION CHECK');
            
            const functions = [
                'recordPurchase', 'recordSale', 'viewBatches', 
                'editProduct', 'deleteProduct', 'loadProducts',
                'updateInventoryTable'
            ];
            
            const results = {};
            
            functions.forEach(fn => {
                const exists = typeof window[fn] === 'function';
                results[fn] = exists;
                
                if (!exists) {
                    this.error(`Function ${fn} is not defined!`);
                }
            });
            
            console.table(results);
            return Object.values(results).every(v => v === true);
        },
        
        // Run all checks
        runDiagnostics: function() {
            this.log('RUNNING DIAGNOSTICS');
            const inventoryOk = this.checkInventory();
            const functionsOk = this.checkFunctions();
            
            if (inventoryOk && functionsOk) {
                this.success('All checks passed!');
                return true;
            } else {
                this.error('Some checks failed!');
                return false;
            }
        },
        
        // Fix common issues
        fixIssues: function() {
            this.log('ATTEMPTING TO FIX ISSUES');
            
            // Ensure inventory exists
            if (!window.inventory) {
                window.inventory = [];
                this.warning('Created empty inventory array');
            }
            
            // Reload inventory if empty or undefined
            if (!window.inventory.length) {
                this.warning('Trying to reload inventory data...');
                
                fetch('../api/inventory.php')
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            window.inventory = data.inventory;
                            this.success(`Loaded ${data.inventory.length} products`);
                            window.updateInventoryTable?.();
                        } else {
                            this.error('API returned error', data);
                        }
                    })
                    .catch(err => this.error('Failed to reload data', err));
            }
            
            // Make sure ActionHandlers exists
            if (!window.ActionHandlers) {
                window.ActionHandlers = {};
                this.warning('Created empty ActionHandlers object');
            }
            
            // Ensure modal functions can show errors
            if (typeof window.showToast !== 'function') {
                window.showToast = function(message, type='info') {
                    alert(`${type.toUpperCase()}: ${message}`);
                };
                this.warning('Created fallback showToast function');
            }
        },
        
        // Add batch diagnostics method
        diagnoseBatchIssues: function() {
            this.log('BATCH DIAGNOSTICS');
            
            if (!window.inventory) {
                this.error('Inventory not available');
                return false;
            }
            
            let hasIssues = false;
            let batchStats = {
                totalBatches: 0,
                emptyBatches: 0,
                missingFields: 0,
                productsWithoutBatches: 0,
                validBatches: 0
            };
            
            // Check each product's batches
            window.inventory.forEach(product => {
                if (!product.batches || product.batches.length === 0) {
                    console.warn(`Product ${product.name} (${product.id}) has no batches`);
                    batchStats.productsWithoutBatches++;
                    hasIssues = true;
                    return;
                }
                
                // Check each batch
                product.batches.forEach(batch => {
                    batchStats.totalBatches++;
                    
                    // Check for missing fields
                    const requiredFields = ['batchId', 'quantity', 'remaining', 'buyPrice', 'sellPrice', 'dateAdded'];
                    const missingFields = requiredFields.filter(field => batch[field] === undefined);
                    
                    if (missingFields.length > 0) {
                        console.warn(`Batch ${batch.batchId} of ${product.name} is missing fields: ${missingFields.join(', ')}`);
                        batchStats.missingFields++;
                        hasIssues = true;
                    }
                    
                    // Check for zero quantities
                    if (parseInt(batch.quantity) <= 0) {
                        console.warn(`Batch ${batch.batchId} of ${product.name} has zero or negative quantity (${batch.quantity})`);
                        batchStats.emptyBatches++;
                        hasIssues = true;
                    }
                    
                    // Check if remaining exceeds quantity
                    if (parseInt(batch.remaining) > parseInt(batch.quantity)) {
                        console.warn(`Batch ${batch.batchId} of ${product.name} has remaining (${batch.remaining}) > quantity (${batch.quantity})`);
                        hasIssues = true;
                    }
                    
                    if (!missingFields.length && parseInt(batch.quantity) > 0) {
                        batchStats.validBatches++;
                    }
                });
            });
            
            // Output statistics
            console.table(batchStats);
            
            if (hasIssues) {
                this.warning('Batch issues detected - check the console for details');
            } else {
                this.success('All batches look good!');
            }
            
            return !hasIssues;
        },
        
        // Add function to repair common batch issues
        repairBatchIssues: async function() {
            this.log('ATTEMPTING BATCH REPAIRS');
            
            if (!window.inventory) {
                this.error('Inventory not available');
                return false;
            }
            
            let repaired = 0;
            let failed = 0;
            
            for (const product of window.inventory) {
                // Skip products without batches
                if (!product.batches || product.batches.length === 0) continue;
                
                // Fix batch issues
                let needsUpdate = false;
                
                product.batches = product.batches.map(batch => {
                    // Ensure all required fields exist
                    if (!batch.batchId) {
                        batch.batchId = 'BATCH-' + Date.now() + Math.random().toString(36).substr(2, 5);
                        needsUpdate = true;
                    }
                    
                    if (isNaN(parseInt(batch.quantity)) || batch.quantity <= 0) {
                        batch.quantity = batch.remaining > 0 ? batch.remaining : 1;
                        needsUpdate = true;
                    }
                    
                    if (isNaN(parseInt(batch.remaining))) {
                        batch.remaining = batch.quantity;
                        needsUpdate = true;
                    }
                    
                    if (isNaN(parseFloat(batch.buyPrice)) || batch.buyPrice <= 0) {
                        batch.buyPrice = 1;
                        needsUpdate = true;
                    }
                    
                    if (isNaN(parseFloat(batch.sellPrice)) || batch.sellPrice <= 0) {
                        batch.sellPrice = parseFloat(batch.buyPrice) * 1.2; // 20% markup
                        needsUpdate = true;
                    }
                    
                    if (!batch.dateAdded) {
                        batch.dateAdded = new Date().toISOString();
                        needsUpdate = true;
                    }
                    
                    return batch;
                });
                
                // Update if needed
                if (needsUpdate) {
                    try {
                        // Send product update to server
                        const response = await fetch(`../api/products.php?id=${product.id}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(product)
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            repaired++;
                            this.success(`Repaired batches for ${product.name}`);
                        } else {
                            failed++;
                            this.error(`Failed to repair ${product.name}: ${result.message}`);
                        }
                    } catch (err) {
                        failed++;
                        this.error(`Error repairing ${product.name}: ${err.message}`);
                    }
                }
            }
            
            // Output results
            if (repaired > 0) {
                this.success(`Repaired batches for ${repaired} products`);
            }
            if (failed > 0) {
                this.warning(`Failed to repair ${failed} products`);
            }
            if (repaired === 0 && failed === 0) {
                this.log('No batch repairs were needed');
            }
            
            // Reload inventory if any repairs were made
            if (repaired > 0) {
                await window.loadProducts?.();
            }
            
            return repaired > 0 && failed === 0;
        },
        
        // Add batch debugging helper function
        analyzeBatch: function(batchId) {
            this.log('ANALYZING BATCH: ' + batchId);
            
            if (!window.inventory) {
                this.error('Inventory not available');
                return null;
            }
            
            let foundBatch = null;
            let product = null;
            
            for (const p of window.inventory) {
                if (!p.batches) continue;
                
                const batch = p.batches.find(b => 
                    String(b.batchId).toLowerCase() === String(batchId).toLowerCase()
                );
                
                if (batch) {
                    foundBatch = batch;
                    product = p;
                    break;
                }
            }
            
            if (foundBatch) {
                console.log('Found batch:', {
                    batch: foundBatch,
                    product: product,
                    batchId: foundBatch.batchId,
                    productId: product.id,
                    remaining: foundBatch.remaining
                });
            } else {
                this.error('Batch not found in inventory');
            }
            
            return foundBatch;
        },

        // Add function to repair batch IDs
        repairBatchIds: async function() {
            this.log('ATTEMPTING BATCH REPAIRS');
            
            try {
                // First try to fix batch IDs in database
                const response = await fetch('../api/fix-batch-ids.php');
                const result = await response.json();
                
                if (result.success) {
                    this.success(`Fixed ${result.fixed_count} batch IDs`);
                    
                    // Reload inventory to get updated data
                    await window.loadProducts?.();
                    return true;
                } else {
                    this.error('Failed to fix batch IDs:', result.message);
                    return false;
                }
            } catch (error) {
                this.error('Error fixing batch IDs:', error);
                return false;
            }
        }
    };
    
    // Add to runDiagnostics
    const originalRunDiagnostics = window.KCDebug.runDiagnostics;
    window.KCDebug.runDiagnostics = function() {
        const baseResult = originalRunDiagnostics.call(this);
        const batchResult = this.diagnoseBatchIssues();
        return baseResult && batchResult;
    };
    
    // Add shortcut to window object
    window.repairBatches = function() {
        return window.KCDebug.repairBatchIssues();
    };
    
    // Add shortcut to window object
    window.analyzeBatch = function(batchId) {
        return window.KCDebug.analyzeBatch(batchId);
    };
    
    // Run diagnostics on load
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            console.log('');
            console.log('%c KELTECH INVENTORY SYSTEM DIAGNOSTICS ', 
                'background:#374151;color:white;padding:5px;font-size:14px;');
            window.KCDebug.runDiagnostics();
            
            // Attach to window object for console access
            window.runKCDiagnostics = function() {
                window.KCDebug.runDiagnostics();
            };
            
            window.fixKCIssues = function() {
                window.KCDebug.fixIssues();
            };
        }, 1000); // Run after other scripts have loaded
    });
})();
