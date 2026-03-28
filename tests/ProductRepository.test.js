'use strict';

const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
};

jest.mock('../database', () => mockDb);

// Mock ProductIdentifierRepository to avoid side effects
jest.mock('../repository/ProductIdentifierRepository', () => ({
  addIdentifier: jest.fn(),
}));

const ProductRepository = require('../repository/ProductRepository');

beforeEach(() => jest.clearAllMocks());

describe('ProductRepository.create', () => {
  test('inclui cost no INSERT', async () => {
    mockDb.run.mockResolvedValue({ lastID: 1 });

    await ProductRepository.create({
      barcode: '123', code: 'ABC', name: 'Produto',
      brand_id: 1, category_id: 2, price: 50, cost: 30, stock: 10,
    });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('cost'),
      ['123', 'ABC', 'Produto', 1, 2, 50, 30, 10],
    );
  });

  test('usa cost default 0 quando não informado', async () => {
    mockDb.run.mockResolvedValue({ lastID: 2 });

    await ProductRepository.create({
      barcode: null, code: '', name: 'Sem Custo',
      brand_id: 1, category_id: 2, price: 50, stock: 5,
    });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('cost'),
      [null, '', 'Sem Custo', 1, 2, 50, 0, 5],
    );
  });
});

describe('ProductRepository.update', () => {
  test('inclui cost no UPDATE', async () => {
    mockDb.run.mockResolvedValue({});

    await ProductRepository.update(1, {
      barcode: '123', code: 'ABC', name: 'Produto',
      brand_id: 1, category_id: 2, price: 50, cost: 25, stock: 10,
    });

    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('cost'),
      ['123', 'ABC', 'Produto', 1, 2, 50, 25, 10, 1],
    );
  });
});
