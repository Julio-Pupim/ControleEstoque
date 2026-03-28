'use strict';

/**
 * ProductController.test.js
 *
 * Testes regressivos para os endpoints de busca por identificador:
 *   - GET /api/products/barcode/:barcode  → getByBarcode
 *   - GET /api/products/code/:code        → getByCode
 *
 * Bug corrigido: controller chamava findByBarcode/findByCode (inexistentes)
 * em vez de findByIdentifier(type, value).
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
};

jest.mock('../database', () => mockDb);

const ProductController = require('../controller/ProductController');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const produtoFixture = {
  id: 42,
  name: 'EAU DE PARFUM MON AMIE 037, 75 ml',
  brand_id: 1,
  category_id: 3,
  price: 379,
  stock: 5,
};

function mockReqRes(params = {}) {
  return {
    req: { params, query: {} },
    res: {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. getByBarcode
// ═════════════════════════════════════════════════════════════════════════════

describe('getByBarcode', () => {
  beforeEach(() => jest.clearAllMocks());

  test('retorna produto quando barcode existe', async () => {
    mockDb.get.mockResolvedValue(produtoFixture);
    const { req, res } = mockReqRes({ barcode: '7891033130452' });

    await ProductController.getByBarcode(req, res);

    expect(res.json).toHaveBeenCalledWith(produtoFixture);
  });

  test('retorna 404 quando barcode não existe', async () => {
    mockDb.get.mockResolvedValue(undefined);
    const { req, res } = mockReqRes({ barcode: '0000000000000' });

    await ProductController.getByBarcode(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status().json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 404 }),
    );
  });

  test('retorna 500 em erro de banco', async () => {
    mockDb.get.mockRejectedValue(new Error('DB connection lost'));
    const { req, res } = mockReqRes({ barcode: '7891033130452' });

    await ProductController.getByBarcode(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('usa findByIdentifier com type barcode (regressão)', async () => {
    mockDb.get.mockResolvedValue(produtoFixture);
    const { req, res } = mockReqRes({ barcode: '7891033130452' });

    await ProductController.getByBarcode(req, res);

    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('JOIN product_identifiers'),
      ['barcode', '7891033130452'],
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. getByCode
// ═════════════════════════════════════════════════════════════════════════════

describe('getByCode', () => {
  beforeEach(() => jest.clearAllMocks());

  test('retorna produto quando code existe', async () => {
    mockDb.get.mockResolvedValue(produtoFixture);
    const { req, res } = mockReqRes({ code: '85165' });

    await ProductController.getByCode(req, res);

    expect(res.json).toHaveBeenCalledWith(produtoFixture);
  });

  test('retorna 404 quando code não existe', async () => {
    mockDb.get.mockResolvedValue(undefined);
    const { req, res } = mockReqRes({ code: 'XXXXX' });

    await ProductController.getByCode(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status().json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 404 }),
    );
  });

  test('retorna 500 em erro de banco', async () => {
    mockDb.get.mockRejectedValue(new Error('DB connection lost'));
    const { req, res } = mockReqRes({ code: '85165' });

    await ProductController.getByCode(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('usa findByIdentifier com type code (regressão)', async () => {
    mockDb.get.mockResolvedValue(produtoFixture);
    const { req, res } = mockReqRes({ code: '85165' });

    await ProductController.getByCode(req, res);

    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('JOIN product_identifiers'),
      ['code', '85165'],
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Regressão: busca por código funciona após barcode retornar 404
// ═════════════════════════════════════════════════════════════════════════════

describe('Regressão: barcode 404 não bloqueia busca por code', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getByCode retorna produto mesmo após getByBarcode retornar 404', async () => {
    // Passo 1: barcode não encontrado
    mockDb.get.mockResolvedValue(undefined);
    const call1 = mockReqRes({ barcode: '0000000000000' });
    await ProductController.getByBarcode(call1.req, call1.res);
    expect(call1.res.status).toHaveBeenCalledWith(404);

    // Passo 2: code encontrado — deve funcionar normalmente
    mockDb.get.mockResolvedValue(produtoFixture);
    const call2 = mockReqRes({ code: '85165' });
    await ProductController.getByCode(call2.req, call2.res);

    expect(call2.res.json).toHaveBeenCalledWith(produtoFixture);
    expect(mockDb.get).toHaveBeenLastCalledWith(
      expect.stringContaining('JOIN product_identifiers'),
      ['code', '85165'],
    );
  });
});
