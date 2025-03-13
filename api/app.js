// ...existing code...

async function fixAutoIncrement() {
    try {
        const response = await fetch('api/fix-id-autoincrement.php');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            console.log('Auto-increment fix response:', data);
            return data;
        } catch (e) {
            console.error('Raw server response:', text);
            throw new Error('Server returned invalid JSON');
        }
    } catch (error) {
        console.error('Error during auto-increment fix:', error);
        throw error;
    }
}

async function saveProduct(productData) {
    try {
        // Single attempt to fix database
        await fixAutoIncrement();
        
        const response = await fetch('api/save-product.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || result.error || 'Error saving product');
        }
        
        return result;
    } catch (error) {
        console.error('Error saving product:', error);
        throw error;
    }
}

// ...existing code...
