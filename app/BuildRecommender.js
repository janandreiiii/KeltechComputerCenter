// BuildRecommender.js - Intelligent PC Build Recommendation System
class BuildRecommender {
    constructor() {
        this.buildHistory = new Map();
        this.componentScores = new Map();
        this.userPreferences = new Map();
        this.compatibilityRules = this.initCompatibilityRules();
        this.buildTemplates = this.initBuildTemplates();
        this.performanceMetrics = new Map();
        this.inventory = [];
    }

    // Initialize with inventory data
    initializeWithInventory(inventoryData) {
        console.log('Initializing BuildRecommender with inventory:', inventoryData);
        this.inventory = inventoryData;
        
        // Pre-calculate scores for all components
        this.inventory.forEach(component => {
            const score = this.calculateComponentScore(component);
            this.componentScores.set(component.id, { score, interactions: 0 });
        });
        
        console.log('BuildRecommender initialization complete');
    }

    // Initialize compatibility rules
    initCompatibilityRules() {
        return {
            // CPU and Motherboard compatibility
            checkCPUMotherboard: (cpu, motherboard) => {
                if (!cpu || !motherboard) return { compatible: false, reason: 'Missing component' };
                
                const cpuSocket = cpu.specifications.find(
                    spec => spec.name.toLowerCase() === 'socket'
                )?.value;
                
                const mbSocket = motherboard.specifications.find(
                    spec => spec.name.toLowerCase() === 'socket'
                )?.value;
                
                return {
                    compatible: cpuSocket && mbSocket && cpuSocket === mbSocket,
                    reason: cpuSocket === mbSocket ? 'Compatible' : 'Socket mismatch'
                };
            },
            
            // RAM and Motherboard compatibility
            checkRAMMotherboard: (ram, motherboard) => {
                if (!ram || !motherboard) return { compatible: false, reason: 'Missing component' };
                
                const ramType = ram.specifications.find(
                    spec => spec.name.toLowerCase() === 'type'
                )?.value;
                
                const mbMemorySupport = motherboard.specifications.find(
                    spec => spec.name.toLowerCase().includes('memory support')
                )?.value;
                
                return {
                    compatible: ramType && mbMemorySupport && mbMemorySupport.includes(ramType),
                    reason: mbMemorySupport?.includes(ramType) ? 'Compatible' : 'Memory type mismatch'
                };
            },
            
            // Power supply compatibility
            checkPowerSupply: (components, psu) => {
                if (!psu || !components) return { compatible: false, reason: 'Missing component' };
                
                const totalPower = components.reduce((total, component) => {
                    return total + (parseInt(component.power_draw) || 0);
                }, 0);
                
                const psuWattage = parseInt(psu.specifications.find(
                    spec => spec.name.toLowerCase().includes('wattage')
                )?.value) || 0;
                
                const headroom = 1.2; // 20% headroom for power supply
                const requiredWattage = totalPower * headroom;
                
                return {
                    compatible: psuWattage >= requiredWattage,
                    reason: psuWattage >= requiredWattage ? 
                        'Sufficient power' : 
                        'Insufficient power supply wattage'
                };
            }
        };
    }

    // Initialize build templates
    initBuildTemplates() {
        return {
            'Budget Gaming': {
                targetPrice: 800,
                components: {
                    CPU: { budget: 0.25, minScore: 70 },
                    Motherboard: { budget: 0.15, minScore: 60 },
                    RAM: { budget: 0.15, minScore: 60 },
                    Storage: { budget: 0.10, minScore: 60 },
                    GPU: { budget: 0.25, minScore: 70 },
                    PSU: { budget: 0.10, minScore: 60 }
                }
            },
            'Mid-Range Gaming': {
                targetPrice: 1500,
                components: {
                    CPU: { budget: 0.25, minScore: 80 },
                    Motherboard: { budget: 0.15, minScore: 75 },
                    RAM: { budget: 0.15, minScore: 75 },
                    Storage: { budget: 0.10, minScore: 75 },
                    GPU: { budget: 0.25, minScore: 85 },
                    PSU: { budget: 0.10, minScore: 75 }
                }
            },
            'High-End Gaming': {
                targetPrice: 2500,
                components: {
                    CPU: { budget: 0.25, minScore: 90 },
                    Motherboard: { budget: 0.15, minScore: 85 },
                    RAM: { budget: 0.15, minScore: 85 },
                    Storage: { budget: 0.10, minScore: 85 },
                    GPU: { budget: 0.25, minScore: 95 },
                    PSU: { budget: 0.10, minScore: 85 }
                }
            },
            'Workstation': {
                targetPrice: 3000,
                components: {
                    CPU: { budget: 0.30, minScore: 95 },
                    Motherboard: { budget: 0.15, minScore: 90 },
                    RAM: { budget: 0.20, minScore: 90 },
                    Storage: { budget: 0.15, minScore: 90 },
                    GPU: { budget: 0.10, minScore: 80 },
                    PSU: { budget: 0.10, minScore: 90 }
                }
            }
        };
    }

    // Calculate performance score for a component
    calculateComponentScore(component) {
        try {
            const specs = component.specifications;
            let score = 0;
            
            switch (component.category) {
                case 'CPU':
                    const cores = parseInt(specs.find(s => s.name.toLowerCase().includes('cores'))?.value) || 0;
                    const threads = parseInt(specs.find(s => s.name.toLowerCase().includes('threads'))?.value) || 0;
                    const frequency = parseFloat(specs.find(s => s.name.toLowerCase().includes('frequency'))?.value) || 0;
                    
                    score = (cores * 10) + (threads * 5) + (frequency * 15);
                    break;

                case 'GPU':
                    const memory = parseInt(specs.find(s => s.name.toLowerCase().includes('memory'))?.value) || 0;
                    const coreClock = parseInt(specs.find(s => s.name.toLowerCase().includes('clock'))?.value) || 0;
                    
                    score = (memory * 10) + (coreClock / 10);
                    break;

                case 'RAM':
                    const capacity = parseInt(specs.find(s => s.name.toLowerCase().includes('capacity'))?.value) || 0;
                    const speed = parseInt(specs.find(s => s.name.toLowerCase().includes('speed'))?.value) || 0;
                    
                    score = (capacity * 5) + (speed / 100);
                    break;

                // Add more categories as needed
            }

            // Normalize score to 0-100 range
            return Math.min(Math.max(score, 0), 100);
        } catch (error) {
            console.error('Error calculating component score:', error);
            return 0;
        }
    }

    // Check compatibility of a complete build
    checkCompatibility(build) {
        try {
            const components = {
                cpu: build.find(c => c.category === 'CPU'),
                motherboard: build.find(c => c.category === 'Motherboard'),
                ram: build.find(c => c.category === 'RAM'),
                psu: build.find(c => c.category === 'PSU')
            };
            
            // Check CPU and Motherboard compatibility
            const cpuMbCheck = this.compatibilityRules.checkCPUMotherboard(
                components.cpu, 
                components.motherboard
            );
            if (!cpuMbCheck.compatible) {
                return { compatible: false, reason: cpuMbCheck.reason };
            }
            
            // Check RAM and Motherboard compatibility
            const ramMbCheck = this.compatibilityRules.checkRAMMotherboard(
                components.ram, 
                components.motherboard
            );
            if (!ramMbCheck.compatible) {
                return { compatible: false, reason: ramMbCheck.reason };
            }
            
            // Check power supply compatibility
            const psuCheck = this.compatibilityRules.checkPowerSupply(
                build, 
                components.psu
            );
            if (!psuCheck.compatible) {
                return { compatible: false, reason: psuCheck.reason };
            }
            
            return { compatible: true, reason: 'All components are compatible' };
        } catch (error) {
            console.error('Error checking compatibility:', error);
            return { compatible: false, reason: 'Error checking compatibility' };
        }
    }

    // Get recommended build based on template and budget
    async getRecommendedBuild(templateName, budget, preferences = {}) {
        try {
            const template = this.buildTemplates[templateName];
            if (!template) {
                throw new Error('Invalid build template');
            }

            // Adjust template based on budget
            const adjustedTemplate = this.adjustTemplateToBudget(template, budget);

            // Get available components from inventory
            const availableComponents = await this.getAvailableComponents();

            // Score and filter components
            const scoredComponents = this.scoreComponents(availableComponents, preferences);

            // Generate build combinations
            const builds = this.generateBuildCombinations(scoredComponents, adjustedTemplate);

            // Rank builds
            const rankedBuilds = this.rankBuilds(builds, budget, preferences);

            // Return top recommendation
            return rankedBuilds[0] || null;
        } catch (error) {
            console.error('Error getting recommended build:', error);
            throw error;
        }
    }

    // Adjust template based on budget
    adjustTemplateToBudget(template, budget) {
        const scaleFactor = budget / template.targetPrice;
        const adjustedTemplate = { ...template };

        Object.entries(template.components).forEach(([component, specs]) => {
            adjustedTemplate.components[component] = {
                ...specs,
                budget: specs.budget * budget,
                minScore: Math.max(specs.minScore * scaleFactor, 0)
            };
        });

        return adjustedTemplate;
    }

    // Score components based on performance and preferences
    scoreComponents(components, preferences) {
        return components.map(component => ({
            ...component,
            score: this.calculateComponentScore(component) * 
                   (preferences[component.category] || 1)
        }));
    }

    // Generate valid build combinations
    generateBuildCombinations(components, template) {
        const builds = [];
        const componentsByType = new Map();

        // Group components by type
        components.forEach(component => {
            if (!componentsByType.has(component.category)) {
                componentsByType.set(component.category, []);
            }
            componentsByType.get(component.category).push(component);
        });

        // Generate combinations (using a simplified approach for performance)
        const buildComponents = [];
        for (const [type, specs] of Object.entries(template.components)) {
            const typeComponents = componentsByType.get(type) || [];
            const validComponents = typeComponents.filter(c => 
                c.score >= specs.minScore &&
                this.getLatestPrice(c) <= specs.budget
            );

            if (validComponents.length === 0) return []; // No valid builds possible
            buildComponents.push(validComponents);
        }

        // Generate combinations (limited to top components for performance)
        const maxCombinations = 1000;
        let combinations = this.generateLimitedCombinations(buildComponents, maxCombinations);

        // Filter compatible combinations
        return combinations.filter(build => this.checkCompatibility(build).compatible);
    }

    // Generate limited number of combinations
    generateLimitedCombinations(componentArrays, limit) {
        let combinations = [[]];
        
        for (const components of componentArrays) {
            const newCombinations = [];
            
            for (const combination of combinations) {
                for (const component of components) {
                    if (newCombinations.length >= limit) break;
                    newCombinations.push([...combination, component]);
                }
            }
            
            combinations = newCombinations;
        }

        return combinations;
    }

    // Rank builds based on various factors
    rankBuilds(builds, budget, preferences) {
        return builds.map(build => ({
            build,
            score: this.calculateBuildScore(build, budget, preferences)
        }))
        .sort((a, b) => b.score - a.score)
        .map(result => result.build);
    }

    // Calculate overall build score
    calculateBuildScore(build, budget, preferences) {
        try {
            let score = 0;
            const totalPrice = this.calculateBuildPrice(build);

            // Performance score (50%)
            const performanceScore = build.reduce((sum, component) => 
                sum + (component.score * (preferences[component.category] || 1)), 0
            ) / build.length;
            score += performanceScore * 0.5;

            // Price efficiency (30%)
            const priceEfficiency = 100 * (1 - Math.abs(totalPrice - budget) / budget);
            score += priceEfficiency * 0.3;

            // Component balance (20%)
            const balance = this.calculateBuildBalance(build);
            score += balance * 0.2;

            return score;
        } catch (error) {
            console.error('Error calculating build score:', error);
            return 0;
        }
    }

    // Calculate build balance score
    calculateBuildBalance(build) {
        try {
            const scores = build.map(component => component.score);
            const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
            const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
            
            // Convert variance to balance score (0-100)
            return 100 * Math.exp(-variance / 1000);
        } catch (error) {
            console.error('Error calculating build balance:', error);
            return 0;
        }
    }

    // Get latest price for a component
    getLatestPrice(component) {
        try {
            if (!component.batches || component.batches.length === 0) return Infinity;
            
            const latestBatch = component.batches.reduce((latest, batch) => {
                return new Date(batch.dateAdded) > new Date(latest.dateAdded) ? batch : latest;
            });

            return parseFloat(latestBatch.sellPrice) || Infinity;
        } catch (error) {
            console.error('Error getting latest price:', error);
            return Infinity;
        }
    }

    // Calculate total build price
    calculateBuildPrice(build) {
        return build.reduce((total, component) => total + this.getLatestPrice(component), 0);
    }

    // Get available components from inventory
    async getAvailableComponents() {
        return this.inventory.filter(component => {
            const stock = this.calculateAvailableQuantity(component);
            const price = this.getBestAvailablePrice(component);
            return stock > 0 && price > 0;
        });
    }

    // Helper method to calculate available quantity
    calculateAvailableQuantity(component) {
        if (!component.batches || !Array.isArray(component.batches)) return 0;
        return component.batches.reduce((total, batch) => {
            return total + (parseInt(batch.remaining) || 0);
        }, 0);
    }

    // Helper method to get best available price
    getBestAvailablePrice(component) {
        if (!component.batches || !Array.isArray(component.batches)) return 0;
        
        const inStockBatches = component.batches.filter(batch => {
            const remaining = parseInt(batch.remaining) || 0;
            const price = parseFloat(batch.sellPrice) || 0;
            return remaining > 0 && price > 0;
        });
        
        if (inStockBatches.length === 0) return 0;
        
        return Math.min(...inStockBatches.map(batch => parseFloat(batch.sellPrice) || Infinity));
    }

    // Learn from user interactions
    learnFromInteraction(build, userAction) {
        try {
            const { accepted, feedback } = userAction;
            
            build.forEach(component => {
                const currentScore = this.componentScores.get(component.id) || { 
                    score: 50, 
                    interactions: 0 
                };

                // Update score based on user action
                const learningRate = 0.1 / (1 + currentScore.interactions);
                const scoreDelta = accepted ? 10 : -5;
                
                currentScore.score += scoreDelta * learningRate;
                currentScore.interactions += 1;
                
                this.componentScores.set(component.id, currentScore);
            });

            // Store build in history
            this.buildHistory.set(Date.now(), {
                build,
                action: userAction
            });

            // Trim history if too large
            if (this.buildHistory.size > 1000) {
                const oldestKey = Math.min(...this.buildHistory.keys());
                this.buildHistory.delete(oldestKey);
            }
        } catch (error) {
            console.error('Error learning from interaction:', error);
        }
    }

    // Update user preferences
    updateUserPreferences(preferences) {
        try {
            Object.entries(preferences).forEach(([category, value]) => {
                this.userPreferences.set(category, value);
            });
        } catch (error) {
            console.error('Error updating user preferences:', error);
        }
    }

    // Get build suggestions based on current inventory and trends
    async getBuildSuggestions() {
        try {
            const suggestions = [];
            const components = await this.getAvailableComponents();

            // Analyze inventory for potential builds
            const templates = Object.entries(this.buildTemplates);
            
            for (const [templateName, template] of templates) {
                const possibleBuild = await this.getRecommendedBuild(
                    templateName,
                    template.targetPrice
                );

                if (possibleBuild) {
                    suggestions.push({
                        template: templateName,
                        build: possibleBuild,
                        price: this.calculateBuildPrice(possibleBuild),
                        score: this.calculateBuildScore(possibleBuild, template.targetPrice, {})
                    });
                }
            }

            return suggestions.sort((a, b) => b.score - a.score);
        } catch (error) {
            console.error('Error getting build suggestions:', error);
            return [];
        }
    }
}

// Export the BuildRecommender class
export default BuildRecommender; 