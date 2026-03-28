const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// Controllers
const ProductController = require('./controller/ProductController');
const CustomerController = require('./controller/CustomerController'); // Agora importamos o arquivo novo
const SaleController = require('./controller/SaleController');
const NFeController      = require('./controller/NfeController');
const CategoryController = require('./controller/CategoryController');

const app = express();
const PORT = 3000;
const staticDir = path.join(__dirname, 'static');

app.use(bodyParser.json({ limit: '5mb' }));
app.use('/static', express.static(staticDir));

app.get('/', (req, res) => res.sendFile('index.html', { root: staticDir }));

// --- Routes ---

// Products
app.get('/api/products/search',           (req, res) => ProductController.search(req, res));
app.get('/api/products/barcode/:barcode', (req, res) => ProductController.getByBarcode(req, res));
app.get('/api/products/code/:code',       (req, res) => ProductController.getByCode(req, res));
app.get('/api/products',                  (req, res) => ProductController.index(req, res));
app.post('/api/products',                 (req, res) => ProductController.store(req, res));
app.put('/api/products/:id',              (req, res) => ProductController.update(req, res));
app.delete('/api/products/:id',           (req, res) => ProductController.delete(req, res));
app.get('/api/categories',               (req, res) => ProductController.getCategories(req, res));
app.get('/api/brands',                   (req, res) => ProductController.getBrands(req, res));

// Categories CRUD
app.get('/api/categories/manage',        (req, res) => CategoryController.index(req, res));
app.get('/api/categories/manage/:id',    (req, res) => CategoryController.show(req, res));
app.post('/api/categories/manage',       (req, res) => CategoryController.store(req, res));
app.put('/api/categories/manage/:id',    (req, res) => CategoryController.update(req, res));
app.delete('/api/categories/manage/:id', (req, res) => CategoryController.delete(req, res));

// --- NF-e ---
app.post('/api/nfe/preview', (req, res) => NFeController.preview(req, res));
app.post('/api/nfe/import',  (req, res) => NFeController.importProducts(req, res));


// Customers (Agora usa o Controller em vez de lógica inline)
app.get('/api/customers',             (req, res) => CustomerController.index(req, res));
app.post('/api/customers',            (req, res) => CustomerController.store(req, res));
app.post('/api/customers/pay',        (req, res) => CustomerController.payDebt(req, res));
app.put('/api/customers/:id',         (req, res) => CustomerController.update(req, res));
app.delete('/api/customers/:id',      (req, res) => CustomerController.delete(req, res));
app.get('/api/customers/:id/history', (req, res) => CustomerController.history(req, res));

// Sales
app.post('/api/sales', (req, res) => SaleController.store(req, res));

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

app.get('/api/reports/monthly-profit', async (req, res) => {
    try {
        const db = require('./database');
        const rows = await db.all(`
            SELECT
                strftime('%Y-%m', s.created_at) AS month,
                SUM(si.price * si.quantity)     AS revenue,
                SUM(si.cost * si.quantity)      AS total_cost,
                SUM((si.price - si.cost) * si.quantity) AS profit
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            GROUP BY strftime('%Y-%m', s.created_at)
            ORDER BY month DESC
            LIMIT 12
        `);

        const result = rows.map(r => ({
            month: r.month,
            revenue: r.revenue || 0,
            totalCost: r.total_cost || 0,
            profit: r.profit || 0,
            margin: r.revenue > 0 ? ((r.profit / r.revenue) * 100).toFixed(1) : '0.0',
        }));

        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, '::', () => console.log(`Server running on http://localhost:${PORT}`));