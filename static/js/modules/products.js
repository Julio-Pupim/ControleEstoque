import { Api } from '../api.js';
import { formatMoney, debounce, $, populateSelect } from '../utils.js';

let state = { page: 1, limit: 10, search: '', categoryId: '', totalPages: 1 };

export function initProducts() {
  $('#product-search-input').addEventListener('keyup', debounce((e) => {
    state.search = e.target.value.trim();
    loadProducts(1);
  }, 500));

  $('#product-category-filter').addEventListener('change', (e) => {
    state.categoryId = e.target.value;
    loadProducts(1);
  });

  $('#btn-prev-prod').addEventListener('click', () => changePage(-1));
  $('#btn-next-prod').addEventListener('click', () => changePage(1));
  $('#products-list').addEventListener('click', handleTableClick);
  $('#product-form').addEventListener('submit', saveProduct);
  $('#btn-new-product').addEventListener('click', () => openModal());
  $('#prod-brand').addEventListener('change', (e) => updateCategorySelect(e.target.value));

  // Detecta produto existente ao sair do campo de código de barras
  $('#prod-barcode').addEventListener('blur', (e) => {
    if (e.target.value && !$('#prod-id').value) detectExistingProduct({ barcode: e.target.value });
  });

  // Detecta produto existente ao sair do campo de código interno
  $('#prod-code').addEventListener('blur', (e) => {
    if (e.target.value && !$('#prod-id').value) {
      detectExistingProduct({ code: e.target.value });
    }
  });

  loadFilters();
  loadProducts();
}

// ─── Detecção de produto existente ─────────────────────────────────────────────

/**
 * Tenta localizar um produto já cadastrado por barcode ou code.
 * Se achar, oferece ao usuário a opção de editar o estoque.
 */
async function detectExistingProduct({ barcode, code }) {
  try {
    let product = null;

    if (barcode) {
      product = await Api.getProductByBarcode(barcode).catch(() => null);
    }
    if (!product && code) {
      product = await Api.getProductByCode(code).catch(() => null);
    }

    if (!product) return;

    const matchField = barcode ? 'código de barras' : 'código interno';
    if (confirm(`Produto "${product.name}" já cadastrado (${matchField}).\nDeseja editar o estoque?`)) {
      openModal(product, { stockOnly: true });
    }
  } catch {
    // silencia erros de rede — não é crítico para o fluxo
  }
}

// ─── Carregamento e renderização ──────────────────────────────────────────────

async function loadProducts(page = state.page) {
  try {
    const data = await Api.getProducts(page, state.limit, state.search, state.categoryId);
    state.page       = page;
    state.totalPages = data.pagination.totalPages;
    renderTable(data.data);
    updatePaginationUI();
  } catch (error) {
    console.error(error);
    alert('Erro ao carregar produtos');
  }
}

function renderTable(products) {
  $('#products-list').innerHTML = (products || []).map(p => `
    <tr data-json='${JSON.stringify(p)}'>
      <td>${p.name}</td>
      <td>${p.brand}</td>
      <td>${p.category || '-'}</td>
      <td>${formatMoney(p.cost)}</td>
      <td>${formatMoney(p.price)}</td>
      <td>${p.stock}</td>
      <td>
        <div class="action-buttons">
          <button type="button" class="btn-edit">Editar</button>
          <button type="button" class="btn-delete" data-id="${p.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function handleTableClick(e) {
  const tr        = e.target.closest('tr');
  const btnEdit   = e.target.closest('.btn-edit');
  const btnDelete = e.target.closest('.btn-delete');

  if (btnEdit   && tr) openModal(JSON.parse(tr.dataset.json));
  if (btnDelete)       deleteProduct(btnDelete.dataset.id);
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

async function loadFilters() {
  try {
    const [cats, brands] = await Promise.all([Api.getCategories(), Api.getBrands()]);
    populateSelect('#product-category-filter', cats, 'Todas as Categorias');
    window.brandsData = brands;
    window.catsData   = cats;
  } catch (e) { console.error(e); }
}

// ─── Modal ────────────────────────────────────────────────────────────────────

/**
 * @param {object|null} p  - Produto a editar (null = novo)
 * @param {{ stockOnly: boolean }} options
 */
function openModal(p = null, { stockOnly = false } = {}) {
  const modal = $('#product-modal');
  modal.style.display = 'block';

  if ($('#prod-brand').children.length <= 1 && window.brandsData) {
    populateSelect('#prod-brand', window.brandsData);
  }

  $('#product-modal-title').innerText = p ? (stockOnly ? 'Adicionar Estoque' : 'Editar Produto') : 'Novo Produto';

  // Preenche campos
  $('#prod-id').value      = p ? p.id       : '';
  $('#prod-barcode').value = p ? (p.barcode || '') : '';
  $('#prod-code').value    = p ? (p.code    || '') : '';
  $('#prod-name').value    = p ? p.name     : '';
  $('#prod-brand').value   = p ? p.brand_id : '';
  $('#prod-price').value   = p ? p.price    : '';
  $('#prod-cost').value    = p ? (p.cost || '') : '';
  $('#prod-stock').value   = p ? p.stock    : '';

  // Modo só-estoque: bloqueia os campos que não devem ser alterados
  const lockFields = stockOnly;
  ['prod-barcode', 'prod-code', 'prod-name', 'prod-brand', 'prod-category', 'prod-price', 'prod-cost']
    .forEach(id => { $(`#${id}`).disabled = lockFields; });

  if (stockOnly) {
    $('#prod-stock-label').innerText = `Adicionar ao Estoque (atual: ${p.stock})`;
    $('#prod-stock').value = '';
    $('#prod-stock').focus();
    $('#prod-stock').dataset.addToExisting = 'true';
    $('#prod-stock').dataset.currentStock  = p.stock;
  } else {
    $('#prod-stock-label').innerText = 'Estoque:';
    delete $('#prod-stock').dataset.addToExisting;
    delete $('#prod-stock').dataset.currentStock;
    // Habilita todos
    ['prod-barcode', 'prod-code', 'prod-name', 'prod-brand', 'prod-category', 'prod-price', 'prod-cost']
      .forEach(id => { $(`#${id}`).disabled = false; });
  }

  handleModalCategoryInit(p);
}

async function handleModalCategoryInit(p) {
  const brandId = p ? p.brand_id : $('#prod-brand').value;
  await updateCategorySelect(brandId);
  if (p && p.category_id) $('#prod-category').value = p.category_id;
}

async function updateCategorySelect(brandId) {
  const catSelect = $('#prod-category');
  catSelect.innerHTML = '<option value="">Carregando...</option>';
  try {
    const cats = brandId ? await Api.getCategories(brandId) : (window.catsData || await Api.getCategories());
    populateSelect('#prod-category', cats);
  } catch {
    catSelect.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

// ─── Salvar / Excluir ─────────────────────────────────────────────────────────

async function saveProduct(e) {
  e.preventDefault();

  const stockInput    = $('#prod-stock');
  const addToExisting = stockInput.dataset.addToExisting === 'true';
  const currentStock  = parseInt(stockInput.dataset.currentStock) || 0;
  const inputStock    = parseInt(stockInput.value) || 0;

  const product = {
    id:          $('#prod-id').value || null,
    barcode:     $('#prod-barcode').value || null,
    code:        $('#prod-code').value    || '',
    name:        $('#prod-name').value,
    brand_id:    $('#prod-brand').value,
    category_id: $('#prod-category').value,
    price:       parseFloat($('#prod-price').value),
    cost:        parseFloat($('#prod-cost').value) || 0,
    stock:       addToExisting ? currentStock + inputStock : inputStock,
  };

  try {
    await Api.saveProduct(product);
    $('#product-modal').style.display = 'none';
    loadProducts();
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  }
}

async function deleteProduct(id) {
  if (confirm('Excluir este produto?')) {
    try {
      await Api.deleteProduct(id);
      loadProducts();
    } catch { alert('Erro ao excluir'); }
  }
}

// ─── Paginação ────────────────────────────────────────────────────────────────

function changePage(delta) {
  const newPage = state.page + delta;
  if (newPage > 0 && newPage <= state.totalPages) loadProducts(newPage);
}

function updatePaginationUI() {
  $('#product-page-info').innerText  = `Página ${state.page} de ${state.totalPages}`;
  $('#btn-prev-prod').disabled       = state.page <= 1;
  $('#btn-next-prod').disabled       = state.page >= state.totalPages;
}