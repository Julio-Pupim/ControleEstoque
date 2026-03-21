'use strict';

const { parseNFe }              = require('../services/NFeParser');
const { findExistingProduct }   = require('../services/ProductLookup');
const { resolveProductDefaults } = require('../services/NFeResolver');
const ProductRepo               = require('../repository/ProductRepository');

class NFeController {

  async preview(req, res) {
    try {
      const { xml } = req.body;
      if (!xml) return res.status(400).json({ error: 'Campo "xml" não informado' });

      const parsed = parseNFe(xml);

      // Carrega categorias e marcas uma única vez para toda a NF-e
      const [allCategories, allBrands] = await Promise.all([
        ProductRepo.getAllCategories(),
        ProductRepo.getAllBrands(),
      ]);

      const products = await Promise.all(parsed.products.map(async (p) => {
        const existing = await findExistingProduct(p, ProductRepo);
        const defaults  = resolveProductDefaults(p, allCategories, allBrands);

        return {
          ...p,
          ...defaults,
          action: existing ? 'update_stock' : 'create',
          existingProduct: existing
            ? { id: existing.id, name: existing.name, stock: existing.stock, price: existing.price }
            : null,
          matchedBy: existing
            ? (p.barcode && existing.barcode === p.barcode ? 'barcode' : 'code')
            : null,
        };
      }));

      res.json({ ...parsed, products });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async importProducts(req, res) {
    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Nenhum produto para importar' });
    }

    const results = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (const p of products) {
      try {
        if (p.action === 'skip')         { results.skipped++; continue; }
        if (p.action === 'update_stock') { await this._updateStock(p); results.updated++; continue; }
        if (p.action === 'create')       { await this._createProduct(p); results.created++; continue; }
        results.errors.push({ product: p.name, error: `Ação desconhecida: ${p.action}` });
      } catch (err) {
        results.errors.push({ product: p.name, error: err.message });
      }
    }

    res.status(results.errors.length > 0 ? 207 : 201).json(results);
  }

  async _updateStock(p) {
    if (!p.existingProduct?.id) throw new Error(`ID não informado para: ${p.name}`);
    const existing = await ProductRepo.findById(p.existingProduct.id);
    if (!existing) throw new Error(`Produto não encontrado: ${p.name}`);

    const updated = { ...existing, stock: existing.stock + Math.floor(p.quantity) };
    if (p.updatePrice && p.salePrice > 0) updated.price = parseFloat(p.salePrice);
    await ProductRepo.update(existing.id, updated);
  }

  async _createProduct(p) {
    if (!p.brand_id)    throw new Error(`Marca não selecionada para: ${p.name}`);
    if (!p.category_id) throw new Error(`Categoria não selecionada para: ${p.name}`);
    const salePrice = parseFloat(p.salePrice);
    if (!salePrice || salePrice <= 0) throw new Error(`Preço inválido para: ${p.name}`);

    await ProductRepo.create({
      barcode:     p.barcode    || null,
      code:        p.code       || '',
      name:        p.name,
      brand_id:    p.brand_id,
      category_id: p.category_id,
      price:       salePrice,
      stock:       Math.floor(p.quantity),
    });
  }
}

module.exports = new NFeController();