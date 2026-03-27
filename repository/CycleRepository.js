'use strict';

const db = require('../database');

/**
 * CycleRepository
 *
 * Responsabilidades:
 *   - Gerenciar ciclos de promoção por marca
 *   - Vincular preços promocionais a produtos dentro de um ciclo
 *
 * Design:
 *   - findOrCreate usa INSERT OR IGNORE + SELECT para ser idempotente
 *   - linkPrice usa INSERT OR REPLACE para suportar re-importação do mesmo catálogo
 */
class CycleRepository {
  /**
   * Retorna o ciclo existente ou cria um novo.
   * Idempotente — chamar duas vezes com os mesmos dados retorna o mesmo ciclo.
   *
   * @param {{ brand_id, name, start_date, end_date }} cycle
   * @returns {Promise<{ id, brand_id, name, start_date, end_date }>}
   */
  async findOrCreate({ brand_id, name, start_date, end_date }) {
    await db.run(
      `INSERT OR IGNORE INTO cycles (brand_id, name, start_date, end_date)
       VALUES (?, ?, ?, ?)`,
      [brand_id, name, start_date, end_date],
    );

    return db.get(
      `SELECT * FROM cycles WHERE brand_id = ? AND name = ?`,
      [brand_id, name],
    );
  }

  /**
   * Vincula (ou atualiza) o preço promocional de um produto a um ciclo.
   * INSERT OR REPLACE garante que re-importar o mesmo catálogo apenas atualiza.
   *
   * @param {{ product_id, cycle_id, promo_price }} payload
   * @returns {Promise<{ ok: true }>}
   */
  async linkPrice({ product_id, cycle_id, promo_price }) {
    await db.run(
      `INSERT OR REPLACE INTO product_cycle_prices (product_id, cycle_id, promo_price)
       VALUES (?, ?, ?)`,
      [product_id, cycle_id, promo_price],
    );
    return { ok: true };
  }

  /**
   * Retorna o preço promocional ativo hoje para um produto.
   * Usado pelo ProductRepository ao buscar produto para o POS.
   *
   * @param {number} product_id
   * @returns {Promise<{ promo_price, start_date, end_date } | null>}
   */
  async getActivePriceForProduct(product_id) {
    return db.get(
      `SELECT pcp.promo_price, c.start_date, c.end_date
       FROM product_cycle_prices pcp
       JOIN cycles c ON c.id = pcp.cycle_id
       WHERE pcp.product_id = ?
         AND DATE('now') BETWEEN c.start_date AND c.end_date
       LIMIT 1`,
      [product_id],
    );
  }
}

module.exports = new CycleRepository();