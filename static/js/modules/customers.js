import { Api } from '../api.js';
import { formatMoney, debounce, $ } from '../utils.js';
import { initPayments, openPaymentModal, setPaymentCallback } from './payments.js';
import { initHistory, viewHistory } from './history.js';

let state = { page: 1, limit: 10, search: '', totalPages: 1 };

export function initCustomers() {
    // Busca
    $('#customer-search-input').addEventListener('keyup', debounce((e) => {
        state.search = e.target.value.trim();
        loadCustomers(1);
    }, 500));

    // CRUD
    $('#btn-new-customer').addEventListener('click', () => openModal());
    $('#customer-form').addEventListener('submit', saveCustomer);

    // Paginacao
    $('#btn-prev-cust').addEventListener('click', () => changePage(-1));
    $('#btn-next-cust').addEventListener('click', () => changePage(1));

    // Delegacao de eventos na tabela
    $('#customers-list').addEventListener('click', handleTableClick);

    // Sub-modulos
    initPayments();
    setPaymentCallback(() => loadCustomers());

    initHistory();

    loadCustomers();
}

// --- Carregamento e renderizacao ---

async function loadCustomers(page = state.page) {
    try {
        const data = await Api.getCustomers(page, state.limit, state.search);
        state.page = page;
        state.totalPages = data.pagination.totalPages;
        renderTable(data.data);
        updatePagination();
    } catch (err) {
        console.error(err);
        alert('Erro ao carregar clientes');
    }
}

function renderTable(customers) {
    $('#customers-list').innerHTML = (customers || []).map(c => `
        <tr data-json='${JSON.stringify(c)}'>
            <td>${c.id}</td>
            <td>${c.name}</td>
            <td>${c.phone}</td>
            <td style="color: ${c.balance > 0.01 ? '#ff4d4f' : '#52c41a'}; font-weight:600;">
                ${formatMoney(c.balance)}
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit">Editar</button>
                    <button class="btn-pay" style="background-color: #4facfe; color: white;">Pagar</button>
                    <button class="btn-history">Historico</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function handleTableClick(e) {
    const tr = e.target.closest('tr');
    if (!tr) return;
    const customer = JSON.parse(tr.dataset.json);

    if (e.target.closest('.btn-edit')) openModal(customer);
    if (e.target.closest('.btn-pay')) openPaymentModal(customer);
    if (e.target.closest('.btn-history')) viewHistory(customer.id);
}

// --- Modal de cliente ---

function openModal(c = null) {
    $('#customer-modal').style.display = 'block';
    $('#customer-modal-title').innerText = c ? 'Editar Cliente' : 'Novo Cliente';
    $('#cust-id').value = c ? c.id : '';
    $('#cust-name').value = c ? c.name : '';
    $('#cust-phone').value = c ? c.phone : '';
    $('#cust-initial-debt').value = c ? (c.balance ? c.balance.toFixed(2) : '') : '';
}

async function saveCustomer(e) {
    e.preventDefault();
    const id = $('#cust-id').value;
    const customer = {
        id: id || null,
        name: $('#cust-name').value,
        phone: $('#cust-phone').value,
        balance: $('#cust-initial-debt').value
    };

    try {
        await Api.saveCustomer(customer);
        $('#customer-modal').style.display = 'none';
        loadCustomers();
    } catch (err) { alert('Erro ao salvar cliente'); }
}

// --- Paginacao ---

function changePage(delta) {
    const newPage = state.page + delta;
    if (newPage > 0 && newPage <= state.totalPages) loadCustomers(newPage);
}

function updatePagination() {
    $('#customer-page-info').innerText = `Pagina ${state.page} de ${state.totalPages}`;
    $('#btn-prev-cust').disabled = state.page <= 1;
    $('#btn-next-cust').disabled = state.page >= state.totalPages;
}
