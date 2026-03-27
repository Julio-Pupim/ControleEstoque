'use strict';

/**
 * ProductIdentifierRepository.test.js
 *
 * Testa o repositório de identificadores de produto.
 *
 * Contratos cobertos:
 *   1. findByIdentifier(type, value)   — busca unificada por barcode ou code
 *   2. addIdentifier(product_id, type, value) — adiciona novo identificador
 *   3. findSimilarByName(name)         — busca por similaridade de nome
 *   4. listByProduct(product_id)       — todos os identificadores de um produto
 *   5. Restrição UNIQUE(type, value)   — mesmo código não aponta para 2 produtos
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDb = {
  get:  jest.fn(),
  all:  jest.fn(),
  run:  jest.fn(),
};

jest.mock('../database', () => mockDb);

const ProductIdentifierRepository = require('../repository/ProductIdentifierRepository');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const produtoExistente = {
  id:          42,
  name:        'EAU DE PARFUM MON AMIE 037, 75 ml',
  brand_id:    1,
  category_id: 3,
  price:       379,
  stock:       5,
};

const identificadoresFixture = [
  { id: 1, product_id: 42, type: 'barcode', value: '7891033130452' },
  { id: 2, product_id: 42, type: 'code',    value: '85165'         },
  { id: 3, product_id: 42, type: 'code',    value: '85165-A'       }, // código antigo
];

function resetMocks() {
  jest.clearAllMocks();
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. findByIdentifier — busca unificada
// ═════════════════════════════════════════════════════════════════════════════

describe('1. findByIdentifier(type, value)', () => {
  beforeEach(resetMocks);

  test('encontra produto por barcode', async () => {
    mockDb.get.mockResolvedValue(produtoExistente);

    const result = await ProductIdentifierRepository.findByIdentifier(
      'barcode',
      '7891033130452',
    );

    expect(result).toEqual(produtoExistente);
    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('JOIN product_identifiers'),
      ['barcode', '7891033130452'],
    );
  });

  test('encontra produto por code', async () => {
    mockDb.get.mockResolvedValue(produtoExistente);

    const result = await ProductIdentifierRepository.findByIdentifier(
      'code',
      '85165',
    );

    expect(result).toEqual(produtoExistente);
    expect(mockDb.get).toHaveBeenCalledWith(
      expect.any(String),
      ['code', '85165'],
    );
  });

  test('type e value são passados como parâmetros — nunca interpolados na query', async () => {
    mockDb.get.mockResolvedValue(null);

    await ProductIdentifierRepository.findByIdentifier('barcode', "'; DROP TABLE products; --");

    // O valor malicioso deve ir como parâmetro, não embutido na SQL
    expect(mockDb.get).toHaveBeenCalledWith(
      expect.any(String),
      ['barcode', "'; DROP TABLE products; --"],
    );
  });

  test('retorna null quando nenhum identificador corresponde', async () => {
    mockDb.get.mockResolvedValue(undefined);

    const result = await ProductIdentifierRepository.findByIdentifier(
      'barcode',
      '0000000000000',
    );

    expect(result).toBeNull();
  });

  test('retorna dados do produto (JOIN com products)', async () => {
    mockDb.get.mockResolvedValue(produtoExistente);

    const result = await ProductIdentifierRepository.findByIdentifier(
      'code',
      '85165',
    );

    // Deve retornar o produto, não apenas o identificador
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('price');
    expect(result).toHaveProperty('stock');
  });

  test('produto encontrado por código antigo retorna o mesmo produto', async () => {
    mockDb.get.mockResolvedValue(produtoExistente);

    const result = await ProductIdentifierRepository.findByIdentifier(
      'code',
      '85165-A', // código antigo
    );

    expect(result?.id).toBe(42); // mesmo produto
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. addIdentifier — adiciona novo identificador
// ═════════════════════════════════════════════════════════════════════════════

describe('2. addIdentifier(product_id, type, value)', () => {
  beforeEach(resetMocks);

  test('insere novo barcode para produto existente', async () => {
    mockDb.run.mockResolvedValue({ lastID: 10, changes: 1 });

    const result = await ProductIdentifierRepository.addIdentifier(
      42,
      'barcode',
      '7891033199999',
    );

    expect(result.ok).toBe(true);
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT'),
      [42, 'barcode', '7891033199999'],
    );
  });

  test('insere novo code para produto existente', async () => {
    mockDb.run.mockResolvedValue({ lastID: 11, changes: 1 });

    const result = await ProductIdentifierRepository.addIdentifier(
      42,
      'code',
      '99999',
    );

    expect(result.ok).toBe(true);
  });

  test('retorna ok: false quando identificador já existe para outro produto (UNIQUE violation)', async () => {
    mockDb.run.mockRejectedValue({ message: 'UNIQUE constraint failed' });

    const result = await ProductIdentifierRepository.addIdentifier(
      99, // produto diferente
      'barcode',
      '7891033130452', // barcode que já pertence ao produto 42
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/já existe/i);
  });

  test('INSERT OR IGNORE permite re-adicionar o mesmo identificador ao mesmo produto sem erro', async () => {
    // Mesmo identificador, mesmo produto → deve ser silencioso (INSERT OR IGNORE)
    mockDb.run.mockResolvedValue({ lastID: 0, changes: 0 }); // changes: 0 = ignorado

    const result = await ProductIdentifierRepository.addIdentifier(
      42,
      'barcode',
      '7891033130452',
    );

    expect(result.ok).toBe(true); // idempotente — não é um erro
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. findSimilarByName — busca por similaridade para resolução de conflito
// ═════════════════════════════════════════════════════════════════════════════

describe('3. findSimilarByName(name)', () => {
  beforeEach(resetMocks);

  test('retorna candidatos quando nome é similar', async () => {
    mockDb.all.mockResolvedValue([produtoExistente]);

    const result = await ProductIdentifierRepository.findSimilarByName(
      'EAU DE PARFUM MON AMIE 037',
    );

    expect(result).toHaveLength(1);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('LIKE'),
      expect.arrayContaining([expect.stringContaining('eau de parfum')]),
    );
  });

  test('retorna no máximo 5 candidatos', async () => {
    mockDb.all.mockResolvedValue(Array(5).fill(produtoExistente));

    const result = await ProductIdentifierRepository.findSimilarByName('PARFUM');

    expect(result.length).toBeLessThanOrEqual(5);
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT 5'),
      expect.any(Array),
    );
  });

  test('retorna array vazio quando não há similaridade', async () => {
    mockDb.all.mockResolvedValue([]);

    const result = await ProductIdentifierRepository.findSimilarByName(
      'PRODUTO INEXISTENTE XYZ 999',
    );

    expect(result).toEqual([]);
  });

  test('busca ignora capitalização', async () => {
    mockDb.all.mockResolvedValue([produtoExistente]);

    await ProductIdentifierRepository.findSimilarByName('eau de parfum mon amie');

    // SQLite LIKE é case-insensitive para ASCII — a query deve usar LIKE com %termo%
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('LIKE'),
      expect.arrayContaining([expect.stringMatching(/%eau de parfum mon amie%/i)]),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. listByProduct — todos os identificadores de um produto
// ═════════════════════════════════════════════════════════════════════════════

describe('4. listByProduct(product_id)', () => {
  beforeEach(resetMocks);

  test('retorna todos os identificadores do produto', async () => {
    mockDb.all.mockResolvedValue(identificadoresFixture);

    const result = await ProductIdentifierRepository.listByProduct(42);

    expect(result).toHaveLength(3);
    expect(result.map(i => i.type)).toEqual(
      expect.arrayContaining(['barcode', 'code', 'code']),
    );
  });

  test('retorna array vazio para produto sem identificadores', async () => {
    mockDb.all.mockResolvedValue([]);

    const result = await ProductIdentifierRepository.listByProduct(999);

    expect(result).toEqual([]);
  });

  test('filtra apenas identificadores do product_id solicitado', async () => {
    mockDb.all.mockResolvedValue(identificadoresFixture);

    await ProductIdentifierRepository.listByProduct(42);

    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE'),
      [42],
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. Integração com NF-e — fluxo de código novo não encontrado
// ═════════════════════════════════════════════════════════════════════════════

describe('5. Fluxo NF-e — código novo não encontrado', () => {
  beforeEach(resetMocks);

  /**
   * Simula o fluxo do NFeController quando recebe um código desconhecido:
   *   1. findByIdentifier → null (código não existe)
   *   2. findSimilarByName → encontra candidatos
   *   3. Usuário escolhe vincular → addIdentifier
   *   4. Próximo NF-e → findByIdentifier resolve direto
   */
  test('código novo não encontrado retorna candidatos por nome para o preview', async () => {
    // Passo 1: código 99999 não existe
    mockDb.get.mockResolvedValue(undefined);
    const byIdentifier = await ProductIdentifierRepository.findByIdentifier(
      'code',
      '99999',
    );
    expect(byIdentifier).toBeNull();

    // Passo 2: busca por similaridade de nome
    mockDb.all.mockResolvedValue([produtoExistente]);
    const candidatos = await ProductIdentifierRepository.findSimilarByName(
      'EAU DE PARFUM MON AMIE 037 75ML',
    );
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].id).toBe(42);
  });

  test('após vincular, código novo resolve o produto correto', async () => {
    // Passo 3: usuário vincula 99999 ao produto 42
    mockDb.run.mockResolvedValue({ lastID: 20, changes: 1 });
    const vinculo = await ProductIdentifierRepository.addIdentifier(42, 'code', '99999');
    expect(vinculo.ok).toBe(true);

    // Passo 4: próximo NF-e com código 99999 resolve direto
    mockDb.get.mockResolvedValue(produtoExistente);
    const encontrado = await ProductIdentifierRepository.findByIdentifier('code', '99999');
    expect(encontrado?.id).toBe(42);
  });
});
