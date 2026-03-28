'use strict';

const mockStmt = { run: jest.fn(), finalize: jest.fn() };

const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
  raw: {
    serialize: jest.fn((fn) => fn()),
    run: jest.fn((sql, paramsOrCb, cb) => {
      if (typeof paramsOrCb === 'function') paramsOrCb(null);
      else if (typeof cb === 'function') cb(null);
    }),
    prepare: jest.fn(() => mockStmt),
  },
};

jest.mock('../database', () => mockDb);

const SaleController = require('../controller/SaleController');

function mockReqRes(body = {}) {
  return {
    req: { body },
    res: {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Make stmtSale.run call callback with `this.lastID`
  mockStmt.run.mockImplementation(function (...args) {
    const cb = args[args.length - 1];
    if (typeof cb === 'function') cb.call({ lastID: 1 }, null);
  });
});

describe('SaleController.store', () => {
  test('snapshot do custo do produto no sale_items', async () => {
    const product = { id: 10, name: 'Produto', price: 100, cost: 40, stock: 5 };
    mockDb.get.mockResolvedValue(product);

    const { req, res } = mockReqRes({
      customer_id: 1,
      items: [{ product_id: 10, quantity: 2 }],
      discount: 0,
    });

    await SaleController.store(req, res);

    // Verifica que o prepare inclui cost
    expect(mockDb.raw.prepare).toHaveBeenCalledWith(
      expect.stringContaining('cost'),
    );

    // Verifica que stmtItem.run recebe o custo
    const itemRunCalls = mockStmt.run.mock.calls.filter(
      (call) => call.length === 5 || (call.length >= 4 && typeof call[call.length - 1] !== 'function')
    );
    expect(itemRunCalls.length).toBeGreaterThan(0);
    // O custo (40) deve estar nos argumentos
    const itemCall = itemRunCalls[0];
    expect(itemCall).toContain(40);
  });

  test('usa cost 0 quando produto não tem custo', async () => {
    const product = { id: 10, name: 'Produto', price: 100, stock: 5 };
    mockDb.get.mockResolvedValue(product);

    const { req, res } = mockReqRes({
      customer_id: 1,
      items: [{ product_id: 10, quantity: 1 }],
      discount: 0,
    });

    await SaleController.store(req, res);

    const itemRunCalls = mockStmt.run.mock.calls.filter(
      (call) => call.length === 5 || (call.length >= 4 && typeof call[call.length - 1] !== 'function')
    );
    expect(itemRunCalls.length).toBeGreaterThan(0);
    const itemCall = itemRunCalls[0];
    expect(itemCall).toContain(0);
  });
});
