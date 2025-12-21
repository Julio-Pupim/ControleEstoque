import { Api } from '../api.js';
import { formatMoney, debounce, $, populateSelect } from '../utils.js';

let state = { page: 1, limit: 10, search: '', categoryId: '', totalPages: 1 };

export function initProducts() {
    // Listeners
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

    // Form e Modal
    $('#product-form').addEventListener('submit', saveProduct);
    $('#product-form').addEventListener('submit', saveProduct);
    $('#btn-new-product').addEventListener('click', () => openModal());

    // Filter categories when brand changes
    $('#prod-brand').addEventListener('change', (e) => {
        updateCategorySelect(e.target.value);
    });

    // Cód Barras Check (Opcional: migrar a lógica de verificar existência)
    $('#prod-barcode').addEventListener('blur', async (e) => {
        // Lógica simplificada de check
        if (!e.target.value || $('#prod-id').value) return;
        const p = await Api.getProductByBarcode(e.target.value);
        if (p) {
            if (confirm(`Produto "${p.name}" já existe. Editar estoque?`)) {
                openModal(p);
                document.getElementById('prod-code').disabled = true;
                document.getElementById('prod-name').disabled = true;
                document.getElementById('prod-brand').disabled = true;
                document.getElementById('prod-category').disabled = true;
                document.getElementById('prod-price').disabled = true;
            }
        }
    });

    loadFilters();
    loadProducts();
}

async function loadProducts(page = state.page) {
    try {
        const data = await Api.getProducts(page, state.limit, state.search, state.categoryId);
        state.page = page;
        state.totalPages = data.pagination.totalPages;
        renderTable(data.data);
        updatePaginationUI();
    } catch (error) {
        console.error(error);
        alert('Erro ao carregar produtos');
    }
}

function renderTable(products) {
    const tbody = $('#products-list');
    tbody.innerHTML = (products || []).map(p => `
        <tr data-json='${JSON.stringify(p)}'>
            <td>${p.name}</td>
            <td>${p.brand}</td>
            <td>${p.category || '-'}</td>
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
    // Melhorando a detecção do botão (caso tenha ícone dentro)
    const btnEdit = e.target.closest('.btn-edit');
    const btnDelete = e.target.closest('.btn-delete');
    const tr = e.target.closest('tr');

    if (btnEdit && tr) {
        const productData = JSON.parse(tr.dataset.json);
        openModal(productData);
    }

    if (btnDelete) {
        const id = btnDelete.dataset.id;
        deleteProduct(id);
    }
}

async function loadFilters() {
    try {
        const [cats, brands] = await Promise.all([Api.getCategories(), Api.getBrands()]);
        populateSelect('#product-category-filter', cats, 'Todas as Categorias');
        window.brandsData = brands;
        window.catsData = cats;
    } catch (e) { console.error(e); }
}

async function saveProduct(e) {
    e.preventDefault();

    // Coleta manual para garantir tipos (parse float/int)
    const product = {
        id: $('#prod-id').value || null,
        barcode: $('#prod-barcode').value,
        code: $('#prod-code').value,
        name: $('#prod-name').value,
        brand_id: $('#prod-brand').value,
        category_id: $('#prod-category').value,
        price: parseFloat($('#prod-price').value),
        stock: parseInt($('#prod-stock').value)
    };

    try {
        await Api.saveProduct(product);
        $('#product-modal').style.display = 'none';
        loadProducts(); // Recarrega lista
    } catch (err) {
        alert('Erro ao salvar: ' + err.message);
    }
}

async function deleteProduct(id) {
    if (confirm('Excluir este produto?')) {
        try {
            await Api.deleteProduct(id);
            loadProducts();
        } catch (err) { alert('Erro ao excluir'); }
    }
}

function openModal(p = null) {
    const modal = $('#product-modal');
    modal.style.display = 'block';

    // Garante que selects estão preenchidos
    // Garante que selects estão preenchidos
    if ($('#prod-brand').children.length <= 1 && window.brandsData) {
        populateSelect('#prod-brand', window.brandsData);
        // Note: We don't populate categories here blindly anymore for the modal,
        // because it depends on the brand. But for the initial state of "New Product"
        // we might want to show all OR wait for brand.
        // Let's load ALL categories initially if no brand is selected, or clear it.
        // populateSelect('#prod-category', window.catsData); 
    }

    // Título
    $('#product-modal-title').innerText = p ? 'Editar Produto' : 'Novo Produto';

    // Preencher campos
    $('#prod-id').value = p ? p.id : '';
    $('#prod-barcode').value = p ? p.barcode : '';
    $('#prod-code').value = p ? (p.code || '') : '';
    $('#prod-name').value = p ? p.name : '';
    $('#prod-brand').value = p ? p.brand_id : '';
    $('#prod-category').value = p ? (p.category_id || '') : '';
    $('#prod-price').value = p ? p.price : '';
    $('#prod-stock').value = p ? p.stock : '';

    // Resetar estados de disabled (caso tenha lógica de travamento antiga)
    $('#prod-code').disabled = false;

    // Atualiza as categorias baseado na marca selecionada (ou mostra todas se vazio? Ou mostra vazio?)
    // Se for edição, precisamos esperar o updateCategorySelect terminar antes de setar o valor?
    // updateCategorySelect é async.

    handleModalCategoryInit(p);
}

async function handleModalCategoryInit(p) {
    const brandId = p ? p.brand_id : $('#prod-brand').value;
    await updateCategorySelect(brandId); // Carrega categorias da marca (ou todas se nulo, ou vazio)

    // Se for edição, seta o valor DEPOIS de carregar as options
    if (p && p.category_id) {
        $('#prod-category').value = p.category_id;
    }
}

async function updateCategorySelect(brandId) {
    const catSelect = $('#prod-category');
    catSelect.innerHTML = '<option value="">Carregando...</option>';

    try {
        // Se não tiver brandId, talvez devêssemos mostrar todas? 
        // Ou limpar? O usuário pediu: "vincular".
        // Se não tem marca, tecnicamente não tem filtro.
        // Vamos buscar categorias filtradas se brandId existir.
        // Se brandId for vazio, vou buscar TODAS (comportamento padrão) ou limpar?
        // Se eu limpar, obrigo o usuário a selecionar marca. Isso é bom pra integridade.

        let cats = [];
        if (brandId) {
            cats = await Api.getCategories(brandId);
        } else {
            // Se não tem marca selecionada, mostra todas? Ou mostra vazio?
            // Vou mostrar TODAS para flexibilidade, ou window.catsData se já tiver
            cats = window.catsData || await Api.getCategories();
        }

        populateSelect('#prod-category', cats);

    } catch (e) {
        console.error(e);
        catSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

function changePage(delta) {
    const newPage = state.page + delta;
    if (newPage > 0 && newPage <= state.totalPages) loadProducts(newPage);
}

function updatePaginationUI() {
    $('#product-page-info').innerText = `Página ${state.page} de ${state.totalPages}`;
    $('#btn-prev-prod').disabled = state.page <= 1;
    $('#btn-next-prod').disabled = state.page >= state.totalPages;
}