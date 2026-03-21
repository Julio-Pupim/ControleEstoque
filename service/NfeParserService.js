'use strict';

const { XMLParser } = require('fast-xml-parser');

// ─── Mapeamentos ──────────────────────────────────────────────────────────────

/**
 * Padrões para detectar a marca a partir do nome do emissora da NF-e.
 * A ordem importa: padrões mais específicos devem vir primeiro.
 *
 * Inclui tanto fabricantes diretos quanto distribuidores/franqueados conhecidos.
 * Exemplo: "SHOW COMERCIO DE DOCES LTDA ME" é uma loja franqueada da Cacau Show.
 */
const BRAND_PATTERNS = [
  { pattern: /mary\s*kay/i,                      brand: 'Mary Kay'    },
  // Cacau Show: cobre a fabricante e lojas franqueadas
  { pattern: /cacau\s*show/i,                    brand: 'Cacau Show'  },
  { pattern: /show\s+com[eé]rcio\s+de\s+doces/i, brand: 'Cacau Show'  },
  { pattern: /botic[aá]rio/i,                    brand: 'O Boticário' },
  { pattern: /millus/i,                          brand: 'De Millus'   },
  { pattern: /eudora/i,                          brand: 'Eudora'      },
  { pattern: /\bavon\b/i,                        brand: 'Avon'        },
  { pattern: /\bnatura\b/i,                      brand: 'Natura'      },
];

/**
 * Mapeamento NCM → NOME CANÔNICO de categoria.
 *
 * Este mapa é uma sugestão de melhor esforço — ele mapeia o código fiscal do produto
 * para o nome de uma categoria cadastrada no sistema. A resolução do ID real da
 * categoria acontece no NFeController, que consulta o banco e faz o match por nome.
 *
 * Consequências do design:
 * - Categoria renomeada no banco → sugestão retorna null → usuário seleciona manualmente
 * - Categoria deletada do banco  → idem
 * - Nova categoria adicionada    → basta adicionar o NCM aqui para começar a sugerir
 * - Não há dependência de IDs    → parser continua puro e testável sem banco
 */
const NCM_CATEGORY_MAP = {
  // Chocolates / Páscoa
  '17049010': 'Ovo de Páscoa',
  '18063210': 'Tablete de Chocolate',
  '18069000': 'Ovo de Páscoa',
  '19052010': 'Panettone',

  // Perfumaria
  '33030020': 'Perfume',

  // Maquiagem / Cosméticos
  '33041000': 'Creme',          // batons, cosméticos labiais
  '33042010': 'Creme',          // maquiagem para olhos
  '33049100': 'Creme',          // pós faciais, blush
  '33049910': 'Creme',          // hidratantes noturnos / cremes faciais
  '33049990': 'Creme',          // outros cosméticos para rosto

  // Cabelo
  '33051000': 'Shampoo',
  '33059000': 'Condicionador',

  // Desodorantes
  '33072010': 'Desodorante Roll-on',
  '33072020': 'Desodorante Spray',
  '33072090': 'Desodorante Roll-on', // outros antitranspirantes

  // Sabonetes / Limpeza
  '34011190': 'Sabonete Barra',
  '34013000': 'Sabonete Líq.',
};

// ─── Funções puras (exportadas para testes) ───────────────────────────────────

/**
 * Detecta a marca a partir do nome do emissora da NF-e.
 * @param {string} emitterName
 * @returns {string|null}
 */
function detectBrand(emitterName) {
  if (!emitterName) return null;
  for (const { pattern, brand } of BRAND_PATTERNS) {
    if (pattern.test(emitterName)) return brand;
  }
  return null;
}

/**
 * Retorna o nome canônico da categoria sugerida para um NCM.
 * O caller é responsável por resolver esse nome para um ID do banco.
 * @param {string} ncm
 * @returns {string|null}
 */
function suggestCategory(ncm) {
  return NCM_CATEGORY_MAP[String(ncm).replace(/\D/g, '')] || null;
}

// ─── Parser principal ─────────────────────────────────────────────────────────

/**
 * Parseia o XML de uma NF-e e retorna dados estruturados.
 * Função pura — sem acesso a banco ou efeitos colaterais.
 *
 * @param {string} xmlString
 * @returns {{ emitter, nfeNumber, products }}
 * @throws {Error} XML inválido ou fora do padrão NF-e
 */
function parseNFe(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') {
    throw new Error('XML de NF-e inválido');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'det',
    // parseTagValue: false é crítico para preservar zeros à esquerda
    // em CNPJs ("00223046000412") e cProds ("064791").
    // Campos numéricos são convertidos explicitamente via parseFloat/parseInt.
    parseAttributeValue: false,
    parseTagValue: false,
  });

  let parsed;
  try {
    parsed = parser.parse(xmlString);
  } catch {
    throw new Error('XML de NF-e inválido');
  }

  // Suporta XML com e sem o wrapper <nfeProc>
  const infNFe = parsed?.nfeProc?.NFe?.infNFe || parsed?.NFe?.infNFe;
  if (!infNFe) throw new Error('XML de NF-e inválido');

  const emitterName  = String(infNFe.emit?.xNome || '');
  const detectedBrand = detectBrand(emitterName);
  const dets          = Array.isArray(infNFe.det) ? infNFe.det : [];

  const products = dets.map((det) => {
    const prod       = det.prod || {};
    const rawBarcode = String(prod.cEAN || '');
    const barcode    = rawBarcode && rawBarcode !== 'SEM GTIN' ? rawBarcode : null;
    const ncm        = String(prod.NCM || '');

    return {
      barcode,
      code:                  String(prod.cProd || ''),
      name:                  String(prod.xProd || ''),
      ncm,
      costPrice:             parseFloat(prod.vUnCom) || 0,
      quantity:              parseFloat(prod.qCom)   || 0,
      // Nome canônico da categoria sugerida — o controller resolve para category_id
      suggestedCategoryName: suggestCategory(ncm),
      // Nome da marca detectada — o controller resolve para brand_id
      brand:                 detectedBrand,
    };
  });

  return {
    nfeNumber: String(infNFe.ide?.nNF || ''),
    emitter: {
      name:          emitterName,
      cnpj:          String(infNFe.emit?.CNPJ || ''),
      detectedBrand,
    },
    products,
  };
}

module.exports = { parseNFe, detectBrand, suggestCategory, BRAND_PATTERNS, NCM_CATEGORY_MAP };