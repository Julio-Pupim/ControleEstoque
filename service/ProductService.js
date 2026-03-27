'use strict';

const ProductIdentifierRepo = require('../repository/ProductIdentifierRepository');

async function findExistingProduct(p) {
  if (p.barcode) {
    const product = await ProductIdentifierRepo.findByIdentifier('barcode', p.barcode);
    if (product) return { product, matchedBy: 'barcode', candidates: [] };
  }
 
  if (p.code) {
    const product = await ProductIdentifierRepo.findByIdentifier('code', p.code);
    if (product) return { product, matchedBy: 'code', candidates: [] };
  }
 
  const candidates = p.name
    ? await ProductIdentifierRepo.findSimilarByName(p.name)
    : [];
 
  return { product: null, matchedBy: null, candidates };
}


module.exports = { findExistingProduct };