const db = require('../database');

class ProductRepository {
    async findAll({ limit, offset, search, category_id }) {
        let query = `SELECT p.*, b.name as brand_name, c.name as category_name 
            FROM products p
            JOIN brands b ON p.brand_id = b.id
            JOIN categories c ON p.category_id = c.id
            WHERE 1=1`;
        let params = [];

        let countQueryPart = "";

        if (search) {
            const where = " AND (p.name LIKE ? OR p.barcode LIKE ? OR p.code LIKE ?)";
            query += where;
            countQueryPart += where;
            params = [`%${search}%`, `%${search}%`, `%${search}%`];
        }
        if (category_id) {
            query += " AND p.category_id = ?";
            params.push(category_id);
        }

        query += " ORDER BY p.name LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const data = await db.all(query, params);
        const formattedData = data.map(p => ({
            ...p,
            brand: p.brand_name,     // Visual
            category: p.category_name // Visual
        }));

        let countSql = `SELECT COUNT(*) as total FROM products p JOIN brands b ON p.brand_id = b.id WHERE 1=1`;
        if (search) countSql += " AND (p.name LIKE ? OR p.barcode LIKE ? OR p.code LIKE ? OR b.name LIKE ?)";
        if (category_id) countSql += " AND p.category_id = " + category_id;
        const countResult = await db.get(countSql, search ? params.slice(0, 4) : []);

        return { data: formattedData, total: countResult.total };
    }

    async findById(id) {
        return await db.get("SELECT * FROM products WHERE id = ?", [id]);
    }

     async findByBarcode(barcode) {
    if (!barcode) return null;
    return await db.get('SELECT * FROM products WHERE barcode = ?', [barcode]);
  }
 
    async findByCode(code) {
        if (!code) return null;
        return await db.get('SELECT * FROM products WHERE code = ?', [code]);
    }

    async search(term) {
        return await db.all(
            "SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? OR code LIKE ? LIMIT 10",
            [`%${term}%`, `%${term}%`, `%${term}%`]
        );
    }

    async create(product) {
        const { barcode, code, name, brand_id, category_id, price, stock } = product;
        const result = await db.run(
        'INSERT INTO products (barcode, code, name, brand_id, category_id, price, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [barcode || null, code || '', name, brand_id, category_id, price, stock]
    );
    return { id: result.lastID, ...product };
  }
 
    async update(id, product) {
        const { barcode, code, name, brand_id, category_id, price, stock } = product;
        await db.run(
        'UPDATE products SET barcode = ?, code = ?, name = ?, brand_id = ?, category_id = ?, price = ?, stock = ? WHERE id = ?',
        [barcode || null, code || '', name, brand_id, category_id, price, stock, id]
    );
    return { id, ...product };
  }
    async delete(id) {
        return await db.run(`DELETE FROM products WHERE id = ?`, [id]);
    }

    async getAllCategories(brandId = null) {
        if (brandId) {
            return db.all(
                `SELECT c.* FROM categories c
                 JOIN brand_categories bc ON c.id = bc.category_id
                 WHERE bc.brand_id = ?
                 ORDER BY c.name`,
                [brandId]
            );
        }
        return db.all("SELECT * FROM categories ORDER BY name");
    }

    async getAllBrands() { return db.all("SELECT * FROM brands ORDER BY name"); }
}

module.exports = new ProductRepository();