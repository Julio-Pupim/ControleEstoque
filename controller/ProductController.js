const ProductRepo = require('../repository/ProductRepository');

class ProductController {
    async index(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search || '';
            const category_id = req.query.category_id || null;
            const offset = (page - 1) * limit;

            const { data, total } = await ProductRepo.findAll({ limit, offset, search, category_id });
            res.json({
                data,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total
                }
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    async store(req, res) {
        try {
            const product = await ProductRepo.create(req.body);
            res.status(201).json(product);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    async update(req, res) {
        try {
            await ProductRepo.update(req.params.id, req.body);
            res.json({ message: "Updated" });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    async delete(req, res) {
        try {
            await ProductRepo.delete(req.params.id);
            res.json({ message: "Deleted" });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    async search(req, res) {
        try {
            const products = await ProductRepo.search(req.query.q || '');
            res.json(products);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    async getByBarcode(req, res) {
        try {
            const product = await ProductRepo.findByIdentifier('barcode', req.params.barcode);
            if (!product) return res.status(404).json({ status: 404, error: "Not found" });
            res.json(product);
        } catch (err) {
            res.status(500).json({ status: 500, error: err.message });
        }
    }
    async getByCode(req, res) {
    try {
      const product = await ProductRepo.findByIdentifier('code', req.params.code);
      if (!product) return res.status(404).json({ status: 404, error: 'Not found' });
      res.json(product);
    } catch (err) { res.status(500).json({ status: 500, error: err.message }); }
  }
    async getCategories(req, res) {
        try {
            const brandId = req.query.brand_id;
            const categories = await ProductRepo.getAllCategories(brandId);
            res.json(categories);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    async getBrands(req, res) {
        try {
            const brands = await ProductRepo.getAllBrands();
            res.json(brands);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new ProductController();