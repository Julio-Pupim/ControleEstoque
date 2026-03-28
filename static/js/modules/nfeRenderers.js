import { formatMoney } from '../utils.js';

// --- Helpers ---

export function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatCNPJ(cnpj) {
    const d = String(cnpj).replace(/\D/g, '').padStart(14, '0');
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

// --- Emitter & Stats ---

export function renderEmitterInfo(data) {
    const brandBadge = data.emitter.detectedBrand
        ? `<span class="nfe-badge nfe-badge--ok">\u2713 ${data.emitter.detectedBrand}</span>`
        : `<span class="nfe-badge nfe-badge--warn">\u26A0 Marca nao identificada</span>`;

    return `
    <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">
      <strong style="font-size:1rem;">${data.emitter.name}</strong>
      ${brandBadge}
    </div>
    <small style="color:var(--text-muted);margin-top:4px;display:block;">
      NF-e n\u00BA ${data.nfeNumber} &nbsp;\u00B7&nbsp; CNPJ ${formatCNPJ(data.emitter.cnpj)}
    </small>`;
}

export function renderStats(products) {
    const countNew = products.filter(p => p.action === 'create').length;
    const countExisting = products.filter(p => p.action === 'update_stock').length;

    return `
    <span class="nfe-badge nfe-badge--ok">+ ${countNew} novo${countNew !== 1 ? 's' : ''}</span>
    <span class="nfe-badge nfe-badge--info">${countExisting} ja cadastrado${countExisting !== 1 ? 's' : ''} (estoque)</span>
    <span class="nfe-badge nfe-badge--muted">${products.length} total</span>`;
}

// --- Product Row ---

export function renderProductRow(idx, p, brandsCache, categoriesCache) {
    const { statusBadge, resolveSelectHtml } = renderStatus(idx, p);

    const matchedByHint = p.matchedBy
        ? `<small style="color:var(--text-muted);font-size:.7rem;">encontrado por ${p.matchedBy === 'barcode' ? 'cod. barras' : 'cod. interno'}</small>`
        : '';

    return `
    <tr data-idx="${idx}" class="${p.action === 'skip' ? 'nfe-row--skip' : ''}">
        <td class="nfe-col-produto">
          ${statusBadge}
          ${matchedByHint}
          <div style="margin:4px 0;">
            <input type="text" class="nfe-name-input" data-idx="${idx}" value="${escapeAttr(p.name)}"
                   style="width:100%;font-weight:500;padding:4px 6px;font-size:.9rem;">
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <input type="text" class="nfe-barcode-input" data-idx="${idx}" value="${escapeAttr(p.barcode || '')}"
                   placeholder="Cod. Barras" style="flex:1;min-width:100px;padding:3px 6px;font-size:.8rem;">
            <input type="text" class="nfe-code-input" data-idx="${idx}" value="${escapeAttr(p.code || '')}"
                   placeholder="Codigo" style="flex:1;min-width:80px;padding:3px 6px;font-size:.8rem;">
          </div>
          <small class="nfe-product-meta" style="margin-top:2px;">NCM ${p.ncm}</small>
          ${resolveSelectHtml}
        </td>
        <td class="nfe-col-custo">
          <span class="nfe-cost">${formatMoney(p.costPrice)}</span>
          <small style="color:var(--text-muted);display:block;font-size:.7rem;">custo unitario</small>
        </td>
        <td class="nfe-col-marca">${renderBrandSelect(idx, p, brandsCache)}</td>
        <td class="nfe-col-cat">${renderCategorySelect(idx, p, categoriesCache)}</td>
        <td class="nfe-col-preco">${renderSalePriceInput(idx, p)}</td>
        <td class="nfe-col-acao">${renderActionSelect(idx, p.action)}</td>
    </tr>`;
}

// --- Sub-renders (internos) ---

function renderStatus(idx, p) {
    let statusBadge = '';
    let resolveSelectHtml = '';

    if (p.action === 'create') {
        statusBadge = '<span class="nfe-badge nfe-badge--ok">NOVO</span>';
    } else if (p.action === 'update_stock') {
        statusBadge = `<span class="nfe-badge nfe-badge--info">JA EXISTE \u00B7 estoque atual: ${p.existingProduct?.stock ?? '?'}</span>`;
    } else if (p.action === 'resolve') {
        statusBadge = '<span class="nfe-badge nfe-badge--warn">\u26A0 CODIGO NAO ENCONTRADO</span>';

        let candidateOptions = '<option value="new">Cadastrar como novo</option>';
        if (p.candidates?.length > 0) {
            p.candidates.forEach(c => {
                candidateOptions += `<option value="${c.id}">Vincular a: ${c.name}</option>`;
            });
        }

        resolveSelectHtml = `
        <div style="margin-top: 8px;">
          <select class="nfe-resolve-sel" data-idx="${idx}" style="padding: 4px; font-size: 0.85rem; width: 100%; border-radius: 4px; border: 1px solid var(--border-color);">
            ${candidateOptions}
          </select>
        </div>`;
    } else {
        statusBadge = '<span class="nfe-badge nfe-badge--muted">IGNORADO</span>';
    }

    return { statusBadge, resolveSelectHtml };
}

function renderBrandSelect(idx, p, brandsCache) {
    const options = brandsCache.map(b => {
        const selected = b.id === p.suggestedBrandId ? 'selected' : '';
        return `<option value="${b.id}" ${selected}>${b.name}</option>`;
    }).join('');

    return `
    <select class="nfe-brand-sel" data-idx="${idx}">
      <option value="">Selecione...</option>
      ${options}
    </select>`;
}

function renderCategorySelect(idx, p, categoriesCache) {
    const options = categoriesCache.map(c => {
        const selected = c.id === p.suggestedCategoryId ? 'selected' : '';
        return `<option value="${c.id}" ${selected}>${c.name}</option>`;
    }).join('');

    return `
    <select class="nfe-cat-sel" data-idx="${idx}">
      <option value="">Selecione...</option>
      ${options}
    </select>`;
}

function renderSalePriceInput(idx, p) {
    if (p.action === 'update_stock') {
        return `
        <label class="nfe-update-price-label">
            <input type="checkbox" class="nfe-update-price-chk" data-idx="${idx}">
            <span>Atualizar preco</span>
        </label>
        <input type="number" class="nfe-price-input" data-idx="${idx}"
               step="0.01" min="0.01" placeholder="Novo preco R$"
               style="display:none;margin-top:6px;">`;
    }

    const suggested = (p.costPrice * 1.3).toFixed(2);
    return `
    <input type="number" class="nfe-price-input" data-idx="${idx}"
           step="0.01" min="0.01" value="${suggested}" required>
    <small style="color:var(--text-muted);font-size:.7rem;">preco de venda</small>`;
}

function renderActionSelect(idx, currentAction) {
    if (currentAction === 'resolve') {
        return `
        <select class="nfe-action-sel" data-idx="${idx}">
            <option value="resolve" selected>Resolver pendencia</option>
            <option value="skip">Ignorar</option>
        </select>`;
    }
    return `
    <select class="nfe-action-sel" data-idx="${idx}">
        <option value="create"       ${currentAction === 'create'       ? 'selected' : ''}>Criar</option>
        <option value="update_stock" ${currentAction === 'update_stock' ? 'selected' : ''}>So estoque</option>
        <option value="skip"                                                                >Ignorar</option>
    </select>`;
}

// --- Result ---

export function renderResult(result) {
    const hasErrors = result.errors?.length > 0;

    return `
    <div class="nfe-result-header">
      <div class="nfe-result-icon">${hasErrors ? '\u26A0\uFE0F' : '\u2705'}</div>
      <h3>${hasErrors ? 'Import concluido com avisos' : 'Import concluido com sucesso!'}</h3>
    </div>
    <div class="nfe-result-stats">
      <div class="nfe-stat-card"><span>${result.created}</span><small>Criados</small></div>
      <div class="nfe-stat-card"><span>${result.updated}</span><small>Atualizados</small></div>
      <div class="nfe-stat-card"><span>${result.skipped}</span><small>Ignorados</small></div>
    </div>
    ${hasErrors ? `
      <div class="nfe-errors">
        <strong>Problemas encontrados:</strong>
        <ul>${result.errors.map(e => `<li><strong>${e.product}:</strong> ${e.error}</li>`).join('')}</ul>
      </div>` : ''}
    <button type="button" class="btn-primary" style="width:100%;margin-top:1.5rem;"
            onclick="document.getElementById('nfe-modal').style.display='none'">
      Fechar
    </button>`;
}
