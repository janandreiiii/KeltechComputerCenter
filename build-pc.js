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

// Update the filterComponents function to handle new categories
function filterComponents(category) {
    console.log(`\n=== Filtering ${category} Components ===`);
    console.log('Current inventory state:', inventory);
    
    // Normalize category names for comparison
    const normalizedCategory = category.toLowerCase().replace(/\s+/g, '_');
    
    const components = inventory.filter(item => {
        if (!item || !item.category) return false;
        
        // Normalize item category for comparison
        const itemCategory = item.category.toLowerCase().replace(/\s+/g, '_');
        
        // Match categories, including special cases
        const matches = 
            itemCategory === normalizedCategory ||
            (normalizedCategory === 'case_fans' && itemCategory === 'fans') ||
            (normalizedCategory === 'cpu_cooler' && itemCategory === 'cooler');
            
        if (matches) {
            console.log(`Found matching item: ${item.name} (${item.category})`);
        }
        return matches;
    });
    
    console.log(`Found ${components.length} ${category} items`);
    return components;
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
            // Core Components
            cpuSelect: 'CPU',
            motherboardSelect: 'Motherboard',
            ramSelect: 'RAM',
            storageSelect: 'Storage',
            gpuSelect: 'GPU',
            psuSelect: 'PSU',
            
            // Chassis and Cooling
            caseSelect: 'Case',
            cpu_coolerSelect: 'CPU Cooler',
            fansSelect: 'Case Fans',
            
            // Peripherals
            monitorSelect: 'Monitor',
            keyboardSelect: 'Keyboard',
            mouseSelect: 'Mouse',
            headsetSelect: 'Headset'
        };

        // Populate dropdowns
        for (const [selectId, category] of Object.entries(categoryMap)) {
            populateDropdown(selectId, filterComponents(category), `Select a ${category}`);
        }

        // Add event listeners - use only one handler per select element
        document.querySelectorAll('select').forEach(select => {
            // Remove any existing listeners first to prevent duplicates
            const newSelect = select.cloneNode(true);
            select.parentNode.replaceChild(newSelect, select);
            newSelect.addEventListener('change', handleComponentChange);
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

// Handle component selection change - consolidated handler
function handleComponentChange(event) {
    const componentType = event.target.id.replace('Select', '').toLowerCase();
    const selectedId = event.target.value;
    const previousValue = currentBuild[componentType];
    
    console.log(`Component change: ${componentType}, Selected ID: ${selectedId}`);
    
    // Update current build
    if (selectedId) {
        const selectedComponent = inventory.find(item => String(item.id) === String(selectedId));
        if (selectedComponent) {
            // Create a deep copy of the selected component
            currentBuild[componentType] = JSON.parse(JSON.stringify(selectedComponent));
            console.log(`Updated currentBuild[${componentType}]:`, currentBuild[componentType]);
        }
    } else {
        // If no selection (empty value), set to null
        currentBuild[componentType] = null;
        console.log(`Cleared ${componentType} from currentBuild`);
    }
    
    // Update UI elements that depend on the current build
    updateCompatibilityChecks();
    updatePerformanceMeters();
    updateRecommendations();
    updateComponentCheckIcons();
    updatePrices();
    
    // Show component details with enhanced information
    if (currentBuild[componentType]) {
        showEnhancedComponentDetails(componentType, currentBuild[componentType]);
        lastSelectedComponent = componentType;
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

// Update the component selection event listener
document.querySelectorAll('.custom-select').forEach(select => {
    select.addEventListener('change', () => {
        const component = select.id.replace('Select', '');
        const selectedId = select.value;
        
        if (selectedId) {
            // Find the full component object from inventory
            const selectedComponent = inventory.find(item => String(item.id) === String(selectedId));
            console.log(`Selected ${component}:`, selectedComponent); // Debug log
            
            if (selectedComponent) {
                // Create a deep copy of the selected component
                currentBuild[component] = JSON.parse(JSON.stringify(selectedComponent));
                console.log(`Updated currentBuild[${component}]:`, currentBuild[component]); // Debug log
            }
        } else {
            // If no selection (empty value), set to null
            currentBuild[component] = null;
            console.log(`Cleared ${component} from currentBuild`);
        }
        
        // Update UI
        lastSelectedComponent = component;
        updateComponentCheckIcons();
        
        // Log the current build state before updating prices
        console.log('Current build state before price update:', {...currentBuild});
        
        // Update prices
        updatePrices();
    });
});

let total = 0;

function updatePrices() {
    console.log('Updating prices for current build:', {...currentBuild});
    
    // Reset the total before calculating
    total = 0;

    // Iterate over each component in the build
    Object.entries(currentBuild).forEach(([component, product]) => {
        if (!product) {
            console.log(`No product selected for ${component}`);
            return;
        }
        
        // Get the best available price
        const price = getBestAvailablePrice(product);
        console.log(`${component} price:`, price);
        
        // Add to running total only if price is valid
        if (!isNaN(price) && price > 0) {
            total += price;
            console.log(`Added ${price} to total. Running total: ${total}`);
        }
        
        // Update individual component price display
        const priceElement = document.getElementById(`${component}Price`);
        if (priceElement) {
            const formattedPrice = price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            priceElement.textContent = `₱${formattedPrice}`;
            console.log(`Updated ${component} price display: ₱${formattedPrice}`);
        }
    });

    // Format the final total
    const formattedTotal = total.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    // Update both total price displays
    const totalPriceElement = document.getElementById('totalPrice');
    const totalPriceSummaryElement = document.getElementById('totalPriceSummary');
    
    if (totalPriceElement) {
        totalPriceElement.textContent = `₱${formattedTotal}`;
        console.log(`Updated totalPrice to: ₱${formattedTotal}`);
    }
    
    if (totalPriceSummaryElement) {
        totalPriceSummaryElement.textContent = `₱${formattedTotal}`;
        console.log(`Updated totalPriceSummary to: ₱${formattedTotal}`);
    }
    
    console.log('Final total price:', total);
    return total;
}


// Initialize the component check icons on page load
document.addEventListener('DOMContentLoaded', updateComponentCheckIcons);

// Get best available price from in-stock batches
function getBestAvailablePrice(product) {
    if (!product) {
        console.log('Product is null or undefined');
        return 0;
    }
    
    if (!product.batches || product.batches.length === 0) {
        console.log(`No batches found for ${product.name}`);
        return 0;
    }
    
    console.log(`\nCalculating best price for ${product.name}`);
    console.log('Available batches:', product.batches);
    
    // Filter in-stock batches and ensure proper numeric conversion
    const inStockBatches = product.batches.filter(batch => {
        const remaining = parseInt(batch.remaining) || 0;
        const sellPrice = parseFloat(batch.sellPrice) || 0;
        
        console.log(`Batch - Remaining: ${remaining}, Price: ₱${sellPrice}`);
        
        // Validate reasonable price range (expanded for all component types)
        const minPrice = 100; // Lower minimum for peripherals
        const maxPrice = 500000; // Higher maximum for high-end components
        
        if (sellPrice < minPrice || sellPrice > maxPrice) {
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
    if (validateBuild()) {
        showCustomerInfoModal();
    }
}

function validateBuild() {
    const requiredComponents = ['cpu', 'motherboard', 'ram', 'storage', 'psu'];

    // Debugging: Log each component's selection status
    console.log('Validating component selections:');
    requiredComponents.forEach(type => {
        console.log(`${type}: ${currentBuild[type] ? 'Selected' : 'Not selected'}`);
    });
    
    // Check if at least one valid component is selected
    const hasSelection = Object.entries(currentBuild).some(([type, component]) => {
        return component !== null && component !== undefined && typeof component === 'object';
    });

    console.log('Has at least one selection:', hasSelection);
    
    if (!hasSelection) {
        showToast('Please select at least one component to proceed', 'error');
        return false;
    }

    // Compatibility checks only if both relevant components are selected
    if (currentBuild.cpu && currentBuild.motherboard) {
        if (!checkSocketCompatibility(currentBuild.cpu, currentBuild.motherboard)) {
            showToast('CPU and motherboard are not compatible', 'error');
            return false;
        }
    }

    if (currentBuild.ram && currentBuild.motherboard) {
        if (!checkRAMCompatibilityWithMotherboard(currentBuild.ram, currentBuild.motherboard)) {
            showToast('RAM is not compatible with motherboard', 'error');
            return false;
        }
    }

    if (currentBuild.psu) {
        if (!checkPowerSupplySufficiency()) {
            showToast('Power supply is insufficient for this build', 'error');
            return false;
        }
    }

    return true; // If at least one component is selected and all checks pass
}

// Function to update the component check icons
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

// Function to show the customer information modal
function showCustomerInfoModal() {
    // Calculate build summary first
    const buildSummary = generateBuildSummary();
    const totalPrice = calculateTotalPrice();

    // Create modal HTML - adding name attributes to all inputs
    const modalHTML = `
        <div id="customerInfoModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-gray-900 p-6 rounded-lg shadow-xl max-w-2xl w-full mx-4">
                <h2 class="text-2xl font-bold text-white mb-4">Save Your Build</h2>
                
                <!-- Customer Information Form -->
                <form id="customerInfoForm" class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-gray-300 mb-2" for="customerName">Customer Name *</label>
                            <input type="text" id="customerName" name="customerName" required
                                class="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-gray-300 mb-2" for="contactNumber">Contact Number *</label>
                            <input type="tel" id="contactNumber" name="contactNumber" required
                                class="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-gray-300 mb-2" for="emailAddress">Email Address *</label>
                            <input type="email" id="emailAddress" name="emailAddress" required
                                class="w-full p-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-gray-300 mb-2" for="address">Address *</label>
                            <input type="text" id="address" name="address" required
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

// Function to handle form submission - simplified version that directly accesses form fields by ID
async function handleCustomerInfoSubmit(event) {
    // Always prevent default form submission
    event.preventDefault();
    console.log('Form submission started');
    
    // Get the submit button for loading state management
    const submitButton = event.target.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i>Saving...';
    }
    
    try {
        // Get direct references to the input elements
        const nameInput = document.getElementById('customerName');
        const contactInput = document.getElementById('contactNumber');
        const emailInput = document.getElementById('emailAddress');
        const addressInput = document.getElementById('address');
        
        console.log('Form field elements:', { 
            nameInput, contactInput, emailInput, addressInput 
        });
        
        // Check if elements exist to avoid null reference errors
        if (!nameInput || !contactInput || !emailInput || !addressInput) {
            throw new Error('Form elements not found. Please try again.');
        }
        
        // Get field values with proper null/undefined checks
        const customerName = nameInput.value || '';
        const contactNumber = contactInput.value || '';
        const emailAddress = emailInput.value || '';
        const customerAddress = addressInput.value || '';
        
        console.log('Form field values:', {
            name: customerName,
            contact: contactNumber,
            email: emailAddress,
            address: customerAddress
        });
        
        // Validate required fields
        if (!customerName.trim()) {
            nameInput.focus();
            throw new Error('Customer name is required');
        }
        
        if (!contactNumber.trim()) {
            contactInput.focus();
            throw new Error('Contact number is required');
        }
        
        if (!emailAddress.trim()) {
            emailInput.focus();
            throw new Error('Email address is required');
        }
        
        if (!customerAddress.trim()) {
            addressInput.focus();
            throw new Error('Address is required');
        }
        
        // Create the data object for API submission
        const customerData = {
            name: customerName.trim(),
            contact: contactNumber.trim(),
            email: emailAddress.trim(),
            address: customerAddress.trim(),
            build: currentBuild,
            total_price: calculateTotalPrice(),
            date_created: new Date().toISOString()
        };
        
        // Process the save operation
        let success = false;
        let trackingId = '';
        let buildId = '';
        
        try {
            // Attempt to save server-side
            const apiUrl = './api/save-customer-build.php';
            console.log('Sending data to API:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(customerData)
            });
            
            // Get response text for debugging
            const responseText = await response.text();
            console.log('API Response text:', responseText);
            
            // Parse the response if possible
            let result;
            try {
                result = JSON.parse(responseText);
                console.log('Parsed API response:', result);
            } catch (parseError) {
                console.error('Failed to parse API response:', parseError);
                throw new Error(`Invalid response format: ${responseText.substring(0, 100)}...`);
            }
            
            // Check if the operation was successful
            if (result && result.success) {
                trackingId = result.data?.tracking_id || 'UNKNOWN';
                buildId = result.data?.build_id || 'UNKNOWN';
                success = true;
            } else {
                throw new Error(result?.message || 'Unknown server error');
            }
            
        } catch (serverError) {
            // Server save failed, offer local storage fallback
            console.error('Server save failed:', serverError);
            
            if (window.confirm('Server save failed. Save locally instead? (Local builds cannot be retrieved by staff)')) {
                // Use local storage
                try {
                    trackingId = 'LOCAL-' + Date.now().toString(36).toUpperCase();
                    buildId = Date.now().toString();
                    
                    const savedBuilds = JSON.parse(localStorage.getItem('savedBuilds') || '[]');
                    
                    savedBuilds.push({
                        id: buildId,
                        trackingId: trackingId,
                        customer: {
                            name: customerName.trim(),
                            email: emailAddress.trim(),
                            contact: contactNumber.trim(),
                            address: customerAddress.trim()
                        },
                        build_data: currentBuild,
                        total_price: customerData.total_price,
                        date_created: new Date().toISOString()
                    });
                    
                    localStorage.setItem('savedBuilds', JSON.stringify(savedBuilds));
                    console.log('Build saved to local storage');
                    success = true;
                } catch (localError) {
                    console.error('Local storage save failed:', localError);
                    throw new Error('Failed to save locally: ' + localError.message);
                }
            } else {
                throw serverError;
            }
        }
        
        // Handle successful save
        if (success) {
            showToast('Build saved successfully!', 'success');
            closeCustomerInfoModal();
            showBuildSavedSuccess(customerName.trim(), buildId, trackingId);
        }
        
    } catch (error) {
        console.error('Build save error:', error);
        showToast('Error saving build: ' + error.message, 'error', 6000);
    } finally {
        // Reset button state
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Save Build';
        }
    }
}

// Function to close the modal
function closeCustomerInfoModal() {
    const modal = document.getElementById('customerInfoModal');
    if (modal) {
        modal.remove();
    }
}

// Save current build
function saveBuild() {
    if (validateBuild()) {
        showCustomerInfoModal();
    }
}

function validateBuild() {
    const requiredComponents = ['cpu', 'motherboard', 'ram', 'storage', 'psu'];

    // Debugging: Log each component's selection status
    console.log('Validating component selections:');
    requiredComponents.forEach(type => {
        console.log(`${type}: ${currentBuild[type] ? 'Selected' : 'Not selected'}`);
    });
    
    // Check if at least one valid component is selected
    const hasSelection = Object.entries(currentBuild).some(([type, component]) => {
        return component !== null && component !== undefined && typeof component === 'object';
    });

    console.log('Has at least one selection:', hasSelection);
    
    if (!hasSelection) {
        showToast('Please select at least one component to proceed', 'error');
        return false;
    }

    // Compatibility checks only if both relevant components are selected
    if (currentBuild.cpu && currentBuild.motherboard) {
        if (!checkSocketCompatibility(currentBuild.cpu, currentBuild.motherboard)) {
            showToast('CPU and motherboard are not compatible', 'error');
            return false;
        }
    }

    if (currentBuild.ram && currentBuild.motherboard) {
        if (!checkRAMCompatibilityWithMotherboard(currentBuild.ram, currentBuild.motherboard)) {
            showToast('RAM is not compatible with motherboard', 'error');
            return false;
        }
    }

    if (currentBuild.psu) {
        if (!checkPowerSupplySufficiency()) {
            showToast('Power supply is insufficient for this build', 'error');
            return false;
        }
    }

    return true; // If at least one component is selected and all checks pass
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

// Function to calculate the total price of the current build
function calculateTotalPrice() {
    console.log('Calculating total price for current build');
    
    let calculatedTotal = 0;
    
    // Sum up prices of all selected components
    Object.entries(currentBuild).forEach(([component, product]) => {
        if (!product) {
            return;
        }
        
        const price = getBestAvailablePrice(product);
        if (!isNaN(price) && price > 0) {
            calculatedTotal += price;
            console.log(`Added ${price} for ${component}. Running total: ${calculatedTotal}`);
        }
    });
    
    console.log(`Final calculated total: ${calculatedTotal}`);
    return calculatedTotal;
}