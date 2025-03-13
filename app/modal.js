
/**
 * Modal Management System for Keltech Inventory
 * This provides reliable modal creation and management
 */
window.ModalSystem = {
    /**
     * Create and show a modal
     * @param {Object} options - Modal configuration
     * @param {string} options.title - Modal title
     * @param {string|HTMLElement} options.content - Modal content (HTML string or element)
     * @param {Function} options.onClose - Optional callback when modal closes
     * @param {string} options.size - Modal size (sm, md, lg, xl)
     * @returns {HTMLElement} The created modal element
     */
    show: function(options) {
        console.log("Creating modal:", options.title);
        
        // Create container
        const modal = document.createElement('div');
        modal.className = 'kc-modal fixed inset-0 flex items-center justify-center z-[9999]';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        
        // Set size class
        const sizeClass = options.size === 'lg' ? 'max-w-4xl' : 
                         options.size === 'xl' ? 'max-w-6xl' : 
                         options.size === 'sm' ? 'max-w-sm' : 'max-w-md';
        
        // Create modal dialog
        const dialog = document.createElement('div');
        dialog.className = `bg-white rounded-lg shadow-lg p-6 w-full ${sizeClass} m-4`;
        dialog.style.maxHeight = '90vh';
        dialog.style.overflowY = 'auto';
        
        // Add title if provided
        if (options.title) {
            const titleEl = document.createElement('h3');
            titleEl.className = 'text-xl font-semibold mb-4 flex justify-between items-center';
            titleEl.innerHTML = `
                <span>${options.title}</span>
                <button type="button" class="modal-close text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                         xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            `;
            dialog.appendChild(titleEl);
            
            // Add close button event
            const closeBtn = titleEl.querySelector('.modal-close');
            closeBtn.addEventListener('click', () => this.close(modal, options.onClose));
        }
        
        // Add content
        const content = document.createElement('div');
        content.className = 'modal-content';
        if (typeof options.content === 'string') {
            content.innerHTML = options.content;
        } else if (options.content instanceof HTMLElement) {
            content.appendChild(options.content);
        }
        dialog.appendChild(content);
        
        // Add to modal
        modal.appendChild(dialog);
        
        // Add close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.close(modal, options.onClose);
            }
        });
        
        // Add escape key handler
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.close(modal, options.onClose);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // Add to document
        document.body.appendChild(modal);
        
        // Debug info
        console.log("Modal created with ID:", modal.id);
        setTimeout(() => {
            console.log("Active modals:", document.querySelectorAll('.kc-modal').length);
        }, 100);
        
        return modal;
    },
    
    /**
     * Close a modal
     * @param {HTMLElement} modal - The modal to close
     * @param {Function} callback - Optional callback after closing
     */
    close: function(modal, callback) {
        console.log("Closing modal");
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.remove();
            if (typeof callback === 'function') {
                callback();
            }
        }, 150);
    },
    
    /**
     * Show a form modal with fields
     * @param {Object} options - Form options
     * @param {string} options.title - Form title
     * @param {Array} options.fields - Form fields configuration
     * @param {Function} options.onSubmit - Form submit handler
     * @returns {HTMLElement} The created modal
     */
    showForm: function(options) {
        const form = document.createElement('form');
        form.className = 'space-y-4';
        
        // Add fields
        if (Array.isArray(options.fields)) {
            options.fields.forEach(field => {
                const fieldContainer = document.createElement('div');
                
                // Label
                if (field.label) {
                    const label = document.createElement('label');
                    label.className = 'block text-sm font-medium text-gray-700 mb-2';
                    label.textContent = field.label;
                    fieldContainer.appendChild(label);
                }
                
                // Input wrapper for special inputs
                const inputWrapper = ['price', 'currency'].includes(field.type) ? 
                    document.createElement('div') : null;
                
                if (inputWrapper) {
                    inputWrapper.className = 'relative';
                    
                    if (field.type === 'price' || field.type === 'currency') {
                        const currencySymbol = document.createElement('span');
                        currencySymbol.className = 'absolute left-3 top-2.5 text-gray-500';
                        currencySymbol.textContent = '₱';
                        inputWrapper.appendChild(currencySymbol);
                    }
                }
                
                // Input element
                let input;
                if (field.type === 'select') {
                    input = document.createElement('select');
                    
                    if (Array.isArray(field.options)) {
                        field.options.forEach(opt => {
                            const option = document.createElement('option');
                            option.value = opt.value;
                            option.textContent = opt.label;
                            if (field.value === opt.value) {
                                option.selected = true;
                            }
                            input.appendChild(option);
                        });
                    }
                } else {
                    input = document.createElement('input');
                    input.type = field.type === 'price' || field.type === 'currency' ? 'number' : (field.type || 'text');
                    
                    if (field.type === 'number' || field.type === 'price' || field.type === 'currency') {
                        input.min = field.min !== undefined ? field.min : 0;
                        input.step = field.step || (field.type === 'price' || field.type === 'currency' ? '0.01' : '1');
                    }
                    
                    if (field.value !== undefined) {
                        input.value = field.value;
                    }
                }
                
                // Common attributes
                input.id = field.id || `field_${Math.random().toString(36).substring(2, 9)}`;
                input.name = field.name || input.id;
                input.required = field.required === true;
                input.className = `${field.type === 'price' || field.type === 'currency' ? 'pl-7' : ''} w-full border border-gray-300 rounded-lg p-2.5`;
                if (field.disabled) {
                    input.disabled = true;
                    input.classList.add('bg-gray-100');
                }
                
                // Add input to wrapper or container
                if (inputWrapper) {
                    inputWrapper.appendChild(input);
                    fieldContainer.appendChild(inputWrapper);
                } else {
                    fieldContainer.appendChild(input);
                }
                
                // Help text
                if (field.help) {
                    const helpText = document.createElement('p');
                    helpText.className = 'mt-1 text-sm text-gray-500';
                    helpText.textContent = field.help;
                    fieldContainer.appendChild(helpText);
                }
                
                form.appendChild(fieldContainer);
            });
        }
        
        // Add buttons
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'flex justify-end space-x-3 pt-4';
        
        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50';
        cancelBtn.textContent = options.cancelText || 'Cancel';
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.close(form.closest('.kc-modal'), options.onCancel);
        });
        buttonGroup.appendChild(cancelBtn);
        
        // Submit button
        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.className = 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700';
        submitBtn.textContent = options.submitText || 'Submit';
        buttonGroup.appendChild(submitBtn);
        
        form.appendChild(buttonGroup);
        
        // Form submit handler
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (typeof options.onSubmit === 'function') {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="inline-block animate-spin mr-2">↻</span> Processing...';
                
                try {
                    // Collect form data
                    const formData = {};
                    options.fields.forEach(field => {
                        const input = form.querySelector(`#${field.id}`);
                        if (input) {
                            let value = input.value;
                            
                            // Convert types as needed
                            if (field.type === 'number' || field.type === 'price' || field.type === 'currency') {
                                value = parseFloat(value);
                            } else if (field.type === 'checkbox') {
                                value = input.checked;
                            }
                            
                            formData[field.name || field.id] = value;
                        }
                    });
                    
                    const result = await options.onSubmit(formData, form);
                    
                    if (result !== false) {
                        this.close(form.closest('.kc-modal'), options.onClose);
                    } else {
                        // Re-enable submit if the handler returns false
                        submitBtn.disabled = false;
                        submitBtn.textContent = options.submitText || 'Submit';
                    }
                } catch (error) {
                    console.error('Form submission error:', error);
                    
                    // Show error in the form
                    let errorMsg = form.querySelector('.form-error');
                    if (!errorMsg) {
                        errorMsg = document.createElement('div');
                        errorMsg.className = 'form-error bg-red-50 text-red-700 p-3 rounded mb-4';
                        form.insertBefore(errorMsg, form.firstChild);
                    }
                    errorMsg.textContent = error.message || 'An error occurred';
                    
                    // Re-enable submit
                    submitBtn.disabled = false;
                    submitBtn.textContent = options.submitText || 'Submit';
                }
            }
        });
        
        // Show modal with form
        return this.show({
            title: options.title,
            content: form,
            size: options.size || 'md',
            onClose: options.onClose
        });
    },
    
    /**
     * Show a confirmation dialog
     * @param {Object} options - Dialog options
     * @returns {Promise} Promise that resolves with true (confirm) or false (cancel)
     */
    confirm: function(options) {
        return new Promise(resolve => {
            const content = document.createElement('div');
            content.innerHTML = `
                <p class="mb-6">${options.message || 'Are you sure?'}</p>
                <div class="flex justify-end space-x-3">
                    <button id="modal-cancel" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                        ${options.cancelText || 'Cancel'}
                    </button>
                    <button id="modal-confirm" class="px-4 py-2 bg-${options.color || 'blue'}-600 text-white rounded-lg hover:bg-${options.color || 'blue'}-700">
                        ${options.confirmText || 'Confirm'}
                    </button>
                </div>
            `;
            
            const modal = this.show({
                title: options.title || 'Confirm Action',
                content: content,
                size: 'sm'
            });
            
            // Add event handlers
            content.querySelector('#modal-cancel').addEventListener('click', () => {
                this.close(modal);
                resolve(false);
            });
            
            content.querySelector('#modal-confirm').addEventListener('click', () => {
                this.close(modal);
                resolve(true);
            });
        });
    },
    
    /**
     * Show an alert dialog
     * @param {Object} options - Alert options
     */
    alert: function(options) {
        const content = document.createElement('div');
        content.innerHTML = `
            <p class="mb-6">${options.message}</p>
            <div class="flex justify-end">
                <button id="modal-ok" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    ${options.okText || 'OK'}
                </button>
            </div>
        `;
        
        const modal = this.show({
            title: options.title || 'Alert',
            content: content,
            size: 'sm'
        });
        
        // Add event handler
        content.querySelector('#modal-ok').addEventListener('click', () => {
            this.close(modal, options.onClose);
        });
    },
    
    /**
     * Debug current state of modals
     */
    debug: function() {
        const modals = document.querySelectorAll('.kc-modal');
        console.log(`Active modals: ${modals.length}`);
        
        modals.forEach((modal, i) => {
            console.log(`Modal ${i+1}:`, {
                visible: modal.offsetParent !== null,
                zIndex: getComputedStyle(modal).zIndex,
                opacity: getComputedStyle(modal).opacity
            });
        });
        
        return modals.length;
    }
};

// Add global CSS for modals
const modalStyle = document.createElement('style');
modalStyle.textContent = `
    .kc-modal {
        z-index: 9999 !important; 
        background-color: rgba(0, 0, 0, 0.5);
        transition: opacity 0.15s ease-out;
    }
    .kc-modal form {
        max-width: 100%;
    }
`;
document.head.appendChild(modalStyle);

console.log("✅ Modal system initialized");
