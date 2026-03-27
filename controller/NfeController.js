'use strict';

const { parseNFe }              = require('../service/NfeParserService');
const { findExistingProduct }   = require('../service/ProductService');
const { resolveProductDefaults } = require('../service/NfeResolver');
const ProductRepo                = require('../repository/ProductRepository');
const ProductIdentifierRepo      = require('../repository/ProductIdentifierRepository');

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
        const { product: existing, matchedBy, candidates } =
          await findExistingProduct(p);
          const defaults = resolveProductDefaults(p, allCategories, allBrands);
          const action = existing ? 'update_stock' : candidates.length > 0 ? 'resolve' : 'create';
          
        return {
          ...p,
          ...defaults,
          action,
          matchedBy,
          existingProduct: existing
            ? { id: existing.id, name: existing.name, stock: existing.stock, price: existing.price } : null,
          candidates: candidates.map(c => ({ id: c.id, name: c.name, brand: c.brand })),
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
        if (p.action === 'link')          { await this._linkIdentifier(p); results.linked++; continue; }
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
  async _linkIdentifier(p) {
    if (!p.linkToProductId) throw new Error(`Produto de destino não informado para: ${p.name}`);
 
    // Vincula o código novo ao produto existente
    if (p.barcode) {
      await ProductIdentifierRepo.addIdentifier(p.linkToProductId, 'barcode', p.barcode);
    }
    if (p.code) {
      await ProductIdentifierRepo.addIdentifier(p.linkToProductId, 'code', p.code);
    }
 
    // Atualiza o estoque após vincular
    await this._updateStock({
      ...p,
      existingProduct: { id: p.linkToProductId },
    });
  }

}

module.exports = new NFeController();