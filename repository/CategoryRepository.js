const db = require('../database');

class CategoryRepository {
    async findAll() {
        const categories = await db.all(`
            SELECT c.*, GROUP_CONCAT(bc.brand_id) AS brand_ids
            FROM categories c
            LEFT JOIN brand_categories bc ON bc.category_id = c.id
            GROUP BY c.id
            ORDER BY c.name
        `);

        return categories.map(c => ({
            ...c,
            brand_ids: c.brand_ids ? c.brand_ids.split(',').map(Number) : [],
        }));
    }

    async findById(id) {
        const category = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
        if (!category) return null;

        const brands = await db.all(
            'SELECT brand_id FROM brand_categories WHERE category_id = ?',
            [id]
        );
        category.brand_ids = brands.map(b => b.brand_id);
        return category;
    }

    async create(name, brandIds = []) {
        const result = await db.run(
            'INSERT INTO categories (name) VALUES (?)',
            [name]
        );
        const categoryId = result.lastID;

        if (brandIds.length > 0) {
            await this._syncBrands(categoryId, brandIds);
        }

        return { id: categoryId, name, brand_ids: brandIds };
    }

    async update(id, name, brandIds = []) {
        await db.run('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
        await this._syncBrands(id, brandIds);
        return { id, name, brand_ids: brandIds };
    }

    async delete(id) {
        const product = await db.get(
            'SELECT id FROM products WHERE category_id = ? LIMIT 1',
            [id]
        );
        if (product) {
            throw new Error('Categoria possui produtos associados. Remova os produtos primeiro.');
        }

        await db.run('DELETE FROM brand_categories WHERE category_id = ?', [id]);
        await db.run('DELETE FROM categories WHERE id = ?', [id]);
    }

    async _syncBrands(categoryId, brandIds) {
        await db.run('DELETE FROM brand_categories WHERE category_id = ?', [categoryId]);

        for (const brandId of brandIds) {
            await db.run(
                'INSERT OR IGNORE INTO brand_categories (brand_id, category_id) VALUES (?, ?)',
                [brandId, categoryId]
            );
        }
    }
}

module.exports = new CategoryRepository();
