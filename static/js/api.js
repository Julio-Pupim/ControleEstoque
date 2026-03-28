const API_BASE = '/api';

// Helper interno para padronizar as requisições (fetch)
async function request(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Erro na requisição');
        }

        // Se for DELETE ou status 204 (No Content), retorna null
        if (res.status === 204) return null;

        return await res.json();
    } catch (error) {
        console.error(`API Error: ${endpoint}`, error);
        throw error;
    }
}

export const Api = {
    // =========================================
    // PRODUTOS
    // =========================================
    getProducts: (page, limit, search, catId) =>
        request(`/products?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&category_id=${catId || ''}`),

    saveProduct: (product) => {
        const method = product.id ? 'PUT' : 'POST';
        const url = product.id ? `/products/${product.id}` : '/products';
        return request(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
    },

    deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

    // Usado no PDV e na busca
    searchProducts: (q) => request(`/products/search?q=${encodeURIComponent(q)}`),

    // Usado na verificação de duplicidade e no PDV (Enter)
    getProductByBarcode: (barcode) => request(`/products/barcode/${barcode}`),
    getProductByCode:   (code)    => request(`/products/code/${encodeURIComponent(code)}`),

    getCategories: (brandId) => request(`/categories${brandId ? '?brand_id=' + brandId : ''}`),
    getBrands: () => request('/brands'),


     // ─── NF-e ──────────────────────────────────────────────────────────────────
    nfePreview: (xml) => request('/nfe/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml }),
    }),
 
    nfeImport: (products) => request('/nfe/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
    }),

    // =========================================
    // CLIENTES
    // =========================================
    getCustomers: (page, limit, search = '') => {
        let url = `/customers?page=${page}&limit=${limit}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        return request(url);
    },

    saveCustomer: (customer) => {
        const method = customer.id ? 'PUT' : 'POST';
        const url = customer.id ? `/customers/${customer.id}` : '/customers';
        return request(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customer)
        });
    },

    deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),

    payDebt: (customerId, amount, date) => request('/customers/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, amount, date })
    }),

    getHistory: (customerId, page, filters = {}) => {
        let url = `/customers/${customerId}/history?page=${page}&limit=${filters.limit || 10}`;
        if (filters.startDate) url += `&startDate=${filters.startDate}`;
        if (filters.endDate) url += `&endDate=${filters.endDate}`;
        return request(url);
    },

    // =========================================
    // VENDAS (PDV) E RELATÓRIOS
    // =========================================
    createSale: (data) => request('/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),

    getBestCustomer: () => request('/reports/best-customer'),
    getMonthlyProfit: () => request('/reports/monthly-profit'),

    // =========================================
    // CATEGORIAS (CRUD)
    // =========================================
    getCategoriesManage: () => request('/categories/manage'),
    saveCategory: (category) => {
        const method = category.id ? 'PUT' : 'POST';
        const url = category.id ? `/categories/manage/${category.id}` : '/categories/manage';
        return request(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(category)
        });
    },
    deleteCategory: (id) => request(`/categories/manage/${id}`, { method: 'DELETE' }),
};