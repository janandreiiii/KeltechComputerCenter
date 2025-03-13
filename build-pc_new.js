//** Developed by: Jan Andrei Fernando of ITMAWD 12-A (STI College San Fernando, Pampanga) */
//** Developed on: February 6, 2025 */

// State management
let currentBuild = {
    cpu: null,
    motherboard: null,
    ram: null,
    storage: null,
    gpu: null,
    psu: null,
    case: null,
    fans: null,
    cpu_cooler: null,
    monitor: null,
    keyboard: null,
    mouse: null,
    headset: null
};

let inventory = [];

// Stock management constants
const STOCK_STATUS = {
    IN_STOCK: 'in_stock',
    LOW_STOCK: 'low_stock',
    OUT_OF_STOCK: 'out_of_stock'
};

const STOCK_THRESHOLDS = {
    LOW_STOCK: 5  // Consider low stock when 5 or fewer items remain
};


// Calculate available quantity from batches
function calculateAvailableQuantity(product) {
    if (!product.batches || product.batches.length === 0) return 0;
    
    return product.batches.reduce((total, batch) => {
        return total + (parseInt(batch.remaining) || 0);
    }, 0);
}

// Calculate stock status for an item
function calculateStockStatus(product) {
    const quantity = calculateAvailableQuantity(product);
    
    if (quantity <= 0) return STOCK_STATUS.OUT_OF_STOCK;
    if (quantity <= STOCK_THRESHOLDS.LOW_STOCK) return STOCK_STATUS.LOW_STOCK;
    return STOCK_STATUS.IN_STOCK;
}

// Update the loadInventory function with proper data handling
async function loadInventory() {
    try {
        console.log('Starting inventory load...');
        
        const apiUrl = './api/inventory.php'; // Update path to be relative to current page
        console.log('Making API request to:', apiUrl);
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const text = await response.text();
            console.error('API Error Response:', text);
            try {
                const errorData = JSON.parse(text);
                console.error('Parsed error:', errorData);
            } catch (e) {
                console.error('Raw error response:', text);
            }
            throw new Error(`Failed to load inventory: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Received data:', data);

        if (!data.success || !Array.isArray(data.inventory)) {
            console.error('Invalid data format received:', data);
            throw new Error('Invalid inventory data format');
        }

        // Process and normalize inventory data
        inventory = data.inventory.map(product => {
            // Ensure product has required fields
            if (!product || !product.id || !product.name || !product.category) {
                console.error('Invalid product data:', product);
                return null;
            }

            // Normalize batch data
            if (product.batches) {
                product.batches = product.batches.map(batch => ({
                    ...batch,
                    // Normalize sell price field name
                    sellPrice: parseFloat(batch.sellprice || batch.sellPrice || batch.sell_price) || 0,
                    // Normalize remaining stock
                    remaining: parseInt(batch.remaining || batch.quantity || 0)
                }));
            }

            // Add direct price fields if they exist
            if (product.sellprice || product.sellPrice || product.sell_price) {
                product.sellPrice = parseFloat(product.sellprice || product.sellPrice || product.sell_price);
            }

            console.log(`Loaded product: ${product.name} (${product.category})`);
            return product;
        }).filter(Boolean); // Remove null entries

        console.log(`Successfully loaded ${inventory.length} products`);
        return inventory;
        
    } catch (error) {
        console.error('Error loading inventory:', error);
        showToast('Error loading inventory: ' + error.message, 'error');
        return [];
    }
}

// Track the most recently selected component
let lastSelectedComponent = null;

// Function to update component check icons
function updateComponentCheckIcons() {
    const componentCheckDiv = document.getElementById('componentCheck');
    componentCheckDiv.innerHTML = ''; // Clear existing icons

    const icons = {
        cpu: 'fas fa-microchip',
        motherboard: 'fas fa-server',
        ram: 'fas fa-memory',
        storage: 'fas fa-hdd',
        gpu: 'fas fa-tv',
        psu: 'fas fa-bolt',
        case: 'fas fa-computer',
        cpu_cooler: 'fas fa-snowflake',
        fans: 'fas fa-fan',
        monitor: 'fas fa-desktop',
        keyboard: 'fas fa-keyboard',
        mouse: 'fas fa-mouse',
        headset: 'fas fa-headphones'
    };

    if (lastSelectedComponent && currentBuild[lastSelectedComponent]) {
        const iconClass = icons[lastSelectedComponent];
        const iconElement = document.createElement('i');
        iconElement.className = iconClass + ' text-white text-2xl';
        componentCheckDiv.appendChild(iconElement);
    }
}

// Call updateComponentCheckIcons whenever a component is selected
document.querySelectorAll('.custom-select').forEach(select => {
    select.addEventListener('change', () => {
        // Update the currentBuild object based on the selected component
        const component = select.id.replace('Select', '');
        currentBuild[component] = inventory.find(item => item.id === select.value);
        lastSelectedComponent = component; // Update the last selected component
        updateComponentCheckIcons();
        updatePrices(); // Update prices whenever a component is selected
    });
});

// Initialize the component check icons on page load
document.addEventListener('DOMContentLoaded', updateComponentCheckIcons);


// Filter components by category with enhanced logging
function filterComponents(category) {
    console.log(`\n=== Filtering ${category} Components ===`);
    console.log('Current inventory state:', inventory);
    
    if (!category) {
        console.error('No category provided to filterComponents');
        return [];
    }
    
    if (!Array.isArray(inventory)) {
        console.error('Inventory is not an array:', inventory);
        return [];
    }

    if (inventory.length === 0) {
        console.error('Inventory is empty');
        return [];
    }
    
    // Log inventory state for this category
    const categoryItems = inventory.filter(item => {
        if (!item) {
            console.log('Invalid item in inventory:', item);
            return false;
        }
        if (!item.category) {
            console.log('Item missing category:', item);
            return false;
        }
        const matches = item.category.toLowerCase() === category.toLowerCase();
        if (matches) {
            console.log(`Found matching item: ${item.name} (${item.category})`);
        }
        return matches;
    });
    
    console.log(`Found ${categoryItems.length} ${category} items in inventory:`);
    categoryItems.forEach(item => {
        console.log(`\nComponent: ${item.name}`);
        console.log('- Category:', item.category);
        console.log('- Performance Score:', item.performance_score);
        console.log('- ID:', item.id);
        
        if (item.specifications) {
            console.log('- Specifications:');
            item.specifications.forEach(spec => {
                console.log(`  * ${spec.name}: ${spec.value}`);
            });
        }
        
        if (item.batches) {
            console.log('- Batches:');
            item.batches.forEach(batch => {
                console.log(`  * Remaining: ${batch.remaining}, Price: ₱${batch.sellPrice}`);
            });
        }
        
        const price = getBestAvailablePrice(item);
        console.log(`- Best Available Price: ₱${price}`);
    });
    
    // Filter valid components (has valid price and in stock)
    const filtered = categoryItems.filter(item => {
        const price = getBestAvailablePrice(item);
        const stock = calculateAvailableQuantity(item);
        const isValid = price > 0 && stock > 0;
        
        if (!isValid) {
            console.log(`Excluding ${item.name} - ${price <= 0 ? 'Invalid price' : 'Out of stock'} (Price: ₱${price}, Stock: ${stock})`);
        } else {
            console.log(`Including ${item.name} - Price: ₱${price}, Stock: ${stock}`);
        }
        
        return isValid;
    });
    
    console.log(`\nReturning ${filtered.length} valid ${category} components:`, 
        filtered.map(item => `${item.name} (ID: ${item.id})`));
    
    return filtered;
}

// Initialize the PC builder form
async function initializePCBuilder() {
    try {
        console.log('Initializing PC Builder...');
        
        // Load inventory first
        inventory = await loadInventory();
        console.log('Loaded inventory:', inventory);
        
        if (!inventory || inventory.length === 0) {
            console.error('No components found in inventory');
            showToast('No components found in inventory', 'error');
            return;
        }

        // Initialize dropdowns
        const categoryMap = {
            cpuSelect: 'CPU',
            motherboardSelect: 'Motherboard',
            ramSelect: 'RAM',
            storageSelect: 'Storage',
            gpuSelect: 'GPU',
            psuSelect: 'PSU'
        };

        // Populate dropdowns
        for (const [selectId, category] of Object.entries(categoryMap)) {
            populateDropdown(selectId, filterComponents(category), `Select a ${category}`);
        }

        // Add event listeners
        document.querySelectorAll('select').forEach(select => {
            select.addEventListener('change', handleComponentChange);
        });

        // Generate recommended builds after inventory is loaded
        generateRecommendedBuilds();
        
        // Load saved builds and update UI
        loadSavedBuilds();
        updateCompatibilityChecks();
        updatePerformanceMeters();
        updateRecommendations();

        console.log('PC Builder initialization completed');
    } catch (error) {
        console.error('Error initializing PC Builder:', error);
        showToast('Error initializing PC Builder: ' + error.message, 'error');
    }
}

// Update populateDropdown function to ensure options are visible
function populateDropdown(selectId, items, defaultText = 'Select an option') {
    console.log(`\n=== Populating dropdown for ${selectId} ===`);
    
    const select = document.getElementById(selectId);
    if (!select) {
        console.error(`Select element not found: ${selectId}`);
        return;
    }

    console.log(`Initial items count: ${items.length}`);
    
    // Reset select element
    select.style.removeProperty('display');
    select.classList.remove('hidden');
    select.className = 'custom-select w-full p-2 text-white bg-gray-800 bg-opacity-50 rounded-lg border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500';
    
    // Clear existing options
    select.innerHTML = '';
    
    // Create and style the default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = defaultText;
    defaultOption.className = 'bg-gray-900 text-gray-300';
    select.appendChild(defaultOption);

    // Filter and sort items
    let filteredItems = items;
    if (selectId === 'motherboardSelect' && currentBuild.cpu) {
        console.log('Filtering motherboards for CPU compatibility');
        filteredItems = items.filter(item => checkSocketCompatibility(currentBuild.cpu, item));
    } else if (selectId === 'cpuSelect' && currentBuild.motherboard) {
        console.log('Filtering CPUs for motherboard compatibility');
        filteredItems = items.filter(item => checkSocketCompatibility(item, currentBuild.motherboard));
    }

    // Sort items by price
    filteredItems.sort((a, b) => getBestAvailablePrice(a) - getBestAvailablePrice(b));

    console.log(`Filtered items count: ${filteredItems.length}`);

    // Add items to dropdown
    filteredItems.forEach(item => {
        if (!item.id) {
            console.error('Item missing ID:', item);
            return;
        }

        const option = document.createElement('option');
        option.value = item.id;
        
        const price = getBestAvailablePrice(item);
        const stock = calculateAvailableQuantity(item);
        const inStock = stock > 0;
        
        if (inStock) {
            option.textContent = `${item.name} - ₱${price.toLocaleString()}`;
            option.className = 'bg-gray-900 text-white hover:bg-gray-800';
            select.appendChild(option);
        }
        console.log(`Added option: ${item.name} (ID: ${item.id}, Price: ₱${price}, Stock: ${stock})`);
    });

    // Add custom styles for better visibility
    const style = document.createElement('style');
    style.textContent = `
        .custom-select option {
            padding: 8px 12px;
            margin: 4px 0;
        }
        ..custom-select option:checked {
            background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
            color: white;
        }
        .custom-select option:hover {
            background-color: rgba(59, 130, 246, 0.1);
        }
    `;
    document.head.appendChild(style);

    console.log(`Populated ${selectId} with ${filteredItems.length} options`);
}

// Handle component selection change
function handleComponentChange(event) {
    const componentType = event.target.id.replace('Select', '').toLowerCase();
    const selectedId = event.target.value;
    const previousValue = currentBuild[componentType];
    
    // Update current build
    currentBuild[componentType] = selectedId ? inventory.find(item => item.id === selectedId) : null;
    
    // Special handling for CPU and Motherboard compatibility
    if (componentType === 'cpu' && currentBuild.motherboard) {
        // Check if the new CPU is compatible with current motherboard
        if (!checkSocketCompatibility(currentBuild.cpu, currentBuild.motherboard)) {
            showToast('Warning: Selected CPU is not compatible with current motherboard', 'warning');
        }
    } else if (componentType === 'motherboard' && currentBuild.cpu) {
        // Check if the new motherboard is compatible with current CPU
        if (!checkSocketCompatibility(currentBuild.cpu, currentBuild.motherboard)) {
            showToast('Warning: Selected motherboard is not compatible with current CPU', 'warning');
        }
    }
    
    // Check RAM compatibility when changing motherboard
    if (componentType === 'motherboard' && currentBuild.ram) {
        if (!checkRAMCompatibilityWithMotherboard(currentBuild.ram, currentBuild.motherboard)) {
            showToast('Warning: Current RAM is not compatible with selected motherboard', 'warning');
        }
    }
    
    // Update UI
    updatePrices();
    updateCompatibilityChecks();
    updatePerformanceMeters();
    updateRecommendations();
    
    // Show component details with enhanced information
    if (currentBuild[componentType]) {
        showEnhancedComponentDetails(componentType, currentBuild[componentType]);
    }
}

// Function to update prices in the build summary
function updatePrices() {
    let total = 0;

    Object.entries(currentBuild).forEach(([component, product]) => {
        if (!product) return;

        // Use saved price if available, otherwise get best available price
        const price = product.savedPrice || getBestAvailablePrice(product);
        const priceElement = document.getElementById(`${component}Price`);

        if (priceElement) {
            priceElement.textContent = `₱${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        total += price;
    });

    // Update all total price displays
    ['totalPrice', 'totalPriceSummary'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = `₱${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    });
}

// Function to get the best available price from in-stock batches
function getBestAvailablePrice(product) {
    if (!product || !product.batches || product.batches.length === 0) return 0;

    const inStockBatches = product.batches.filter(batch => parseInt(batch.remaining) > 0);
    if (inStockBatches.length === 0) return 0;

    const prices = inStockBatches.map(batch => parseFloat(batch.sellPrice) || 0);
    return Math.min(...prices);
}
    
    console.log(`\nCalculating best price for ${product.name}`);
    console.log('Available batches:', product.batches);
    
    // Filter in-stock batches and ensure proper numeric conversion
    const inStockBatches = product.batches.filter(batch => {
        const remaining = parseInt(batch.remaining) || 0;
        const sellPrice = parseFloat(batch.sellPrice) || 0;
        
        console.log(`Batch - Remaining: ${remaining}, Price: ₱${sellPrice}`);
        
        // Validate reasonable price range (e.g., between 500 and 500,000 pesos)
        if (sellPrice < 500 || sellPrice > 500000) {
            console.log(`Price ₱${sellPrice} outside reasonable range for ${product.name}`);
            return false;
        }
        
        if (remaining <= 0) {
            console.log('Batch out of stock');
            return false;
        }
        
        return true;
    });
    
    if (inStockBatches.length === 0) {
        console.log(`No valid in-stock batches found for ${product.name}`);
        return 0;
    }
    
    // Find the lowest price from available batches
    const prices = inStockBatches.map(batch => {
        const price = parseFloat(batch.sellPrice);
        if (isNaN(price)) {
            console.log(`Invalid price format: ${batch.sellPrice}`);
            return Infinity;
        }
        return price;
    });
    
    const bestPrice = Math.min(...prices);
    console.log(`Best available price for ${product.name}: ₱${bestPrice}`);
    
    return bestPrice;
}

// Update compatibility checks
function updateCompatibilityChecks() {
    const checks = document.getElementById('compatibilityChecks');
    checks.innerHTML = '';

    // CPU and Motherboard compatibility
    if (currentBuild.cpu && currentBuild.motherboard) {
        const compatible = checkSocketCompatibility(currentBuild.cpu, currentBuild.motherboard);
        addCompatibilityCheck(checks, 'CPU and Motherboard socket compatibility', compatible);
    }

    // RAM compatibility
    if (currentBuild.ram && currentBuild.motherboard) {
        const compatible = checkRAMCompatibilityWithMotherboard(currentBuild.ram, currentBuild.motherboard);
        addCompatibilityCheck(checks, 'RAM compatibility with motherboard', compatible);
    }

    // Power supply sufficiency
    if (currentBuild.psu) {
        const sufficient = checkPowerSupplySufficiency();
        addCompatibilityCheck(checks, 'Power supply wattage sufficient', sufficient);
    }
}

// Update performance meters
function updatePerformanceMeters() {
    const performanceTypes = {
        gaming: calculateGamingPerformance(),
        workstation: calculateWorkstationPerformance(),
        efficiency: calculateEfficiencyScore()
    };

    Object.entries(performanceTypes).forEach(([type, score]) => {
        updatePerformanceMeter(type, score);
    });
}

function calculateGamingPerformance() {
    if (!currentBuild.cpu || !currentBuild.gpu) return 0;
    
    const weights = {
        gpu: 0.45,
        cpu: 0.25,
        ram: 0.15,
        storage: 0.15
    };
    
    let score = 0;
    score += (currentBuild.gpu.performance_score || 0) * weights.gpu;
    score += (currentBuild.cpu.performance_score || 0) * weights.cpu;
    
    // Only add RAM and storage scores if they exist
    if (currentBuild.ram) {
        score += calculateRAMScore(currentBuild.ram) * weights.ram / 100;
    }
    if (currentBuild.storage) {
        score += calculateStorageScore(currentBuild.storage) * weights.storage / 100;
    }
    
    return Math.min(100, Math.round(score));
}

function calculateWorkstationPerformance() {
    if (!currentBuild.cpu) return 0;
    
    const weights = {
        cpu: 0.40,
        ram: 0.25,
        storage: 0.20,
        gpu: 0.15
    };
    
    let score = 0;
    score += (currentBuild.cpu.performance_score || 0) * weights.cpu;
    
    // Only add scores for components that exist
    if (currentBuild.ram) {
        score += calculateRAMScore(currentBuild.ram) * weights.ram / 100;
    }
    if (currentBuild.storage) {
        score += calculateStorageScore(currentBuild.storage) * weights.storage / 100;
    }
    if (currentBuild.gpu) {
        score += (currentBuild.gpu.performance_score || 0) * weights.gpu;
    }
    
    return Math.min(100, Math.round(score));
}

function calculateEfficiencyScore() {
    if (!currentBuild.psu) return 0;
    
    let score = 0;
    const totalPower = calculateTotalPowerDraw();
    const psuWattage = getPSUWattage(currentBuild.psu);
    
    // Calculate efficiency based on PSU headroom (ideal is 20-30%)
    const headroomPercentage = ((psuWattage - totalPower) / totalPower) * 100;
    
    if (headroomPercentage >= 20 && headroomPercentage <= 30) {
        score += 50; // Ideal headroom
    } else if (headroomPercentage > 30) {
        score += Math.max(20, 50 - (headroomPercentage - 30)); // Penalize excessive headroom
    } else if (headroomPercentage > 0) {
        score += Math.max(20, 50 * (headroomPercentage / 20)); // Penalize insufficient headroom
    }
    
    // Add points for PSU efficiency rating
    const efficiency = currentBuild.psu.specifications.find(
        s => s.name.toLowerCase().includes('efficiency')
    )?.value?.toLowerCase() || '';
    
    if (efficiency.includes('titanium')) score += 50;
    else if (efficiency.includes('platinum')) score += 40;
    else if (efficiency.includes('gold')) score += 30;
    else if (efficiency.includes('silver')) score += 20;
    else if (efficiency.includes('bronze')) score += 10;
    
    return Math.min(100, score);
}

function updatePerformanceMeter(type, score) {
    const meterFill = document.querySelector(`.meter-fill.${type}`);
    const scoreElement = document.querySelector(`.${type}-score`);
    
    if (meterFill && scoreElement) {
        meterFill.style.width = `${score}%`;
        scoreElement.textContent = `${score}%`;
    }
}

// Number animation helper
function animateNumber(start, end, callback) {
    const duration = 1000;
    const steps = 60;
    const step = (end - start) / steps;
    let current = start;
    let count = 0;
    
    const animation = setInterval(() => {
        count++;
        current += step;
        
        if (count >= steps) {
            clearInterval(animation);
            callback(Math.round(end));
        } else {
            callback(Math.round(current));
        }
    }, duration / steps);
}

// Update build recommendations
function updateRecommendations() {
    const recommendations = document.getElementById('buildRecommendations');
    recommendations.innerHTML = '';

    // Check for missing essential components
    if (!currentBuild.cpu) {
        addRecommendation(recommendations, 'Select a CPU to start your build', 'info');
    }
    if (!currentBuild.motherboard && currentBuild.cpu) {
        addRecommendation(recommendations, 'Select a compatible motherboard', 'info');
    } else if (currentBuild.motherboard && currentBuild.cpu && !checkSocketCompatibility(currentBuild.cpu, currentBuild.motherboard)) {
        addRecommendation(recommendations, 'Warning: CPU and motherboard sockets are not compatible', 'warning');
    }
    if (!currentBuild.ram) {
        addRecommendation(recommendations, 'Add RAM to your build', 'info');
    } else if (currentBuild.ram && currentBuild.motherboard && !checkRAMCompatibilityWithMotherboard(currentBuild.ram, currentBuild.motherboard)) {
        addRecommendation(recommendations, 'Warning: RAM is not compatible with the selected motherboard', 'warning');
    }

    // Performance-based recommendations
    const gamingScore = calculateGamingPerformance();
    const workstationScore = calculateWorkstationPerformance();
    const powerScore = calculateEfficiencyScore();

    if (gamingScore < 60 && currentBuild.gpu) {
        addRecommendation(recommendations, 'Consider a higher-performance GPU for better gaming', 'warning');
    }
    if (workstationScore < 60 && currentBuild.cpu) {
        addRecommendation(recommendations, 'Consider a CPU with more cores for better workstation performance', 'warning');
    }
    if (powerScore < 70) {
        addRecommendation(recommendations, 'Consider a more efficient power supply', 'warning');
    }
}

// Save current build
function saveBuild() {
    if (!validateBuild()) {
        showToast('Please complete your build before saving', 'error');
        return;
    }
    showCustomerInfoModal();
}

// Load saved builds
function loadSavedBuilds() {
    const savedBuildsContainer = document.getElementById('savedBuilds');
    const savedBuilds = JSON.parse(localStorage.getItem('savedBuilds') || '[]');

    if (savedBuilds.length === 0) {
        savedBuildsContainer.innerHTML = `
            <div class="text-center py-12 bg-gray-50 rounded-xl">
                <i class="fas fa-folder-open text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-600">No saved builds yet</p>
            </div>
        `;
        return;
    }

    const buildsGrid = savedBuildsContainer.querySelector('.grid') || savedBuildsContainer;
    buildsGrid.innerHTML = savedBuilds.map((build, index) => `
        <div class="bg-white rounded-xl shadow-sm p-6">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="font-semibold text-lg">Build #${index + 1}</h3>
                    <p class="text-sm text-gray-500">${new Date(build.date).toLocaleDateString()}</p>
                </div>
                <span class="text-lg font-bold text-blue-600">₱${build.totalPrice.toFixed(2)}</span>
            </div>
            <div class="space-y-2 mb-4">
                ${Object.entries(build.components)
                    .map(([type, component]) => `
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-600">${type.toUpperCase()}:</span>
                            <span class="font-medium">${component.name}</span>
                        </div>
                    `).join('')}
            </div>
            <div class="grid grid-cols-3 gap-2 mb-4">
                <div class="text-center">
                    <div class="text-sm font-medium">Gaming</div>
                    <div class="text-lg text-blue-600">${build.performance.gaming}%</div>
                </div>
                <div class="text-center">
                    <div class="text-sm font-medium">Workstation</div>
                    <div class="text-lg text-purple-600">${build.performance.workstation}%</div>
                </div>
                <div class="text-center">
                    <div class="text-sm font-medium">Efficiency</div>
                    <div class="text-lg text-green-600">${build.performance.efficiency}%</div>
                </div>
            </div>
            <div class="flex justify-end space-x-2">
                <button onclick="loadBuild(${index})" 
                        class="text-blue-600 hover:text-blue-800">
                    <i class="fas fa-sync-alt mr-1"></i>Load
                </button>
                <button onclick="deleteBuild(${index})" 
                        class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash mr-1"></i>Delete
                </button>
            </div>
        </div>
    `).join('');
}

// Helper Functions
function generateBuildId() {
    return 'BUILD-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function getLatestPrice(product) {
    if (!product.batches || product.batches.length === 0) return 0;
    const latestBatch = product.batches.reduce((latest, current) => {
        return new Date(current.dateAdded) > new Date(latest.dateAdded) ? current : latest;
    });
    return parseFloat(latestBatch.sellPrice) || 0;
}

function calculateTotalPrice() {
    return Object.values(currentBuild)
        .reduce((total, product) => total + (product ? getLatestPrice(product) : 0), 0);
}

// Helper function to get specification value
function getSpec(component, specName) {
    if (!component || !component.specifications) return '';
    
    const spec = component.specifications.find(s => 
        s.name.toLowerCase().includes(specName.toLowerCase())
    );
    
    return spec ? spec.value : '';
}

// Helper function to get numeric specification value
function getSpecValue(component, specName) {
    if (!component || !component.specifications) return 0;
    
    const spec = component.specifications.find(s => 
        s.name.toLowerCase().includes(specName.toLowerCase())
    );
    
    if (!spec) return 0;
    
    // Try to extract numeric value
    const numericValue = spec.value.replace(/[^\d.]/g, '');
    return parseFloat(numericValue) || 0;
}

// Component Scoring System
const COMPONENT_WEIGHTS = {
    gaming: {
        cpu: 0.25,
        gpu: 0.45,
        ram: 0.20,
        storage: 0.10
    },
    workstation: {
        cpu: 0.35,
        gpu: 0.15,
        ram: 0.30,
        storage: 0.20
    }
};

// Helper functions for component scoring
function getComponentSpecs(component) {
    return component.specifications.reduce((acc, spec) => {
        acc[spec.name.toLowerCase()] = spec.value;
        return acc;
    }, {});
}

function calculateGPUScore(specs) {
    let score = 0;
    
    // VRAM
    const vram = parseInt(specs.vram) || 0;
    score += vram >= 12 ? 100 : vram >= 8 ? 85 : vram >= 6 ? 70 : 50;
    
    // Core Clock
    const coreClock = parseFloat(specs['core clock']) || 0;
    score += coreClock >= 2.0 ? 100 : coreClock >= 1.7 ? 85 : coreClock >= 1.4 ? 70 : 50;
    
    return score / 2;  // Average of all scores
}

function calculateCPUScore(specs) {
    let score = 0;
    
    // Cores
    const cores = parseInt(specs.cores) || 0;
    score += cores >= 8 ? 100 : cores >= 6 ? 85 : cores >= 4 ? 70 : 50;
    
    // Clock Speed
    const clockSpeed = parseFloat(specs['clock speed']) || 0;
    score += clockSpeed >= 4.0 ? 100 : clockSpeed >= 3.5 ? 85 : clockSpeed >= 3.0 ? 70 : 50;
    
    return score / 2;
}

function calculateRAMScore(ram) {
    if (!ram || !ram.specifications) return 0;
    
    let score = 0;
    
    // Get RAM specifications
    const capacity = getSpecValue(ram, 'capacity');
    const speed = getSpecValue(ram, 'speed');
    const type = ram.specifications.find(s => s.name.toLowerCase() === 'type')?.value || '';
    
    // Score based on capacity (max 40 points)
    if (capacity >= 64) score += 40;
    else if (capacity >= 32) score += 30;
    else if (capacity >= 16) score += 20;
    else score += 10;
    
    // Score based on speed (max 30 points)
    if (type.toLowerCase().includes('ddr5')) {
        if (speed >= 6000) score += 30;
        else if (speed >= 5200) score += 25;
        else if (speed >= 4800) score += 20;
        else score += 15;
    } else if (type.toLowerCase().includes('ddr4')) {
        if (speed >= 4000) score += 25;
        else if (speed >= 3600) score += 20;
        else if (speed >= 3200) score += 15;
        else score += 10;
    }
    
    // Score based on type (max 30 points)
    if (type.toLowerCase().includes('ddr5')) score += 30;
    else if (type.toLowerCase().includes('ddr4')) score += 20;
    
    return score;
}

function calculateStorageScore(storage) {
    if (!storage || !storage.specifications) return 0;
    
    let score = 0;
    
    // Get storage specifications
    const capacity = getSpecValue(storage, 'capacity');
    const readSpeed = getSpecValue(storage, 'read speed');
    const type = storage.specifications.find(s => s.name.toLowerCase() === 'type')?.value || '';
    
    // Score based on capacity (max 40 points)
    if (capacity >= 2000) score += 40;
    else if (capacity >= 1000) score += 30;
    else if (capacity >= 500) score += 20;
    else score += 10;
    
    // Score based on read speed (max 30 points)
    if (readSpeed >= 7000) score += 30;
    else if (readSpeed >= 5000) score += 25;
    else if (readSpeed >= 3500) score += 20;
    else if (readSpeed >= 2000) score += 15;
    else score += 10;
    
    // Score based on type (max 30 points)
    if (type.toLowerCase().includes('nvme')) score += 30;
    else if (type.toLowerCase().includes('ssd')) score += 20;
    else if (type.toLowerCase().includes('hdd')) score += 10;
    
    return score;
}

function calculateMotherboardScore(mb) {
    let score = mb.performance_score || 0;
    
    // Add points for features
    if (mb.specifications.some(s => s.value.toLowerCase().includes('wifi'))) score += 10;
    if (mb.specifications.some(s => s.value.toLowerCase().includes('bluetooth'))) score += 5;
    if (mb.specifications.some(s => s.value.toLowerCase().includes('pcie 4.0'))) score += 15;
    if (mb.specifications.some(s => s.value.toLowerCase().includes('pcie 5.0'))) score += 20;
    
    return score;
}

function calculatePSUScore(psu) {
    let score = 0;
    const wattage = getSpecValue(psu, 'wattage');
    const efficiency = psu.specifications.find(s => s.name.toLowerCase().includes('efficiency'))?.value || '';
    
    // Score based on efficiency rating
    if (efficiency.toLowerCase().includes('titanium')) score += 100;
    else if (efficiency.toLowerCase().includes('platinum')) score += 80;
    else if (efficiency.toLowerCase().includes('gold')) score += 60;
    else if (efficiency.toLowerCase().includes('silver')) score += 40;
    else if (efficiency.toLowerCase().includes('bronze')) score += 20;
    
    // Add points for wattage headroom
    score += Math.min(50, (wattage - 500) / 20);
    
    return score;
}

function calculateTotalPowerDraw() {
    return Object.values(currentBuild)
        .reduce((total, component) => {
            if (!component) return total;
            const powerDraw = parseInt(component.power_draw) || 0;
            return total + powerDraw;
        }, 0);
}

function getPSUWattage(psu) {
    if (!psu) return 0;
    const wattageSpec = psu.specifications.find(spec => 
        spec.name.toLowerCase().includes('wattage')
    );
    return wattageSpec ? parseFloat(wattageSpec.value) : 0;
}

// Enhanced socket compatibility check with generation and chipset verification
function checkSocketCompatibility(cpu, mb) {
    if (!cpu || !mb) {
        console.log('Missing CPU or motherboard for socket compatibility check');
        return false;
    }

    const getSpec = (component, name) => {
        const spec = component.specifications.find(
            spec => spec.name.toLowerCase().includes(name.toLowerCase())
        );
        return spec ? spec.value.toLowerCase().trim() : '';
    };

    const cpuSocket = getSpec(cpu, 'socket');
    const mbSocket = getSpec(mb, 'socket');
    const cpuGen = getSpec(cpu, 'generation');
    const mbChipset = getSpec(mb, 'chipset');

    console.log('Compatibility Check Details:', {
        cpu: {
            name: cpu.name,
            socket: cpuSocket,
            generation: cpuGen
        },
        motherboard: {
            name: mb.name,
            socket: mbSocket,
            chipset: mbChipset
        }
    });

    if (!cpuSocket || !mbSocket) {
        console.log('Socket compatibility check failed: Missing socket information');
        return false;
    }

    // Normalize socket names
    const normalizeSocket = (socket) => {
        let normalized = socket.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/^socket/i, '')
            .replace(/^lga/i, 'lga')
            .replace(/^am/i, 'am')
            .replace(/^fm/i, 'fm')
            .replace(/^tr/i, 'tr')
            .replace(/-/g, '')
            .replace(/_/g, '');

        // Handle special cases and aliases
        const socketAliases = {
            'lga1700': ['lga1700', 'socket1700', '1700'],
            'lga1200': ['lga1200', 'socket1200', '1200', 'h410', 'b460', 'z490', 'h470', 'h510', 'b560', 'z590', 'h570'],
            'lga1151': ['lga1151', 'socket1151', '1151', 'h310', 'b360', 'z370', 'h370', 'b365', 'z390', 'h310c'],
            'am4': ['am4', 'socketam4', 'a320', 'b350', 'x370', 'b450', 'x470', 'a520', 'b550', 'x570'],
            'am5': ['am5', 'socketam5', 'b650', 'x670', 'x670e']
        };

        for (const [standard, aliases] of Object.entries(socketAliases)) {
            if (aliases.some(alias => normalized.includes(alias.toLowerCase()))) {
                return standard;
            }
        }

        return normalized;
    };

    const normalizedCPUSocket = normalizeSocket(cpuSocket);
    const normalizedMBSocket = normalizeSocket(mbSocket);

    console.log('Normalized sockets:', {
        cpu: normalizedCPUSocket,
        motherboard: normalizedMBSocket
    });

    // Check socket compatibility
    const isSocketCompatible = normalizedCPUSocket === normalizedMBSocket;

    // Check generation and chipset compatibility
    let isGenerationCompatible = true;
    if (cpuGen && mbChipset) {
        const intelGenerations = {
            '12th': ['z690', 'h670', 'b660', 'h610'],
            '13th': ['z790', 'h770', 'b760', 'z690', 'h670', 'b660', 'h610'],
            '11th': ['z590', 'h570', 'b560', 'h510', 'z490', 'h470', 'b460', 'h410'],
            '10th': ['z490', 'h470', 'b460', 'h410']
        };

        const amdGenerations = {
            'ryzen5000': ['x570', 'b550', 'a520'],
            'ryzen7000': ['x670', 'b650']
        };

        const checkChipsetSupport = (gens, chipset) => {
            const normalizedChipset = chipset.toLowerCase().replace(/\s+/g, '');
            for (const [gen, supportedChipsets] of Object.entries(gens)) {
                if (cpuGen.toLowerCase().includes(gen.toLowerCase()) && 
                    !supportedChipsets.some(c => normalizedChipset.includes(c.toLowerCase()))) {
                    return false;
                }
            }
            return true;
        };

        if (normalizedCPUSocket.includes('lga')) {
            isGenerationCompatible = checkChipsetSupport(intelGenerations, mbChipset);
        } else if (normalizedCPUSocket.includes('am')) {
            isGenerationCompatible = checkChipsetSupport(amdGenerations, mbChipset);
        }
    }

    const isCompatible = isSocketCompatible && isGenerationCompatible;

    console.log('Socket Compatibility Results:', {
        socketCompatible: isSocketCompatible,
        generationCompatible: isGenerationCompatible,
        normalizedCPUSocket,
        normalizedMBSocket,
        finalResult: isCompatible
    });

    return isCompatible;
}

// Enhanced RAM compatibility check with more detailed specifications
function checkRAMCompatibilityWithMotherboard(ram, motherboard) {
    if (!ram || !motherboard) {
        console.log('Missing RAM or motherboard for compatibility check');
        return false;
    }

    const getSpec = (component, name) => {
        const spec = component.specifications.find(
            spec => spec.name.toLowerCase().includes(name.toLowerCase())
        );
        return spec ? spec.value.toLowerCase().trim() : '';
    };

    // Get RAM specifications with detailed logging
    const ram_specs = {
        type: getSpec(ram, 'type'),
        speed: parseInt(getSpec(ram, 'speed').replace(/[^\d]/g, '')),
        capacity: parseInt(getSpec(ram, 'capacity').replace(/[^\d]/g, '')),
        ecc: getSpec(ram, 'ecc').includes('yes'),
        voltage: parseFloat(getSpec(ram, 'voltage')) || 0,
        timing: getSpec(ram, 'timing'),
        format: getSpec(ram, 'form factor')
    };

    // Get motherboard specifications with detailed logging
    const mb_specs = {
        supportedTypes: getSpec(motherboard, 'memory type') || getSpec(motherboard, 'memory support') || getSpec(motherboard, 'ram type'),
        maxSpeed: parseInt(getSpec(motherboard, 'max memory speed').replace(/[^\d]/g, '')),
        maxCapacity: parseInt(getSpec(motherboard, 'max memory').replace(/[^\d]/g, '')),
        eccSupport: getSpec(motherboard, 'ecc support').includes('yes'),
        memorySlots: parseInt(getSpec(motherboard, 'memory slots')) || 0,
        voltageSupport: getSpec(motherboard, 'memory voltage')
    };

    console.log('Detailed RAM Specifications:', {
        ram: {
            name: ram.name,
            rawSpecs: ram.specifications,
            processedSpecs: ram_specs
        },
        motherboard: {
            name: motherboard.name,
            rawSpecs: motherboard.specifications,
            processedSpecs: mb_specs
        }
    });

    // Normalize RAM type
    const normalizeRAMType = (type) => {
        return type.toLowerCase()
            .replace(/\s+/g, '')
            .replace(/^ddr/i, 'ddr')
            .replace(/dimm$/i, '')
            .replace(/-/g, '')
            .replace(/_/g, '')
            .replace(/sodimm/i, '')
            .replace(/udimm/i, '')
            .replace(/rdimm/i, '');
    };

    // Extract DDR version from type string with better pattern matching
    const getDDRVersion = (type) => {
        const ddrPattern = /ddr[0-9]+/i;
        const match = type.match(ddrPattern);
        if (match) {
            return match[0].toLowerCase();
        }
        // Fallback pattern for just the number
        const numberPattern = /\b[345]\b/;
        const numMatch = type.match(numberPattern);
        if (numMatch) {
            return 'ddr' + numMatch[0];
        }
        return '';
    };

    const ramType = normalizeRAMType(ram_specs.type);
    const ramDDRVersion = getDDRVersion(ramType);
    
    // Extract supported DDR versions from motherboard with better pattern matching
    const supportedTypes = mb_specs.supportedTypes.toLowerCase()
        .match(/ddr[0-9]+/gi) || [];
        
    // If no DDR pattern found, try to extract numbers
    if (supportedTypes.length === 0 && mb_specs.supportedTypes) {
        const numbers = mb_specs.supportedTypes.match(/\b[345]\b/g) || [];
        supportedTypes.push(...numbers.map(n => 'ddr' + n));
    }
    
    const supportedDDRVersions = supportedTypes.map(t => getDDRVersion(t));

    console.log('RAM Type Analysis:', {
        originalRamType: ram_specs.type,
        normalizedRamType: ramType,
        extractedDDRVersion: ramDDRVersion,
        motherboardSupportedTypes: mb_specs.supportedTypes,
        extractedSupportedVersions: supportedDDRVersions
    });

    // Check type compatibility
    const isTypeCompatible = supportedDDRVersions.length === 0 || 
        supportedDDRVersions.includes(ramDDRVersion);

    // Parse speed ranges with more flexibility
    const parseSpeedRanges = (speedStr) => {
        const ranges = [];
        const matches = speedStr.toLowerCase().match(/\d+(?:-\d+)?(?:mhz)?/g) || [];
        
        matches.forEach(match => {
            if (match.includes('-')) {
                const [min, max] = match.replace(/mhz/g, '').split('-').map(Number);
                ranges.push([min, max]);
            } else {
                const speed = Number(match.replace(/mhz/g, ''));
                ranges.push([speed, speed]);
            }
        });

        // If no explicit ranges found, use max speed as single range
        if (ranges.length === 0 && mb_specs.maxSpeed) {
            ranges.push([0, mb_specs.maxSpeed]);
        }

        return ranges;
    };

    const speedRanges = parseSpeedRanges(mb_specs.supportedTypes);
    const isSpeedCompatible = speedRanges.length === 0 || 
        speedRanges.some(([min, max]) => ram_specs.speed >= min && ram_specs.speed <= max);

    // Check capacity compatibility
    const isCapacityCompatible = !mb_specs.maxCapacity || ram_specs.capacity <= mb_specs.maxCapacity;

    // Check ECC compatibility
    const isECCCompatible = !ram_specs.ecc || mb_specs.eccSupport;

    // Parse voltage ranges with more flexibility
    const parseVoltageRanges = (voltageStr) => {
        const ranges = [];
        const matches = voltageStr.toLowerCase().match(/[\d.]+(?:-[\d.]+)?v?/g) || [];
        
        matches.forEach(match => {
            if (match.includes('-')) {
                const [min, max] = match.replace(/v/gi, '').split('-').map(Number);
                ranges.push([min, max]);
            } else {
                const voltage = Number(match.replace(/v/gi, ''));
                ranges.push([voltage - 0.1, voltage + 0.1]); // Add small tolerance range
            }
        });

        return ranges;
    };

    const voltageRanges = parseVoltageRanges(mb_specs.voltageSupport);
    const isVoltageCompatible = voltageRanges.length === 0 || 
        voltageRanges.some(([min, max]) => ram_specs.voltage >= min && ram_specs.voltage <= max);

    const compatibilityResults = {
        typeCompatible: isTypeCompatible,
        speedCompatible: isSpeedCompatible,
        capacityCompatible: isCapacityCompatible,
        eccCompatible: isECCCompatible,
        voltageCompatible: isVoltageCompatible
    };

    console.log('RAM Compatibility Results:', {
        ...compatibilityResults,
        details: {
            ramType: ramDDRVersion,
            supportedTypes: supportedDDRVersions,
            ramSpeed: ram_specs.speed,
            speedRanges: speedRanges,
            ramCapacity: ram_specs.capacity,
            maxCapacity: mb_specs.maxCapacity,
            ramVoltage: ram_specs.voltage,
            voltageRanges: voltageRanges
        }
    });

    // Overall compatibility
    const isCompatible = Object.values(compatibilityResults).every(result => result);

    // Generate detailed compatibility message
    if (!isCompatible) {
        const issues = [];
        if (!isTypeCompatible) {
            issues.push(`RAM type ${ramDDRVersion.toUpperCase()} not supported by motherboard (supports: ${supportedDDRVersions.map(t => t.toUpperCase()).join(', ')})`);
        }
        if (!isSpeedCompatible) {
            const supportedSpeedsText = speedRanges.map(([min, max]) => 
                min === max ? `${min}MHz` : `${min}-${max}MHz`
            ).join(', ');
            issues.push(`RAM speed ${ram_specs.speed}MHz not supported (supported speeds: ${supportedSpeedsText})`);
        }
        if (!isCapacityCompatible) {
            issues.push(`RAM capacity ${ram_specs.capacity}GB exceeds maximum supported capacity of ${mb_specs.maxCapacity}GB`);
        }
        if (!isECCCompatible) {
            issues.push('ECC RAM not supported by this motherboard');
        }
        if (!isVoltageCompatible) {
            const supportedVoltagesText = voltageRanges.map(([min, max]) => 
                `${min.toFixed(2)}-${max.toFixed(2)}V`
            ).join(', ');
            issues.push(`RAM voltage ${ram_specs.voltage}V not supported (supported voltages: ${supportedVoltagesText})`);
        }
        
        console.log('Compatibility Issues:', issues);
        showToast('RAM Compatibility Issues:\n' + issues.join('\n'), 'warning', 5000);
    }
    
    return isCompatible;
}

// Add power supply compatibility check
function checkPowerSupplySufficiency() {
    if (!currentBuild.psu) return false;

    // Calculate total power draw from all components
    const totalPowerDraw = Object.values(currentBuild)
        .reduce((total, component) => {
            if (!component) return total;
            const powerDraw = parseInt(component.power_draw) || 0;
            return total + powerDraw;
        }, 0);

    // Get PSU wattage
    const psuWattage = parseInt(
        currentBuild.psu.specifications.find(
            spec => spec.name.toLowerCase().includes('wattage')
        )?.value || '0'
    );

    // Add 20% headroom for safety
    const requiredWattage = Math.ceil(totalPowerDraw * 1.2);

    console.log(`Power Supply Check:
        Total Power Draw: ${totalPowerDraw}W
        Required (with 20% headroom): ${requiredWattage}W
        PSU Wattage: ${psuWattage}W`);

    return psuWattage >= requiredWattage;
}

// Function to show the customer information modal
function showCustomerInfoModal() {
    // Calculate build summary first
    const buildSummary = generateBuildSummary();
    const totalPrice = calculateTotalPrice();

    // Create modal HTML
    const modalHTML = `
        <div id="customerInfoModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-gray-900 p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4">
                <h2 class="text-2xl font-bold text-white mb-4">Save Your Build</h2>
                
                <!-- Customer Information Form -->
                <form id="customerInfoForm" class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-gray-300 mb-2">Customer Name *</label>
                            <input type="text" id="customerName" required
                                class="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-gray-300 mb-2">Contact Number *</label>
                            <input type="tel" id="contactNumber" required
                                class="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-gray-300 mb-2">Email Address *</label>
                            <input type="email" id="emailAddress" required
                                class="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-gray-300 mb-2">Address *</label>
                            <input type="text" id="address" required
                                class="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500">
                        </div>
                    </div>

                    <!-- Build Summary -->
                    <div class="mt-6">
                        <h3 class="text-xl font-semibold text-white mb-3">Build Summary</h3>
                        <div class="bg-gray-800 p-4 rounded-lg">
                            ${buildSummary}
                            <div class="mt-4 pt-4 border-t border-gray-700">
                                <div class="text-xl font-bold text-white">
                                    Total: ₱${totalPrice.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Buttons -->
                    <div class="flex justify-end space-x-4 mt-6">
                        <button type="button" onclick="closeCustomerInfoModal()"
                            class="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">
                            Cancel
                        </button>
                        <button type="submit"
                            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500">
                            Save Build
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Add modal to document
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add form submit handler
    document.getElementById('customerInfoForm').addEventListener('submit', handleCustomerInfoSubmit);
}

// Function to generate build summary HTML
function generateBuildSummary() {
    return Object.entries(currentBuild)
        .map(([type, component]) => {
            if (!component) return '';
            const price = getBestAvailablePrice(component);
            return `
                <div class="flex justify-between items-center py-2">
                    <div class="text-gray-300">
                        <div class="font-semibold">${type.toUpperCase()}</div>
                        <div class="text-sm text-gray-400">${component.name}</div>
                    </div>
                    <div class="text-white">₱${price.toLocaleString()}</div>
                </div>
            `;
        })
        .join('');
}

// Function to handle form submission
async function handleCustomerInfoSubmit(event) {
    event.preventDefault();

    const customerData = {
        name: document.getElementById('customerName').value,
        contact: document.getElementById('contactNumber').value,
        email: document.getElementById('emailAddress').value,
        address: document.getElementById('address').value,
        build: currentBuild,
        total_price: calculateTotalPrice(),
        date_created: new Date().toISOString()
    };

    try {
        const response = await fetch('/api/save-customer-build.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(customerData)
        });

        if (!response.ok) {
            throw new Error('Failed to save build');
        }

        const result = await response.json();
        
        if (result.success) {
            showToast('Build saved successfully!', 'success');
            closeCustomerInfoModal();
            showBuildSavedSuccess(
                customerData.name, 
                result.data.build_id,
                result.data.tracking_id
            );
        } else {
            throw new Error(result.message || 'Failed to save build');
        }
    } catch (error) {
        console.error('Error saving build:', error);
        showToast('Error saving build: ' + error.message, 'error');
    }
}

// Function to close the modal
function closeCustomerInfoModal() {
    const modal = document.getElementById('customerInfoModal');
    if (modal) {
        modal.remove();
    }
}

// Add this function to validate the build before saving
function validateBuild() {
    // Check if all required components are selected
    const requiredComponents = ['cpu', 'motherboard', 'ram', 'storage', 'psu'];
    const missingComponents = requiredComponents.filter(type => !currentBuild[type]);
    
    if (missingComponents.length > 0) {
        showToast(`Please select ${missingComponents.join(', ')} before saving`, 'error');
        return false;
    }

    // Check compatibility
    if (!checkSocketCompatibility(currentBuild.cpu, currentBuild.motherboard)) {
        showToast('CPU and motherboard are not compatible', 'error');
        return false;
    }

    if (!checkRAMCompatibilityWithMotherboard(currentBuild.ram, currentBuild.motherboard)) {
        showToast('RAM is not compatible with motherboard', 'error');
        return false;
    }

    if (!checkPowerSupplySufficiency()) {
        showToast('Power supply is insufficient for this build', 'error');
        return false;
    }

    return true;
}

// Update the showBuildSavedSuccess function
function showBuildSavedSuccess(customerName, buildId, trackingId) {
    const message = `
        <div class="flex flex-col items-center p-4">
            <i class="fas fa-check-circle text-green-500 text-4xl"></i>
            <h3 class="text-lg font-bold mt-3 mb-2 text-white">Build Saved Successfully!</h3>
            <p class="text-sm text-gray-300 mb-4">Thank you, ${customerName}!</p>
            <div class="w-full p-4 bg-gray-800 rounded-lg">
                <p class="text-sm text-gray-400 mb-2 text-center">Your Tracking ID:</p>
                <p class="text-xl font-mono font-bold text-blue-400 text-center select-all">${trackingId}</p>
                <p class="text-xs text-gray-500 mt-2 text-center">Keep this ID for future reference</p>
            </div>
        </div>
    `;
    
    // Create and style the toast container
    const toast = document.getElementById('toast');
    toast.className = 'fixed bottom-4 right-4 toast z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl';
    
    // Set the message and show for longer duration
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.innerHTML = message;
    toastMessage.className = 'min-w-[300px]';
    
    // Show toast
    toast.classList.remove('hidden');
    
    // Hide toast after longer duration
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 10000); // Show for 10 seconds
}

// Function to add a compatibility check to the UI
function addCompatibilityCheck(container, message, isCompatible) {
    const icon = isCompatible ? 'check-circle' : 'exclamation-triangle';
    const color = isCompatible ? 'text-green-500' : 'text-yellow-500';
    const status = isCompatible ? 'Compatible' : 'Warning';
    
    container.insertAdjacentHTML('beforeend', `
        <div class="flex items-center space-x-3">
            <i class="fas fa-${icon} ${color} text-lg"></i>
            <div>
                <div class="text-sm font-medium ${color}">${status}</div>
                <div class="text-xs text-gray-400">${message}</div>
            </div>
        </div>
    `);
}

// Function to show toast notifications
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    // Set toast color based on type
    const colors = {
        success: 'border-green-500',
        error: 'border-red-500',
        warning: 'border-yellow-500',
        info: 'border-blue-500'
    };
    
    // Remove existing color classes and add new one
    toast.className = 'fixed bottom-4 right-4 toast z-50 border-l-4 ' + colors[type];
    
    // Set message
    if (typeof message === 'string') {
        toastMessage.textContent = message;
    } else {
        toastMessage.innerHTML = message; // For HTML content
    }
    
    // Show toast
    toast.classList.remove('hidden');
    
    // Hide toast after duration
    setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
}

// Function to generate recommended builds
function generateRecommendedBuilds() {
    const recommendations = document.getElementById('buildRecommendations');
    if (!recommendations) return;

    // Clear existing recommendations
    recommendations.innerHTML = '';

    // Define build templates
    const buildTemplates = {
        gaming: {
            title: 'Gaming Build',
            icon: 'gamepad',
            color: 'blue',
            filter: (item) => {
                if (item.category === 'GPU') {
                    return item.performance_score >= 80;
                }
                if (item.category === 'CPU') {
                    return item.performance_score >= 70;
                }
                if (item.category === 'RAM') {
                    const capacity = parseInt(getSpec(item, 'capacity')) || 0;
                    return capacity >= 16;
                }
                return true;
            }
        },
        workstation: {
            title: 'Workstation Build',
            icon: 'laptop-code',
            color: 'purple',
            filter: (item) => {
                if (item.category === 'CPU') {
                    return item.performance_score >= 85;
                }
                if (item.category === 'RAM') {
                    const capacity = parseInt(getSpec(item, 'capacity')) || 0;
                    return capacity >= 32;
                }
                if (item.category === 'Storage') {
                    const capacity = parseInt(getSpec(item, 'capacity')) || 0;
                    return capacity >= 1000;
                }
                return true;
            }
        },
        budget: {
            title: 'Budget Build',
            icon: 'piggy-bank',
            color: 'green',
            filter: (item) => {
                const price = getBestAvailablePrice(item);
                if (item.category === 'GPU') {
                    return price < 20000 && item.performance_score >= 60;
                }
                if (item.category === 'CPU') {
                    return price < 15000 && item.performance_score >= 50;
                }
                return true;
            }
        }
    };

    // Generate recommendations for each template
    Object.entries(buildTemplates).forEach(([key, template]) => {
        // Filter components based on template criteria
        const filteredComponents = {};
        Object.entries({
            CPU: filterComponents('CPU'),
            GPU: filterComponents('GPU'),
            RAM: filterComponents('RAM'),
            Storage: filterComponents('Storage'),
            Motherboard: filterComponents('Motherboard'),
            PSU: filterComponents('PSU')
        }).forEach(([category, items]) => {
            filteredComponents[category] = items.filter(template.filter)
                .sort((a, b) => getBestAvailablePrice(a) - getBestAvailablePrice(b));
        });

        // Create recommendation card
        const card = document.createElement('div');
        card.className = 'bg-gray-800 rounded-lg p-4 mb-4';
        card.innerHTML = `
            <div class="flex items-center mb-3">
                <i class="fas fa-${template.icon} text-${template.color}-500 text-lg mr-2"></i>
                <h4 class="text-lg font-semibold text-white">${template.title}</h4>
            </div>
            <div class="space-y-2">
                ${Object.entries(filteredComponents).map(([category, items]) => {
                    const recommended = items[0];
                    if (!recommended) return '';
                    const price = getBestAvailablePrice(recommended);
                    return `
                        <div class="flex justify-between items-center text-sm">
                            <span class="text-gray-400">${category}</span>
                            <span class="text-gray-300">${recommended.name}</span>
                            <span class="text-${template.color}-500">₱${price.toLocaleString()}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        recommendations.appendChild(card);
    });
}

// Function to apply a recommended build
function applyRecommendedBuild(templateKey) {
    // Implementation will depend on your specific needs
    showToast('This feature is coming soon!', 'info');
}

// Function to add a recommendation message to the UI
function addRecommendation(container, message, type = 'info') {
    const icons = {
        info: 'info-circle',
        warning: 'exclamation-triangle',
        success: 'check-circle'
    };
    
    const colors = {
        info: 'blue',
        warning: 'yellow',
        success: 'green'
    };
    
    container.insertAdjacentHTML('beforeend', `
        <div class="flex items-center p-3 bg-gray-700 bg-opacity-50 rounded-lg mb-3">
            <i class="fas fa-${icons[type]} text-${colors[type]}-500 text-lg mr-3"></i>
            <div class="flex-1">
                <div class="text-sm text-gray-200">${message}</div>
            </div>
        </div>
    `);
}

// Function to show enhanced component details
function showEnhancedComponentDetails(componentType, component) {
    if (!component) return;
    
    console.log(`\n=== ${componentType.toUpperCase()} Details ===`);
    console.log('Name:', component.name);
    console.log('Category:', component.category);
    console.log('Performance Score:', component.performance_score);
    
    if (component.specifications) {
        console.log('\nSpecifications:');
        component.specifications.forEach(spec => {
            console.log(`- ${spec.name}: ${spec.value}`);
        });
    }
    
    const price = getBestAvailablePrice(component);
    console.log('\nPrice:', `₱${price.toLocaleString()}`);
    
    const stock = calculateAvailableQuantity(component);
    console.log('Available Stock:', stock);
}

// Function to search for a build by tracking number
async function searchBuildByTracking() {
    const trackingId = document.getElementById('trackingSearch').value.trim();
    const searchButton = document.querySelector('[onclick="searchBuildByTracking()"]');
    
    if (!trackingId) {
        showToast('Please enter a tracking number', 'warning');
        return;
    }

    try {
        // Show loading state
        searchButton.disabled = true;
        searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        const response = await fetch(`/api/get-build.php?tracking_id=${encodeURIComponent(trackingId)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        const result = await response.json();
        console.log('API Response:', result);
        
        if (!response.ok) {
            throw new Error(result.message || 'Failed to fetch build data');
        }
        
        if (result.success && result.data) {
            // Handle both build and build_data formats
            let buildData = result.data;
            
            // If build_data is not present but build is, use build as build_data
            if (!buildData.build_data && buildData.build) {
                buildData.build_data = buildData.build;
            }

            // Validate the build data structure
            if (!buildData.build_data) {
                console.error('Missing build data in response:', buildData);
                throw new Error('Invalid build data structure received from server');
            }

            // Parse build_data if it's a string
            if (typeof buildData.build_data === 'string') {
                try {
                    buildData.build_data = JSON.parse(buildData.build_data);
                } catch (e) {
                    console.error('Failed to parse build_data:', e);
                    throw new Error('Invalid build data format received from server');
                }
            }

            // Validate the parsed build data
            if (!buildData.build_data || typeof buildData.build_data !== 'object') {
                console.error('Invalid build_data format after parsing:', buildData.build_data);
                throw new Error('Invalid build data format');
            }

            console.log('Processed build data:', buildData);
            showBuildDetails(buildData);
            document.getElementById('trackingSearch').value = '';
        } else {
            throw new Error(result.message || 'No build found with this tracking number');
        }
    } catch (error) {
        console.error('Error searching build:', error);
        showToast(error.message || 'Error searching for build', 'error');
    } finally {
        // Reset button state
        searchButton.disabled = false;
        searchButton.innerHTML = '<i class="fas fa-search"></i>';
    }
}

// Function to display build details in a modal
function showBuildDetails(buildData) {
    if (!buildData || !buildData.build_data) {
        showToast('Invalid build data received', 'error');
        return;
    }

    // Parse build_data if it's a string
    const build_data = typeof buildData.build_data === 'string' 
        ? JSON.parse(buildData.build_data) 
        : buildData.build_data;

    // Create modal HTML with Load Build button
    const modalHTML = `
        <div id="buildDetailsModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 backdrop-blur-sm transition-opacity duration-300">
            <div class="fixed inset-0 overflow-y-auto">
                <div class="flex min-h-full items-center justify-center p-4">
                    <div class="w-full max-w-2xl bg-gray-900 shadow-2xl rounded-lg relative scale-95 opacity-0" 
                         id="modalContent">
                        <!-- Header -->
                        <div class="bg-gray-900 rounded-t-lg border-b border-gray-800">
                            <div class="p-4">
                                <div class="flex justify-between items-start">
                                    <div class="pr-4">
                                        <h2 class="text-xl font-bold text-white">Build Details</h2>
                                        <div class="flex flex-wrap items-center mt-2 gap-2">
                                            <span class="text-xs text-gray-400">Tracking ID:</span>
                                            <code class="text-xs bg-gray-800 px-2 py-1 rounded text-blue-400 font-mono select-all">
                                                ${buildData.tracking_id || 'N/A'}
                                            </code>
                                        </div>
                                    </div>
                                    <button onclick="closeBuildDetailsModal()" 
                                            class="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors 
                                                   focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation">
                                        <i class="fas fa-times text-xl"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Scrollable Content -->
                        <div class="overflow-y-auto" style="max-height: calc(100vh - 16rem);">
                            <div class="p-4 space-y-4">
                                <!-- Customer Information -->
                                <div class="bg-gray-800 rounded-lg overflow-hidden">
                                    <div class="px-4 py-3 bg-gray-700 bg-opacity-50">
                                        <h3 class="text-base font-semibold text-white flex items-center">
                                            <i class="fas fa-user-circle mr-2 text-blue-400"></i>
                                            Customer Information
                                        </h3>
                                    </div>
                                    <div class="p-4">
                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div class="p-3 bg-gray-700 bg-opacity-30 rounded-lg">
                                                <p class="text-xs text-gray-400 flex items-center">
                                                    <i class="fas fa-user mr-1 opacity-70"></i> Name
                                                </p>
                                                <p class="text-sm text-white font-medium mt-1">${buildData.customer?.name || 'N/A'}</p>
                                            </div>
                                            <div class="p-3 bg-gray-700 bg-opacity-30 rounded-lg">
                                                <p class="text-xs text-gray-400 flex items-center">
                                                    <i class="fas fa-phone mr-1 opacity-70"></i> Contact
                                                </p>
                                                <p class="text-sm text-white font-medium mt-1">${buildData.customer?.contact || 'N/A'}</p>
                                            </div>
                                            <div class="p-3 bg-gray-700 bg-opacity-30 rounded-lg">
                                                <p class="text-xs text-gray-400 flex items-center">
                                                    <i class="fas fa-envelope mr-1 opacity-70"></i> Email
                                                </p>
                                                <p class="text-sm text-white font-medium mt-1 break-all">${buildData.customer?.email || 'N/A'}</p>
                                            </div>
                                            <div class="p-3 bg-gray-700 bg-opacity-30 rounded-lg">
                                                <p class="text-xs text-gray-400 flex items-center">
                                                    <i class="fas fa-calendar mr-1 opacity-70"></i> Date Created
                                                </p>
                                                <p class="text-sm text-white font-medium mt-1">
                                                    ${buildData.date_created ? new Date(buildData.date_created).toLocaleDateString() : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Build Components -->
                                <div class="bg-gray-800 rounded-lg overflow-hidden">
                                    <div class="px-4 py-3 bg-gray-700 bg-opacity-50">
                                        <h3 class="text-base font-semibold text-white flex items-center">
                                            <i class="fas fa-microchip mr-2 text-blue-400"></i>
                                            Components
                                        </h3>
                                    </div>
                                    <div class="p-4">
                                        <div class="space-y-3">
                                            ${Object.entries(build_data || {}).map(([type, component]) => {
                                                if (!component) return '';
                                                const price = component.price || 0;
                                                return `
                                                    <div class="p-3 bg-gray-700 bg-opacity-30 rounded-lg">
                                                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                                            <div class="flex-1 min-w-0">
                                                                <p class="text-xs text-gray-400 flex items-center">
                                                                    <i class="fas fa-${getComponentIcon(type)} mr-1 opacity-70"></i>
                                                                    ${type.toUpperCase()}
                                                                </p>
                                                                <p class="text-sm text-white font-medium mt-1 truncate">
                                                                    ${component.name || 'N/A'}
                                                                </p>
                                                            </div>
                                                            <div class="flex items-center bg-gray-800 px-3 py-1.5 rounded-lg self-start sm:self-center">
                                                            </div>
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                </div>

                                <!-- Total Price -->
                                <div class="bg-gray-800 rounded-lg overflow-hidden">
                                    <div class="p-4">
                                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                            <h3 class="text-base font-semibold text-white flex items-center">
                                                <i class="fas fa-tags mr-2 text-blue-400"></i>
                                                Total Price
                                            </h3>
                                            <div class="flex items-center bg-blue-500 bg-opacity-20 px-4 py-2 rounded-lg self-stretch sm:self-auto">
                                                <p class="text-lg font-bold text-blue-400">
                                                    ₱${(buildData.total_price || 0).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div class="bg-gray-900 rounded-b-lg border-t border-gray-800">
                            <div class="p-4">
                                <button onclick='loadBuildFromTracking(${JSON.stringify(buildData).replace(/'/g, "\\'")})'
                                        class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 
                                               transition-colors text-sm font-medium flex items-center justify-center
                                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
                                               touch-manipulation">
                                    <i class="fas fa-sync-alt mr-2"></i>
                                    <span>Load Build</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add modal to document
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';

    // Add click outside to close
    const modal = document.getElementById('buildDetailsModal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeBuildDetailsModal();
        }
    });

    // Trigger animation after a small delay
    setTimeout(() => {
        const content = document.getElementById('modalContent');
        if (content) {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
            content.style.transition = 'all 0.3s ease-out';
        }
    }, 50);
}

// Function to close the build details modal with animation
function closeBuildDetailsModal() {
    const modal = document.getElementById('buildDetailsModal');
    const content = document.getElementById('modalContent');
    
    if (modal && content) {
        // Add closing animation
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        modal.style.opacity = '0';
        
        // Remove modal after animation
        setTimeout(() => {
            modal.remove();
            // Restore body scrolling
            document.body.style.overflow = '';
        }, 300);
    }
}

// Helper function to get component icon
function getComponentIcon(type) {
    const icons = {
        cpu: 'microchip',
        motherboard: 'server',
        ram: 'memory',
        storage: 'hdd',
        gpu: 'tv',
        psu: 'plug',
        case: 'computer',
        fans: 'fan',
        cpu_cooler: 'snowflake',
        monitor: 'desktop',
        keyboard: 'keyboard',
        mouse: 'mouse',
        headset: 'headphones'
    };
    return icons[type.toLowerCase()] || 'cube';
}

// Function to load a build from tracking data
async function loadBuildFromTracking(buildData) {
    try {
        console.log('Loading build data:', buildData);

        // Reset current selections
        document.querySelectorAll('select').forEach(select => {
            select.value = '';
        });

        // Reset current build
        currentBuild = {
            cpu: null,
            motherboard: null,
            ram: null,
            storage: null,
            gpu: null,
            psu: null,
            case: null,
            fans: null,
            cpu_cooler: null,
            monitor: null,
            keyboard: null,
            mouse: null,
            headset: null
        };

        // Load each component from build_data
        const components = ['cpu', 'motherboard', 'ram', 'storage', 'gpu', 'psu'];
        const build_data = typeof buildData.build_data === 'string' 
            ? JSON.parse(buildData.build_data) 
            : buildData.build_data;
        
        let priceUpdates = [];
        
        for (const type of components) {
            const component = build_data[type];
            if (component) {
                const select = document.getElementById(`${type}Select`);
                
                if (select) {
                    console.log(`Loading ${type}:`, component);
                    
                    // Find the matching component in inventory
                    const inventoryComponent = inventory.find(item => {
                        return item.id === component.id;
                    });

                    if (inventoryComponent) {
                        console.log(`Found matching component in inventory for ${type}:`, inventoryComponent);
                        
                        // Create a copy of the inventory component
                        const componentWithPrice = { ...inventoryComponent };
                        
                        // Get the current best available price
                        const currentPrice = getBestAvailablePrice(inventoryComponent);
                        const savedPrice = component.price || 0;
                        
                        // Check if price has changed
                        if (Math.abs(currentPrice - savedPrice) > 0.01) {
                            priceUpdates.push({
                                type: type.toUpperCase(),
                                name: component.name,
                                oldPrice: savedPrice,
                                newPrice: currentPrice
                            });
                        }
                        
                        // Use current price from inventory
                        componentWithPrice.savedPrice = currentPrice;
                        
                        // Update the select element
                        select.value = componentWithPrice.id;
                        
                        // Update current build with the component that has the current price
                        currentBuild[type] = componentWithPrice;
                        
                        // Log the price for debugging
                        console.log(`Price for ${type}: ₱${currentPrice} (was: ₱${savedPrice})`);
                        
                        // Trigger change event to update UI
                        const event = new Event('change');
                        select.dispatchEvent(event);
                    } else {
                        console.log(`No matching component found in inventory for ${type}, using saved component data:`, component);
                        // If component not found in inventory, use the saved component data directly
                        currentBuild[type] = component;
                        
                        showToast(`Note: ${type.toUpperCase()} "${component.name}" is not in current inventory. Using saved data.`, 'info');
                    }
                }
            }
        }

        // Close the modal
        closeBuildDetailsModal();

        // Update UI
        updatePrices();
        updateCompatibilityChecks();
        updatePerformanceMeters();
        updateRecommendations();

        // Show price update notifications if there were changes
        if (priceUpdates.length > 0) {
            const message = `
                <div class="space-y-2">
                    <p class="font-semibold text-yellow-400">Price Updates:</p>
                    ${priceUpdates.map(update => `
                        <div class="text-sm">
                            <span class="text-gray-300">${update.type} - ${update.name}:</span><br>
                            <span class="text-red-400">₱${update.oldPrice.toLocaleString()}</span> → 
                            <span class="text-green-400">₱${update.newPrice.toLocaleString()}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            showToast(message, 'warning', 8000);
        } else {
            showToast('Build loaded successfully!', 'success');
        }
    } catch (error) {
        console.error('Error loading build:', error);
        showToast('Error loading build: ' + error.message, 'error');
    }
}

// Update the initialization code at the end of the file
function ensureRequiredElements() {
    const requiredElements = [
        'cpuSelect', 'motherboardSelect', 'ramSelect', 
        'storageSelect', 'gpuSelect', 'psuSelect',
        'compatibilityChecks', 'buildRecommendations',
        'toast', 'toastMessage'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        throw new Error(`Missing required elements: ${missingElements.join(', ')}`);
    }
}

// Initialize PC Builder when the DOM is ready
function init() {
    try {
        ensureRequiredElements();
        initializePCBuilder().catch(error => {
            console.error('Failed to initialize PC Builder:', error);
            showToast('Error initializing PC Builder: ' + error.message, 'error');
        });
    } catch (error) {
        console.error('Error during initialization:', error);
        showToast('Error during initialization: ' + error.message, 'error');
    }
}

// Handle DOM loading states
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}