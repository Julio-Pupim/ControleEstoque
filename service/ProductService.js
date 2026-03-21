'use strict';


async function findExistingProduct(p, repo) {
  if (p.barcode) {
    const byBarcode = await repo.findByBarcode(p.barcode);
    if (byBarcode) return byBarcode;
  }

  if (p.code) {
    return await repo.findByCode(p.code);
  }

  return null;
}

module.exports = { findExistingProduct };