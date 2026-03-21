'use strict';

/**
 * Resolve brand_id e category_id a partir dos nomes sugeridos pelo parser,
 * cruzando com as listas reais vindas do banco.
 *
 * Design intencional:
 * - Categoria renomeada/excluída no banco → suggestedCategoryId: null
 * - Marca inexistente no banco            → suggestedBrandId: null
 * - Em ambos os casos o usuário seleciona manualmente no preview
 * - Match é case-insensitive para tolerar variações de capitalização
 *
 * Função pura: sem acesso a banco, fácil de testar com mocks.
 *
 * @param {{ suggestedCategoryName: string|null, brand: string|null }} parsedProduct
 * @param {{ id: number, name: string }[]} allCategories
 * @param {{ id: number, name: string }[]} allBrands
 * @returns {{ suggestedCategoryId: number|null, suggestedBrandId: number|null }}
 */
function resolveProductDefaults(parsedProduct, allCategories, allBrands) {
  const categoryMatch = parsedProduct.suggestedCategoryName
    ? allCategories.find(
        (c) => c.name.toLowerCase() === parsedProduct.suggestedCategoryName.toLowerCase()
      )
    : null;

  const brandMatch = parsedProduct.brand
    ? allBrands.find(
        (b) => b.name.toLowerCase() === parsedProduct.brand.toLowerCase()
      )
    : null;

  return {
    suggestedCategoryId: categoryMatch ? categoryMatch.id : null,
    suggestedBrandId:    brandMatch    ? brandMatch.id    : null,
  };
}

module.exports = { resolveProductDefaults };