'use strict';

const db = require('../database');

/**
 * ProductIdentifierRepository
 *
 * Gerencia a tabela product_identifiers — fonte de verdade para
 * barcodes e códigos de produto. Um produto pode ter N identificadores
 * de cada tipo, permitindo que códigos mudem sem perder histórico.
 *
 * Métodos:
 *   findByIdentifier(type, value)      — busca unificada (substitui findByBarcode/findByCode)
 *   addIdentifier(product_id, type, value) — vincula novo código a produto existente
 *   findSimilarByName(name)            — candidatos para resolução de conflito no NF-e
 *   listByProduct(product_id)          — todos os identificadores de um produto
 */
class ProductIdentifierRepository {

  /**
   * Busca um produto pelo tipo e valor do identificador.
   * Substitui findByBarcode e findByCode — type é sempre parâmetro, nunca interpolado.
   *
   * @param {'barcode' | 'code'} type
   * @param {string} value
   * @returns {Promise<object | null>}
   */
  async findByIdentifier(type, value) {
    const row = await db.get(
      `SELECT p.*
       FROM products p
       JOIN product_identifiers pi ON pi.product_id = p.id
       WHERE pi.type = ? AND pi.value = ?
       LIMIT 1`,
      [type, value],
    );
    return row ?? null;
  }

  /**
   * Adiciona um novo identificador a um produto existente.
   * INSERT OR IGNORE: re-adicionar o mesmo par (type, value, product_id) é silencioso.
   * UNIQUE(type, value): o mesmo código não pode apontar para dois produtos diferentes.
   *
   * @param {number} product_id
   * @param {'barcode' | 'code'} type
   * @param {string} value
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async addIdentifier(product_id, type, value) {
    try {
      await db.run(
        `INSERT OR IGNORE INTO product_identifiers (product_id, type, value)
         VALUES (?, ?, ?)`,
        [product_id, type, value],
      );
      return { ok: true };
    } catch (err) {
      // UNIQUE(type, value) violado — mesmo código já pertence a outro produto
      if (err.message?.includes('UNIQUE constraint failed')) {
        return { ok: false, error: 'Identificador já existe para outro produto' };
      }
      throw err;
    }
  }

  /**
   * Busca produtos com nome similar ao termo informado.
   * Usado no preview do NF-e quando um código não é encontrado —
   * exibe candidatos para o usuário decidir se é produto novo ou recodificação.
   *
   * @param {string} name
   * @returns {Promise<object[]>}  máximo 5 resultados
   */
  async findSimilarByName(name) {
    const term = `%${name.toLowerCase()}%`;
    return db.all(
      `SELECT p.id, p.name, p.price, p.stock, b.name AS brand
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE LOWER(p.name) LIKE ?
       LIMIT 5`,
      [term],
    );
  }

  /**
   * Lista todos os identificadores de um produto.
   * Útil na tela de edição de produto para mostrar/gerenciar os códigos vinculados.
   *
   * @param {number} product_id
   * @returns {Promise<{ id, type, value }[]>}
   */
  async listByProduct(product_id) {
    return db.all(
      `SELECT id, type, value
       FROM product_identifiers
       WHERE product_id = ?
       ORDER BY type, value`,
      [product_id],
    );
  }
}

module.exports = new ProductIdentifierRepository();
