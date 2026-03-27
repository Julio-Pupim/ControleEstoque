const db = require('../database');
const ProductIdentifierRepository = require('./ProductIdentifierRepository');

const EFFECTIVE_PRICE_QUERY = `
  SELECT
    p.*,
    b.name  AS brand,
    c.name  AS category,
    COALESCE(pcp.promo_price, p.price) AS effective_price
  FROM products p
  LEFT JOIN brands b    ON b.id = p.brand_id
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN product_cycle_prices pcp ON pcp.product_id = p.id
  LEFT JOIN cycles cy
         ON cy.id = pcp.cycle_id
        AND DATE('now') BETWEEN cy.start_date AND cy.end_date
`;

class ProductRepository {
    async findAll({ limit, offset, search, category_id }) {
        let where  = 'WHERE 1=1';
        let params = [];

        if (search) {
            where  += ' AND (p.name LIKE ? OR p.barcode LIKE ? OR p.code LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (category_id) {
            where  += ' AND p.category_id = ?';
            params.push(category_id);
        }
        const data = await db.all(
            `${EFFECTIVE_PRICE_QUERY} ${where} ORDER BY p.name LIMIT ? OFFSET ?`,
            [...params, limit, offset],
        );

        let countSql    = `SELECT COUNT(*) AS total FROM products p WHERE 1=1`;
        let countParams = [];
        if (search) {
        countSql += ' AND (p.name LIKE ? OR p.barcode LIKE ? OR p.code LIKE ?)';
        countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (category_id) {
            countSql += ` AND p.category_id = ${parseInt(category_id)}`;
        }
        const countResult = await db.get(countSql, countParams);
 
    return { data, total: countResult.total };
    }

    async findById(id) {
        const row = await db.get(`${EFFECTIVE_PRICE_QUERY} WHERE p.id = ?`,[id]);
        return row ?? null;
    }
    async findByIdentifier(type, value) {
        return ProductIdentifierRepository.findByIdentifier(type, value);
    }    
    
    async search(term) {
        return db.all(
      `${EFFECTIVE_PRICE_QUERY}
        WHERE p.name    LIKE ?
          OR p.barcode LIKE ?
          OR p.code    LIKE ?
        LIMIT 10`,
      [`%${term}%`, `%${term}%`, `%${term}%`],
    );
}
    async create(product) {
        const { barcode, code, name, brand_id, category_id, price, stock } = product;

        const result = await db.run(
            'INSERT INTO products (barcode, code, name, brand_id, category_id, price, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [barcode ?? null, code ?? '', name, brand_id, category_id, price, stock],
        );
        const product_id = result.lastID;
        await this._syncIdentifiers(product_id, barcode, code);

        return { id: product_id, ...product };
    }
 
    async update(id, product) {
        const { barcode, code, name, brand_id, category_id, price, stock } = product;
        await db.run(
            'UPDATE products SET barcode = ?, code = ?, name = ?, brand_id = ?, category_id = ?, price = ?, stock = ? WHERE id = ?',
            [barcode ?? null, code ?? '', name, brand_id, category_id, price, stock, id],
        );
        await this._syncIdentifiers(id, barcode, code);
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

    async _syncIdentifiers(product_id, barcode, code) {
    if (barcode) {
      await ProductIdentifierRepository.addIdentifier(product_id, 'barcode', barcode);
    }
    if (code) {
      await ProductIdentifierRepository.addIdentifier(product_id, 'code', code);
    }
  }

}

module.exports = new ProductRepository();