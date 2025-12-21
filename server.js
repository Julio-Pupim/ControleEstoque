const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// Controllers
const ProductController = require('./controller/ProductController');
const CustomerController = require('./controller/CustomerController'); // Agora importamos o arquivo novo
const SaleController = require('./controller/SaleController');

const app = express();
const PORT = 3000;
const staticDir = path.join(__dirname, 'static');

app.use(bodyParser.json());
app.use('/static', express.static(staticDir));

app.get('/', (req, res) => res.sendFile('index.html', { root: staticDir }));

// --- Routes ---

// Products
app.get('/api/products', ProductController.index);
app.post('/api/products', ProductController.store);
app.put('/api/products/:id', ProductController.update);
app.delete('/api/products/:id', ProductController.delete);
app.get('/api/products/search', ProductController.search);
app.get('/api/products/barcode/:barcode', ProductController.getByBarcode);
app.get('/api/categories', ProductController.getCategories);
app.get('/api/brands', ProductController.getBrands);

// Customers (Agora usa o Controller em vez de lógica inline)
app.get('/api/customers', CustomerController.index);
app.post('/api/customers', CustomerController.store);
app.put('/api/customers/:id', CustomerController.update);
app.delete('/api/customers/:id', CustomerController.delete);
app.post('/api/customers/pay', CustomerController.payDebt);
app.get('/api/customers/:id/history', CustomerController.history);

// Sales
app.post('/api/sales', SaleController.store);

// Reports (Ainda inline por ser muito simples, mas pode mover para ReportController futuramente)
app.get('/api/reports/best-customer', async (req, res) => {
    try {
        const db = require('./database');
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const row = await db.get(`
            SELECT c.id as CustomerID, c.name as Name, SUM(s.total) as TotalSpent
            FROM sales s JOIN customers c ON s.customer_id = c.id
            WHERE s.created_at >= ? GROUP BY c.id ORDER BY TotalSpent DESC LIMIT 1
        `, [startOfMonth]);
        res.json(row || {});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, '::', () => console.log(`Server running on http://localhost:${PORT}`));