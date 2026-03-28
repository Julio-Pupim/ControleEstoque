const CategoryRepo = require('../repository/CategoryRepository');

class CategoryController {
    async index(req, res) {
        try {
            const categories = await CategoryRepo.findAll();
            res.json(categories);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    async show(req, res) {
        try {
            const category = await CategoryRepo.findById(req.params.id);
            if (!category) return res.status(404).json({ error: 'Categoria nao encontrada' });
            res.json(category);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    async store(req, res) {
        try {
            const { name, brand_ids } = req.body;
            if (!name || !name.trim()) {
                return res.status(400).json({ error: 'Nome da categoria e obrigatorio' });
            }
            const category = await CategoryRepo.create(name.trim(), brand_ids || []);
            res.status(201).json(category);
        } catch (err) {
            if (err.message?.includes('UNIQUE')) {
                return res.status(409).json({ error: 'Ja existe uma categoria com esse nome' });
            }
            res.status(500).json({ error: err.message });
        }
    }

    async update(req, res) {
        try {
            const { name, brand_ids } = req.body;
            if (!name || !name.trim()) {
                return res.status(400).json({ error: 'Nome da categoria e obrigatorio' });
            }
            const category = await CategoryRepo.update(req.params.id, name.trim(), brand_ids || []);
            res.json(category);
        } catch (err) {
            if (err.message?.includes('UNIQUE')) {
                return res.status(409).json({ error: 'Ja existe uma categoria com esse nome' });
            }
            res.status(500).json({ error: err.message });
        }
    }

    async delete(req, res) {
        try {
            await CategoryRepo.delete(req.params.id);
            res.json({ message: 'Categoria excluida' });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
}

module.exports = new CategoryController();
