'use strict';

const fs   = require('fs');
const path = require('path');

const { parseNFe, detectBrand, suggestCategory } = require('../service/NfeParserService');
const { findExistingProduct }                     = require('../service/ProductService');
const { resolveProductDefaults } = require('../service/NfeResolver');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RES = path.join(__dirname, 'resources');
const xml = (filename) => fs.readFileSync(path.join(RES, filename), 'utf-8');

// Mock do ProductIdentifierRepository para os testes de findExistingProduct
jest.mock('../repository/ProductIdentifierRepository', () => ({
  findByIdentifier: jest.fn(),
  findSimilarByName: jest.fn().mockResolvedValue([]),
}));
const mockIdentifierRepo = require('../repository/ProductIdentifierRepository');

const makeRepo = ({ byBarcode = null, byCode = null } = {}) => ({
  findByBarcode: jest.fn().mockResolvedValue(byBarcode),
  findByCode:    jest.fn().mockResolvedValue(byCode),
});

// Simula listas de categorias e marcas vindas do banco
const DB_CATEGORIES = [
  { id: 1,  name: 'Creme'                },
  { id: 2,  name: 'Refil'               },
  { id: 3,  name: 'Perfume'             },
  { id: 4,  name: 'Sabonete Barra'      },
  { id: 5,  name: 'Shampoo'             },
  { id: 6,  name: 'Condicionador'       },
  { id: 7,  name: 'Sabonete Líq.'       },
  { id: 8,  name: 'Desodorante Roll-on' },
  { id: 9,  name: 'Desodorante Spray'   },
  { id: 10, name: 'Trufa'               },
  { id: 11, name: 'Barra de Chocolate'  },
  { id: 12, name: 'Barrinha de Chocolate' },
  { id: 13, name: 'Tablete de Chocolate' },
  { id: 14, name: 'Ovo de Páscoa'       },
  { id: 15, name: 'Panettone'           },
];

const DB_BRANDS = [
  { id: 1, name: 'Natura'      },
  { id: 2, name: 'Eudora'      },
  { id: 3, name: 'O Boticário' },
  { id: 4, name: 'Mary Kay'    },
  { id: 5, name: 'Avon'        },
  { id: 6, name: 'De Millus'   },
  { id: 7, name: 'Cacau Show'  },
];

// ─── detectBrand ──────────────────────────────────────────────────────────────

describe('detectBrand', () => {
  test.each([
    ['Natura Cosméticos S/A',               'Natura'],
    ['BOTICARIO PRODUTOS DE BELEZA LTDA',   'O Boticário'],
    ['MARY KAY DO BRASIL LTDA',             'Mary Kay'],
    ['DE MILLUS S.A. INDUSTRIA E COMERCIO', 'De Millus'],
    ['Avon Cosméticos Ltda',                'Avon'],
    ['EUDORA COSMÉTICOS',                   'Eudora'],
    ['Cacau Show Ltda',                     'Cacau Show'],
  ])('fabricante direto: "%s" → "%s"', (emitter, expected) => {
    expect(detectBrand(emitter)).toBe(expected);
  });

  test('franqueado Cacau Show: "SHOW COMERCIO DE DOCES LTDA ME" → "Cacau Show"', () => {
    expect(detectBrand('SHOW COMERCIO DE DOCES LTDA ME')).toBe('Cacau Show');
  });

  test('variações do padrão franqueado Cacau Show', () => {
    expect(detectBrand('show comercio de doces ltda')).toBe('Cacau Show');
    expect(detectBrand('SHOW COMÉRCIO DE DOCES EIRELI')).toBe('Cacau Show');
  });

  test('retorna null para emissora desconhecida', () => {
    expect(detectBrand('MERCADO PADRAO LTDA')).toBeNull();
    expect(detectBrand('DISTRIBUIDORA GENERICA SA')).toBeNull();
  });

  test('é case-insensitive', () => {
    expect(detectBrand('natura cosmeticos')).toBe('Natura');
    expect(detectBrand('NATURA COSMETICOS')).toBe('Natura');
  });
});

// ─── suggestCategory ──────────────────────────────────────────────────────────

describe('suggestCategory — retorna nome canônico para o banco resolver', () => {
  test.each([
    ['33051000', 'Shampoo'],
    ['33059000', 'Condicionador'],
    ['33072010', 'Desodorante Roll-on'],
    ['33072020', 'Desodorante Spray'],
    ['33072090', 'Desodorante Roll-on'],
    ['18063210', 'Tablete de Chocolate'],
    ['18069000', 'Ovo de Páscoa'],
    ['17049010', 'Ovo de Páscoa'],
    ['19052010', 'Panettone'],
    ['33030020', 'Perfume'],
    ['34011190', 'Sabonete Barra'],
    ['34013000', 'Sabonete Líq.'],
    ['33049910', 'Creme'],
    ['33049990', 'Creme'],
    ['33041000', 'Creme'],
    ['33042010', 'Creme'],
  ])('NCM %s → "%s"', (ncm, expected) => {
    expect(suggestCategory(ncm)).toBe(expected);
  });

  test.each([
    ['62121000', 'sutiã/lingerie (De Millus)'],
    ['61082200', 'calcinha/roupa íntima (De Millus)'],
    ['96081000', 'caneta/brinde (Natura)'],
    ['48194000', 'sacola de papel (Boticário)'],
    ['39241000', 'saboneteira plástica (Natura)'],
    ['42022220', 'bolsa/acessório (Mary Kay)'],
    ['42022900', 'cordão de celular (Mary Kay)'],
    ['49111090', 'revista/catálogo'],
    ['99999999', 'NCM genérico desconhecido'],
  ])('retorna null para NCM fora do mapeamento: %s (%s)', (ncm) => {
    expect(suggestCategory(ncm)).toBeNull();
  });
});

// ─── resolveProductDefaults ───────────────────────────────────────────────────

describe('resolveProductDefaults — resolução nome→ID contra banco', () => {
  test('resolve categoria e marca quando ambas existem no banco', () => {
    const result = resolveProductDefaults(
      { suggestedCategoryName: 'Shampoo', brand: 'Natura' },
      DB_CATEGORIES,
      DB_BRANDS
    );
    expect(result.suggestedCategoryId).toBe(5);  // id de Shampoo
    expect(result.suggestedBrandId).toBe(1);     // id de Natura
  });

  test('retorna null para categoria se nome não existe no banco (renomeada/excluída)', () => {
    const categoriasSemShampoo = DB_CATEGORIES.filter(c => c.name !== 'Shampoo');
    const result = resolveProductDefaults(
      { suggestedCategoryName: 'Shampoo', brand: 'Natura' },
      categoriasSemShampoo,
      DB_BRANDS
    );
    expect(result.suggestedCategoryId).toBeNull();
    expect(result.suggestedBrandId).toBe(1); // marca ainda resolve
  });

  test('retorna null para marca se não existe no banco', () => {
    const result = resolveProductDefaults(
      { suggestedCategoryName: 'Creme', brand: 'Marca Inexistente' },
      DB_CATEGORIES,
      DB_BRANDS
    );
    expect(result.suggestedCategoryId).toBe(1);  // id de Creme
    expect(result.suggestedBrandId).toBeNull();
  });

  test('retorna null em ambos quando NCM e emissora são desconhecidos', () => {
    const result = resolveProductDefaults(
      { suggestedCategoryName: null, brand: null },
      DB_CATEGORIES,
      DB_BRANDS
    );
    expect(result.suggestedCategoryId).toBeNull();
    expect(result.suggestedBrandId).toBeNull();
  });

  test('match é case-insensitive', () => {
    const result = resolveProductDefaults(
      { suggestedCategoryName: 'shampoo', brand: 'natura' },
      DB_CATEGORIES,
      DB_BRANDS
    );
    expect(result.suggestedCategoryId).toBe(5);
    expect(result.suggestedBrandId).toBe(1);
  });

  test('Cacau Show resolve corretamente após detecção de franqueado', () => {
    const result = resolveProductDefaults(
      { suggestedCategoryName: 'Ovo de Páscoa', brand: 'Cacau Show' },
      DB_CATEGORIES,
      DB_BRANDS
    );
    expect(result.suggestedCategoryId).toBe(14); // id de Ovo de Páscoa
    expect(result.suggestedBrandId).toBe(7);     // id de Cacau Show
  });

  test('categoria adicionada no banco passa a ser resolvida automaticamente', () => {
    // Simula que alguém adicionou "Hidratante Corporal" ao banco
    const categoriesComNova = [...DB_CATEGORIES, { id: 99, name: 'Hidratante Corporal' }];
    const result = resolveProductDefaults(
      { suggestedCategoryName: 'Hidratante Corporal', brand: null },
      categoriesComNova,
      DB_BRANDS
    );
    expect(result.suggestedCategoryId).toBe(99);
  });
});

// ─── parseNFe com arquivos reais ──────────────────────────────────────────────

describe('parseNFe — Mary Kay (27 produtos, NF 5629321)', () => {
  let result;
  beforeAll(() => { result = parseNFe(xml('nfe-marykay-27produtos.xml')); });

  test('detecta emissora, CNPJ com zeros à esquerda e marca', () => {
    expect(result.emitter.name).toBe('MARY KAY DO BRASIL LTDA');
    expect(result.emitter.cnpj).toBe('00223046000412');
    expect(result.emitter.detectedBrand).toBe('Mary Kay');
    expect(result.nfeNumber).toBe('5629321');
  });

  test('extrai todos os 27 produtos', () => {
    expect(result.products).toHaveLength(27);
  });

  test('primeiro produto: batom cremoso → suggestedCategoryName Creme', () => {
    const p = result.products[0];
    expect(p.barcode).toBe('7899594001219');
    expect(p.code).toBe('10022954');
    expect(p.name).toBe('SHELL BATOM CREMOSO');
    expect(p.costPrice).toBe(26.45);
    expect(p.quantity).toBe(1);
    expect(p.ncm).toBe('33041000');
    expect(p.suggestedCategoryName).toBe('Creme');
    expect(p.brand).toBe('Mary Kay');
  });

  test('segundo produto: hidratante noturno → suggestedCategoryName Creme', () => {
    const p = result.products[1];
    expect(p.barcode).toBe('7899594000823');
    expect(p.name).toBe('HIDRATANTE NOTURNO EXTRA EMOLIENTE');
    expect(p.costPrice).toBe(34.32);
    expect(p.ncm).toBe('33049910');
    expect(p.suggestedCategoryName).toBe('Creme');
  });

  test('todos os produtos herdam a marca Mary Kay', () => {
    expect(result.products.every(p => p.brand === 'Mary Kay')).toBe(true);
  });

  test('24 produtos com barcode e 3 sem (bolsa, cordão, revista)', () => {
    const comBarcode = result.products.filter(p => p.barcode !== null);
    const semBarcode = result.products.filter(p => p.barcode === null);
    expect(comBarcode).toHaveLength(24);
    expect(semBarcode).toHaveLength(3);
    const nomesSemBarcode = semBarcode.map(p => p.name);
    expect(nomesSemBarcode).toContain('BOLSA EMBRACE');
    expect(nomesSemBarcode).toContain('CORDAO DE CELULAR EMBRACE');
  });
});

describe('parseNFe — De Millus (9 produtos, NF 21447752)', () => {
  let result;
  beforeAll(() => { result = parseNFe(xml('nfe-demillus-9produtos.xml')); });

  test('detecta emissora e marca', () => {
    expect(result.emitter.name).toBe('DE MILLUS S.A. INDUSTRIA E COMERCIO');
    expect(result.emitter.detectedBrand).toBe('De Millus');
    expect(result.nfeNumber).toBe('21447752');
  });

  test('extrai os 9 produtos', () => {
    expect(result.products).toHaveLength(9);
  });

  test('sutiã: cProd com zero à esquerda preservado, NCM de lingerie sem sugestão', () => {
    const p = result.products[0];
    expect(p.barcode).toBe('7891351617923');
    expect(p.code).toBe('064791');     // zero à esquerda preservado
    expect(p.name).toBe('SUTIA ANARY');
    expect(p.costPrice).toBe(39.11);
    expect(p.quantity).toBe(1);
    expect(p.ncm).toBe('62121000');
    expect(p.suggestedCategoryName).toBeNull(); // lingerie não tem categoria no sistema
  });
});

describe('parseNFe — Boticário (10 produtos, NF 139236)', () => {
  let result;
  beforeAll(() => { result = parseNFe(xml('nfe-boticario-10produtos.xml')); });

  test('detecta marca O Boticário', () => {
    expect(result.emitter.detectedBrand).toBe('O Boticário');
    expect(result.nfeNumber).toBe('139236');
    expect(result.products).toHaveLength(10);
  });

  test('produto [0]: perfume → Perfume', () => {
    const p = result.products[0];
    expect(p.barcode).toBe('7891033517886');
    expect(p.name).toBe('CJ FLAC OUI EDP JD/GRASSE ROSE 3x1ml');
    expect(p.ncm).toBe('33030020');
    expect(p.suggestedCategoryName).toBe('Perfume');
  });

  test('produto [3]: condicionador (NCM 33059000) → Condicionador', () => {
    const p = result.products[3];
    expect(p.name).toBe('CJ SCH SIAGE RESIST ANTIQ SH/C/M 3x7ml');
    expect(p.ncm).toBe('33059000');
    expect(p.suggestedCategoryName).toBe('Condicionador');
    expect(p.quantity).toBe(7);
  });

  test('produto [4]: desodorante colônia (NCM 33072010) → Desodorante Roll-on, qty 3', () => {
    const p = result.products[4];
    expect(p.name).toBe('UOMINI DES COL V6 100ml');
    expect(p.ncm).toBe('33072010');
    expect(p.suggestedCategoryName).toBe('Desodorante Roll-on');
    expect(p.quantity).toBe(3);
    expect(p.costPrice).toBe(69.97);
  });

  test('produto [9]: sacola de papel → sem sugestão de categoria', () => {
    const p = result.products[9];
    expect(p.name).toBe('SACOLA P BOTICARIO INST/25');
    expect(p.ncm).toBe('48194000');
    expect(p.suggestedCategoryName).toBeNull();
  });
});

describe('parseNFe — Show Comércio / Cacau Show (9 produtos SEM GTIN, NF 3048)', () => {
  let result;
  beforeAll(() => { result = parseNFe(xml('nfe-showcomercio-9produtos-semgtin.xml')); });

  test('emissora franqueada detectada como Cacau Show', () => {
    expect(result.emitter.name).toBe('SHOW COMERCIO DE DOCES LTDA ME');
    expect(result.emitter.detectedBrand).toBe('Cacau Show');
    expect(result.nfeNumber).toBe('3048');
  });

  test('extrai os 9 produtos', () => {
    expect(result.products).toHaveLength(9);
  });

  test('TODOS os produtos têm barcode null (SEM GTIN)', () => {
    expect(result.products.every(p => p.barcode === null)).toBe(true);
  });

  test('TODOS os produtos têm código interno preenchido', () => {
    expect(result.products.every(p => p.code && p.code.length > 0)).toBe(true);
  });

  test('produto [0]: tablete → NCM 18063210 → Tablete de Chocolate', () => {
    const p = result.products[0];
    expect(p.barcode).toBeNull();
    expect(p.code).toBe('1002638');
    expect(p.name).toBe('TABLETE LACREME AO LEITE 100G');
    expect(p.quantity).toBe(20);
    expect(p.costPrice).toBe(16.606);
    expect(p.ncm).toBe('18063210');
    expect(p.suggestedCategoryName).toBe('Tablete de Chocolate');
  });

  test('produto [1]: ovo de páscoa → NCM 18069000 → Ovo de Páscoa', () => {
    const p = result.products[1];
    expect(p.name).toBe('OVO 348 LACREME AO LEITE');
    expect(p.ncm).toBe('18069000');
    expect(p.suggestedCategoryName).toBe('Ovo de Páscoa');
  });

  test('produto [6]: panettone → NCM 19052010 → Panettone', () => {
    const p = result.products[6];
    expect(p.name).toBe('PANE PASQUALE 450 DOCE DE LEITE');
    expect(p.ncm).toBe('19052010');
    expect(p.suggestedCategoryName).toBe('Panettone');
  });

  test('todos os produtos herdam a marca Cacau Show', () => {
    expect(result.products.every(p => p.brand === 'Cacau Show')).toBe(true);
  });

  test('integração: resolveProductDefaults resolve Cacau Show + Ovo de Páscoa', () => {
    const p = result.products[1]; // OVO 348 LACREME
    const resolved = resolveProductDefaults(p, DB_CATEGORIES, DB_BRANDS);
    expect(resolved.suggestedCategoryId).toBe(14); // Ovo de Páscoa
    expect(resolved.suggestedBrandId).toBe(7);     // Cacau Show
  });
});

describe('parseNFe — Show Comércio (1 produto SEM GTIN, NF 3046)', () => {
  let result;
  beforeAll(() => { result = parseNFe(xml('nfe-showcomercio-1produto-semgtin.xml')); });

  test('NF-e com produto único parseada corretamente', () => {
    expect(result.products).toHaveLength(1);
    expect(result.emitter.detectedBrand).toBe('Cacau Show');
  });

  test('ovo de pistache: sem barcode, NCM → Ovo de Páscoa, qty 3', () => {
    const p = result.products[0];
    expect(p.barcode).toBeNull();
    expect(p.code).toBe('1003823');
    expect(p.name).toBe('OVO LACREME PISTACHE 348GX12UN');
    expect(p.quantity).toBe(3);
    expect(p.ncm).toBe('17049010');
    expect(p.suggestedCategoryName).toBe('Ovo de Páscoa');
    expect(p.brand).toBe('Cacau Show');
  });
});

describe('parseNFe — Natura (32 produtos, NF 15815239)', () => {
  let result;
  beforeAll(() => { result = parseNFe(xml('nfe-natura-32produtos.xml')); });

  test('detecta Natura, 32 produtos', () => {
    expect(result.emitter.detectedBrand).toBe('Natura');
    expect(result.nfeNumber).toBe('15815239');
    expect(result.products).toHaveLength(32);
  });

  test('produto [0]: shampoo → Shampoo', () => {
    const p = result.products[0];
    expect(p.name).toBe('NATURE SH VERAO 250ML');
    expect(p.ncm).toBe('33051000');
    expect(p.suggestedCategoryName).toBe('Shampoo');
  });

  test('produto [1]: condicionador → Condicionador', () => {
    const p = result.products[1];
    expect(p.name).toBe('NATURE COND VERAO 250ML');
    expect(p.ncm).toBe('33059000');
    expect(p.suggestedCategoryName).toBe('Condicionador');
  });

  test('produto [2]: caneta estampada → sem sugestão (brinde)', () => {
    const p = result.products[2];
    expect(p.name).toBe('CPV CANETA ESTAMPADA PROFESSORES IMP');
    expect(p.ncm).toBe('96081000');
    expect(p.suggestedCategoryName).toBeNull();
  });

  test('produto [3]: sabonete barra → Sabonete Barra', () => {
    const p = result.products[3];
    expect(p.name).toBe('NATURE SAB BAR VERAO 90G');
    expect(p.ncm).toBe('34011190');
    expect(p.suggestedCategoryName).toBe('Sabonete Barra');
  });
});

describe('parseNFe — Natura (12 produtos, NF 17597959)', () => {
  let result;
  beforeAll(() => { result = parseNFe(xml('nfe-natura-12produtos.xml')); });

  test('detecta Natura, 12 produtos', () => {
    expect(result.emitter.detectedBrand).toBe('Natura');
    expect(result.products).toHaveLength(12);
  });

  test('protetor solar SPF50 → NCM 33049990 → Creme', () => {
    const p = result.products[0];
    expect(p.barcode).toBe('7909189331512');
    expect(p.name).toBe('RENEW SOLAR ACIDO HIALURONICO SPF 50');
    expect(p.ncm).toBe('33049990');
    expect(p.suggestedCategoryName).toBe('Creme');
    expect(p.costPrice).toBe(21.26);
  });
});

describe('parseNFe — tratamento de erros', () => {
  test('lança erro para XML sem estrutura de NF-e', () => {
    expect(() => parseNFe('<xml>isso nao e uma nfe</xml>')).toThrow('XML de NF-e inválido');
  });
  test('lança erro para string vazia', () => {
    expect(() => parseNFe('')).toThrow();
  });
  test('lança erro para null/undefined', () => {
    expect(() => parseNFe(null)).toThrow();
    expect(() => parseNFe(undefined)).toThrow();
  });
});

// ─── findExistingProduct ──────────────────────────────────────────────────────

describe('findExistingProduct', () => {
  const existingProduct = { id: 99, name: 'Produto Existente', stock: 10 };

  beforeEach(() => {
    mockIdentifierRepo.findByIdentifier.mockReset();
    mockIdentifierRepo.findSimilarByName.mockReset();
    mockIdentifierRepo.findSimilarByName.mockResolvedValue([]);
  });

  test('barcode encontrado → retorna sem chamar findByIdentifier(code)', async () => {
    mockIdentifierRepo.findByIdentifier.mockResolvedValueOnce(existingProduct);
    const result = await findExistingProduct({ barcode: '7891234567890', code: 'COD001' });
    expect(result.product).toBe(existingProduct);
    expect(result.matchedBy).toBe('barcode');
    expect(mockIdentifierRepo.findByIdentifier).toHaveBeenCalledTimes(1);
    expect(mockIdentifierRepo.findByIdentifier).toHaveBeenCalledWith('barcode', '7891234567890');
  });

  test('barcode não encontrado → cai para findByIdentifier(code)', async () => {
    mockIdentifierRepo.findByIdentifier
      .mockResolvedValueOnce(null)        // barcode miss
      .mockResolvedValueOnce(existingProduct); // code hit
    const result = await findExistingProduct({ barcode: '7899999999999', code: 'COD001' });
    expect(result.product).toBe(existingProduct);
    expect(result.matchedBy).toBe('code');
    expect(mockIdentifierRepo.findByIdentifier).toHaveBeenCalledWith('code', 'COD001');
  });

  test('barcode null (SEM GTIN) → vai direto para findByIdentifier(code)', async () => {
    mockIdentifierRepo.findByIdentifier.mockResolvedValueOnce(existingProduct);
    const result = await findExistingProduct({ barcode: null, code: '1002638' });
    expect(result.product).toBe(existingProduct);
    expect(result.matchedBy).toBe('code');
    expect(mockIdentifierRepo.findByIdentifier).toHaveBeenCalledTimes(1);
    expect(mockIdentifierRepo.findByIdentifier).toHaveBeenCalledWith('code', '1002638');
  });

  test('sem barcode nem code → retorna product null sem queries', async () => {
    const result = await findExistingProduct({ barcode: null, code: '' });
    expect(result.product).toBeNull();
    expect(result.matchedBy).toBeNull();
    expect(mockIdentifierRepo.findByIdentifier).not.toHaveBeenCalled();
  });
});