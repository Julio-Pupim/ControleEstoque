import { Api } from '../api.js';
import { formatMoney, $ } from '../utils.js';

// ─── Estado do módulo ─────────────────────────────────────────────────────────

let previewData     = null;
let brandsCache     = [];
let categoriesCache = [];
let listenersReady  = false;

// ─── Init (lazy — só carrega dados quando o modal abre) ───────────────────────

export function initNFeImport() {
  const btn = $('#btn-nfe-import');
  if (!btn) return;

  btn.addEventListener('click', openModal);
}

async function openModal() {
  resetModal();
  $('#nfe-modal').style.display = 'flex';

  // Carrega marcas e categorias na primeira abertura
  if (brandsCache.length === 0 || categoriesCache.length === 0) {
    try {
      [brandsCache, categoriesCache] = await Promise.all([
        Api.getBrands(),
        Api.getCategories(),
      ]);
    } catch {
      showError('Não foi possível carregar marcas e categorias. Tente novamente.');
      return;
    }
  }

  attachListeners();
}

function attachListeners() {
  if (listenersReady) return;
  listenersReady = true;

  $('#nfe-file-input').addEventListener('change', handleFileSelect);
  $('#nfe-preview-form').addEventListener('submit', handleImport);

  // Toggle do input de preço para produtos existentes
  $('#nfe-product-rows').addEventListener('change', (e) => {
    if (e.target.classList.contains('nfe-update-price-chk')) {
      const idx        = e.target.dataset.idx;
      const priceInput = document.querySelector(`.nfe-price-input[data-idx="${idx}"]`);
      if (priceInput) priceInput.style.display = e.target.checked ? 'block' : 'none';
    }
  });

  // Fechar clicando no overlay
  $('#nfe-modal').addEventListener('click', (e) => {
    if (e.target === $('#nfe-modal')) closeModal();
  });

  $('#nfe-btn-close').addEventListener('click', closeModal);
  $('#nfe-btn-back').addEventListener('click', () => showStep('upload'));
}

// ─── Leitura do arquivo ───────────────────────────────────────────────────────

async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.xml')) {
    showError('Selecione um arquivo .xml de NF-e.');
    return;
  }

  showStep('loading');

  try {
    const xmlText = await readFileAsText(file);
    const data    = await Api.nfePreview(xmlText);
    previewData   = data;
    renderPreview(data);
    showStep('preview');
  } catch (err) {
    showError(err.message || 'Erro ao processar o arquivo.');
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader   = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = ()  => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsText(file, 'UTF-8');
  });
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function renderPreview(data) {
  const brandBadge = data.emitter.detectedBrand
    ? `<span class="nfe-badge nfe-badge--ok">✓ ${data.emitter.detectedBrand}</span>`
    : `<span class="nfe-badge nfe-badge--warn">⚠ Marca não identificada</span>`;

  $('#nfe-emitter-info').innerHTML = `
    <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">
      <strong style="font-size:1rem;">${data.emitter.name}</strong>
      ${brandBadge}
    </div>
    <small style="color:var(--text-muted);margin-top:4px;display:block;">
      NF-e nº ${data.nfeNumber} &nbsp;·&nbsp; CNPJ ${formatCNPJ(data.emitter.cnpj)}
    </small>
  `;

  const countNew      = data.products.filter(p => p.action === 'create').length;
  const countExisting = data.products.filter(p => p.action === 'update_stock').length;
  $('#nfe-stats').innerHTML = `
    <span class="nfe-badge nfe-badge--ok">+ ${countNew} novo${countNew !== 1 ? 's' : ''}</span>
    <span class="nfe-badge nfe-badge--info">${countExisting} já cadastrado${countExisting !== 1 ? 's' : ''} (estoque)</span>
    <span class="nfe-badge nfe-badge--muted">${data.products.length} total</span>
  `;

  const tbody = $('#nfe-product-rows');
  tbody.innerHTML = '';

data.products.forEach((p, idx) => {
    let statusBadge = '';
    let resolveSelectHtml = '';

    // 1. Definir o Badge de Estado e o Select de Resolução (se aplicável)
    if (p.action === 'create') {
      statusBadge = '<span class="nfe-badge nfe-badge--ok">NOVO</span>';
    } else if (p.action === 'update_stock') {
      statusBadge = `<span class="nfe-badge nfe-badge--info">JÁ EXISTE · estoque atual: ${p.existingProduct?.stock ?? '?'}</span>`;
    } else if (p.action === 'resolve') {
      statusBadge = '<span class="nfe-badge nfe-badge--warn">⚠ CÓDIGO NÃO ENCONTRADO</span>';
      
      // Construir as opções de candidatos
      let candidateOptions = `<option value="new">Cadastrar como novo</option>`;
      if (p.candidates && p.candidates.length > 0) {
        p.candidates.forEach(c => {
          // c.id e c.name devem vir da API
          candidateOptions += `<option value="${c.id}">Vincular a: ${c.name}</option>`;
        });
      }
      
      resolveSelectHtml = `
        <div style="margin-top: 8px;">
          <select class="nfe-resolve-sel" data-idx="${idx}" style="padding: 4px; font-size: 0.85rem; width: 100%; border-radius: 4px; border: 1px solid var(--border-color);">
            ${candidateOptions}
          </select>
        </div>
      `;
    } else {
      statusBadge = '<span class="nfe-badge nfe-badge--muted">IGNORADO</span>';
    }

    const matchedByHint = p.matchedBy
      ? `<small style="color:var(--text-muted);font-size:.7rem;">encontrado por ${p.matchedBy === 'barcode' ? 'cód. barras' : 'cód. interno'}</small>`
      : '';

    tbody.innerHTML += `
      <tr data-idx="${idx}" class="${p.action === 'skip' ? 'nfe-row--skip' : ''}">
        <td class="nfe-col-produto">
          ${statusBadge}
          ${matchedByHint}
          <div class="nfe-product-name">${p.name}</div>
          <small class="nfe-product-meta">
            ${p.barcode ? p.barcode : '<em>Sem GTIN</em>'} &nbsp;·&nbsp; cod. ${p.code} &nbsp;·&nbsp; NCM ${p.ncm}
          </small>
          ${resolveSelectHtml} </td>
        <td class="nfe-col-custo">
          <span class="nfe-cost">${formatMoney(p.costPrice)}</span>
          <small style="color:var(--text-muted);display:block;font-size:.7rem;">custo unitário</small>
        </td>
        <td class="nfe-col-marca">
          ${renderBrandSelect(idx, p)}
        </td>
        <td class="nfe-col-cat">
          ${renderCategorySelect(idx, p)}
        </td>
        <td class="nfe-col-preco">
          ${renderSalePriceInput(idx, p)}
        </td>
        <td class="nfe-col-acao">
          ${renderActionSelect(idx, p.action)}
        </td>
      </tr>
    `;
  });
}

function renderBrandSelect(idx, p) {
  const options = brandsCache.map(b => {
    // Usa suggestedBrandId (resolvido pelo NFeResolver) para pré-selecionar
    const selected = b.id === p.suggestedBrandId ? 'selected' : '';
    return `<option value="${b.id}" ${selected}>${b.name}</option>`;
  }).join('');

  return `
    <select class="nfe-brand-sel" data-idx="${idx}">
      <option value="">Selecione...</option>
      ${options}
    </select>
  `;
}

function renderCategorySelect(idx, p) {
  const options = categoriesCache.map(c => {
    // Usa suggestedCategoryId (resolvido pelo NFeResolver) para pré-selecionar
    const selected = c.id === p.suggestedCategoryId ? 'selected' : '';
    return `<option value="${c.id}" ${selected}>${c.name}</option>`;
  }).join('');

  return `
    <select class="nfe-cat-sel" data-idx="${idx}">
      <option value="">Selecione...</option>
      ${options}
    </select>
  `;
}

function renderSalePriceInput(idx, p) {
  if (p.action === 'update_stock') {
    return `
      <label class="nfe-update-price-label">
        <input type="checkbox" class="nfe-update-price-chk" data-idx="${idx}">
        <span>Atualizar preço</span>
      </label>
      <input type="number" class="nfe-price-input" data-idx="${idx}"
             step="0.01" min="0.01" placeholder="Novo preço R$"
             style="display:none;margin-top:6px;">
    `;
  }

  // Sugere custo + 30% de margem
  const suggested = (p.costPrice * 1.3).toFixed(2);
  return `
    <input type="number" class="nfe-price-input" data-idx="${idx}"
           step="0.01" min="0.01" value="${suggested}" required>
    <small style="color:var(--text-muted);font-size:.7rem;">preço de venda</small>
  `;
}

function renderActionSelect(idx, currentAction) {
  if (currentAction === 'resolve') {
    return `
      <select class="nfe-action-sel" data-idx="${idx}">
        <option value="resolve" selected>Resolver pendência</option>
        <option value="skip">Ignorar</option>
      </select>
    `;
  }
  return `
    <select class="nfe-action-sel" data-idx="${idx}">
      <option value="create"       ${currentAction === 'create'       ? 'selected' : ''}>Criar</option>
      <option value="update_stock" ${currentAction === 'update_stock' ? 'selected' : ''}>Só estoque</option>
      <option value="skip"                                                                >Ignorar</option>
    </select>
  `;
}

// ─── Import ───────────────────────────────────────────────────────────────────

async function handleImport(e) {
  e.preventDefault();
  if (!previewData) return;

  const products = previewData.products.map((p, idx) => {
    const row            = document.querySelector(`tr[data-idx="${idx}"]`);
    const action         = row.querySelector('.nfe-action-sel').value;
    const brand_id       = row.querySelector('.nfe-brand-sel').value;
    const category_id    = row.querySelector('.nfe-cat-sel').value;
    const priceInput     = row.querySelector('.nfe-price-input');
    const updatePriceChk = row.querySelector('.nfe-update-price-chk');

    return {
      ...p,
      action,
      brand_id:    brand_id    ? parseInt(brand_id)    : null,
      category_id: category_id ? parseInt(category_id) : null,
      salePrice:   priceInput  ? parseFloat(priceInput.value) || 0 : 0,
      updatePrice: updatePriceChk ? updatePriceChk.checked : false,
    };
  });

  showStep('loading');

  try {
    const result = await Api.nfeImport(products);
    renderResult(result);
    showStep('result');
  } catch (err) {
    showError(err.message || 'Erro ao importar produtos.');
  }
}

function renderResult(result) {
  const hasErrors = result.errors?.length > 0;

  $('#nfe-result').innerHTML = `
    <div class="nfe-result-header">
      <div class="nfe-result-icon">${hasErrors ? '⚠️' : '✅'}</div>
      <h3>${hasErrors ? 'Import concluído com avisos' : 'Import concluído com sucesso!'}</h3>
    </div>
    <div class="nfe-result-stats">
      <div class="nfe-stat-card">
        <span>${result.created}</span>
        <small>Criados</small>
      </div>
      <div class="nfe-stat-card">
        <span>${result.updated}</span>
        <small>Atualizados</small>
      </div>
      <div class="nfe-stat-card">
        <span>${result.skipped}</span>
        <small>Ignorados</small>
      </div>
    </div>
    ${hasErrors ? `
      <div class="nfe-errors">
        <strong>Problemas encontrados:</strong>
        <ul>
          ${result.errors.map(e => `<li><strong>${e.product}:</strong> ${e.error}</li>`).join('')}
        </ul>
      </div>` : ''}
    <button type="button" class="btn-primary" style="width:100%;margin-top:1.5rem;"
            onclick="document.getElementById('nfe-modal').style.display='none'">
      Fechar
    </button>
  `;
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

function showStep(step) {
  ['upload', 'loading', 'preview', 'result'].forEach(s => {
    const el = $(`#nfe-step-${s}`);
    if (el) el.style.display = s === step ? 'block' : 'none';
  });
}

function showError(message) {
  showStep('upload');
  const err = $('#nfe-upload-error');
  if (err) {
    err.textContent = message;
    err.style.display = 'block';
  }
}

function closeModal() {
  $('#nfe-modal').style.display = 'none';
}

function resetModal() {
  previewData = null;
  const fileInput = $('#nfe-file-input');
  if (fileInput) fileInput.value = '';
  const err = $('#nfe-upload-error');
  if (err) err.style.display = 'none';
  showStep('upload');
}

function formatCNPJ(cnpj) {
  const d = String(cnpj).replace(/\D/g, '').padStart(14, '0');
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}