import { Api } from '../api.js';
import { $ } from '../utils.js';

let categoriesData = [];
let brandsData = [];

export function initCategories() {
    $('#btn-new-category').addEventListener('click', () => openModal());
    $('#category-form').addEventListener('submit', saveCategory);
    $('#categories-list').addEventListener('click', handleTableClick);

    loadData();
}

async function loadData() {
    try {
        [categoriesData, brandsData] = await Promise.all([
            Api.getCategoriesManage(),
            Api.getBrands(),
        ]);
        renderTable();
    } catch (err) {
        console.error(err);
        alert('Erro ao carregar categorias');
    }
}

function renderTable() {
    const tbody = $('#categories-list');
    if (categoriesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Nenhuma categoria cadastrada.</td></tr>';
        return;
    }

    tbody.innerHTML = categoriesData.map(cat => {
        const brandNames = cat.brand_ids
            .map(id => brandsData.find(b => b.id === id)?.name)
            .filter(Boolean);

        const badges = brandNames.length > 0
            ? brandNames.map(n => `<span class="cat-brand-badge">${n}</span>`).join(' ')
            : '<span style="color:var(--text-muted);font-size:.85rem;">Nenhuma marca</span>';

        return `
        <tr data-id="${cat.id}">
            <td style="font-weight:500;">${cat.name}</td>
            <td>${badges}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit">Editar</button>
                    <button class="btn-delete">Excluir</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function handleTableClick(e) {
    const tr = e.target.closest('tr');
    if (!tr) return;
    const id = parseInt(tr.dataset.id);
    const cat = categoriesData.find(c => c.id === id);
    if (!cat) return;

    if (e.target.closest('.btn-edit')) openModal(cat);
    if (e.target.closest('.btn-delete')) deleteCategory(id);
}

function openModal(cat = null) {
    $('#category-modal').style.display = 'block';
    $('#cat-modal-title').innerText = cat ? 'Editar Categoria' : 'Nova Categoria';
    $('#cat-id').value = cat ? cat.id : '';
    $('#cat-name').value = cat ? cat.name : '';

    renderBrandCheckboxes(cat ? cat.brand_ids : []);
}

function renderBrandCheckboxes(selectedIds = []) {
    const container = $('#cat-brands-list');
    container.innerHTML = brandsData.map(b => `
        <label class="cat-brand-checkbox">
            <input type="checkbox" value="${b.id}" ${selectedIds.includes(b.id) ? 'checked' : ''}>
            <span>${b.name}</span>
        </label>
    `).join('');
}

async function saveCategory(e) {
    e.preventDefault();
    const id = $('#cat-id').value;
    const name = $('#cat-name').value.trim();

    const checkboxes = $('#cat-brands-list').querySelectorAll('input[type="checkbox"]:checked');
    const brand_ids = Array.from(checkboxes).map(cb => parseInt(cb.value));

    try {
        await Api.saveCategory({ id: id || null, name, brand_ids });
        $('#category-modal').style.display = 'none';
        await loadData();
    } catch (err) {
        alert('Erro: ' + err.message);
    }
}

async function deleteCategory(id) {
    if (!confirm('Excluir esta categoria?')) return;
    try {
        await Api.deleteCategory(id);
        await loadData();
    } catch (err) {
        alert('Erro: ' + err.message);
    }
}
