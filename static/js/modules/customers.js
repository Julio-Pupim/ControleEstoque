import { Api } from '../api.js';
import { formatMoney, debounce, $ } from '../utils.js';

// Estados locais
let customerState = { page: 1, limit: 10, search: '', totalPages: 1 };
let historyState = { page: 1, limit: 5, totalPages: 1, customerId: null, startDate: '', endDate: '' };

export function initCustomers() {
    // --- Listeners de Clientes ---
    $('#customer-search-input').addEventListener('keyup', debounce((e) => {
        customerState.search = e.target.value.trim();
        loadCustomers(1);
    }, 500));

    $('#btn-new-customer').addEventListener('click', () => openCustomerModal());
    $('#customer-form').addEventListener('submit', saveCustomer);

    // Paginação Clientes
    $('#btn-prev-cust').addEventListener('click', () => changeCustomerPage(-1));
    $('#btn-next-cust').addEventListener('click', () => changeCustomerPage(1));

    // Delegação de Eventos na Tabela de Clientes (Editar, Pagar, Histórico)
    $('#customers-list').addEventListener('click', handleCustomerTableClick);

    // --- Listeners de Pagamento ---
    $('#payment-form').addEventListener('submit', submitPayment);

    // --- Listeners de Histórico ---
    $('#btn-filter-history').addEventListener('click', applyHistoryFilter);
    $('#btn-prev-hist').addEventListener('click', () => changeHistoryPage(-1));
    $('#btn-next-hist').addEventListener('click', () => changeHistoryPage(1));

    // Carregamento inicial
    loadCustomers();
}

// =========================================
// LÓGICA DE CLIENTES
// =========================================

async function loadCustomers(page = customerState.page) {
    try {
        const data = await Api.getCustomers(page, customerState.limit, customerState.search);
        customerState.page = page;
        customerState.totalPages = data.pagination.totalPages;
        renderCustomerTable(data.data);
        updateCustomerPaginationUI();
    } catch (err) {
        console.error(err);
        alert('Erro ao carregar clientes');
    }
}

function renderCustomerTable(customers) {
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
                    <button class="btn-history">Histórico</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function handleCustomerTableClick(e) {
    const tr = e.target.closest('tr');
    if (!tr) return;
    const customer = JSON.parse(tr.dataset.json);

    if (e.target.closest('.btn-edit')) openCustomerModal(customer);
    if (e.target.closest('.btn-pay')) openPaymentModal(customer);
    if (e.target.closest('.btn-history')) viewHistory(customer.id);
}

function openCustomerModal(c = null) {
    const modal = $('#customer-modal');
    modal.style.display = 'block';
    console.log(c);
    $('#customer-modal-title').innerText = c ? 'Editar Cliente' : 'Novo Cliente';
    $('#cust-id').value = c ? c.id : '';
    $('#cust-name').value = c ? c.name : '';
    $('#cust-phone').value = c ? c.phone : '';
    $('#cust-initial-debt').value = c ? c.balance ? c.balance.toFixed(2) : '' : '';
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

function changeCustomerPage(delta) {
    const newPage = customerState.page + delta;
    if (newPage > 0 && newPage <= customerState.totalPages) loadCustomers(newPage);
}

function updateCustomerPaginationUI() {
    $('#customer-page-info').innerText = `Página ${customerState.page} de ${customerState.totalPages}`;
    $('#btn-prev-cust').disabled = customerState.page <= 1;
    $('#btn-next-cust').disabled = customerState.page >= customerState.totalPages;
}

// =========================================
// LÓGICA DE PAGAMENTOS
// =========================================

function openPaymentModal(customer) {
    $('#pay-cust-id').value = customer.id;
    $('#pay-cust-name-display').innerText = `Cliente: ${customer.name}`;
    $('#payment-modal').style.display = 'block';
    $('#pay-amount').value = '';
    $('#pay-date').value = '';
    $('#pay-amount').focus();
}

async function submitPayment(e) {
    e.preventDefault();
    const id = $('#pay-cust-id').value;
    const amount = parseFloat($('#pay-amount').value);
    const date = $('#pay-date').value;

    try {
        const res = await Api.payDebt(id, amount, date);
        console.log(res);
        if (res.ok) {
            alert("Pagamento registrado!");
            $('#payment-modal').style.display = 'none';
            loadCustomers(); // Atualiza saldo na tabela
        } else {
            alert("Erro ao registrar pagamento.");
        }
    } catch (err) { console.error(err); }
}

// =========================================
// LÓGICA DE HISTÓRICO
// =========================================

function viewHistory(id, page = 1) {
    historyState.customerId = id;
    historyState.page = page;

    $('#history-list').innerHTML = '<li>Carregando...</li>';
    $('#history-modal').style.display = 'block';

    // Reseta filtros visuais ao abrir
    if (page === 1) {
        $('#history-start').value = '';
        $('#history-end').value = '';
        historyState.startDate = '';
        historyState.endDate = '';
    }

    loadHistoryData();
}

async function loadHistoryData() {
    const { customerId, page, limit, startDate, endDate } = historyState;
    try {
        const response = await Api.getHistory(customerId, page, { limit, startDate, endDate });
        historyState.totalPages = response.pagination.totalPages;
        renderHistoryList(response.data);
        updateHistoryPaginationUI();
    } catch (err) { console.error(err); }
}

function renderHistoryList(data) {
    const list = $('#history-list');
    list.innerHTML = '';

    if (data.length === 0) {
        list.innerHTML = '<li style="text-align:center; padding:1rem;">Sem histórico.</li>';
        return;
    }

    data.forEach(row => {
        const dateObj = new Date(row.created_at);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (row.type === 'payment') {
            list.innerHTML += `
            <li style="border-left: 4px solid #4facfe; padding-left: 10px; background: #252541; margin-bottom:10px; border-radius:4px; padding: 10px;">
                <div style="display:flex; justify-content:space-between;">
                    <strong>${dateStr}</strong>
                    <span style="color: #4facfe; font-weight:bold;">PAGAMENTO</span>
                </div>
                <div>Valor: ${formatMoney(row.amount)}</div>
            </li>`;
        } else {
            console.log(row);
            let itemsHtml = '<ul style="margin:5px 0 5px 15px; font-size:0.9em; color:#b8b8d1;">';
            if (row.items) row.items.forEach(i => itemsHtml += `<li>${i.name} x${i.quantity}</li>`);
            itemsHtml += '</ul>';

            const discTxt = row.discount > 0 ? `<span style="color: #f5576c; font-size:0.85em;">(Desc: -${formatMoney(row.discount)})</span>` : '';

            list.innerHTML += `
            <li style="border-left: 4px solid #f5576c; padding-left: 10px; margin-bottom:10px; padding: 10px;">
                <div style="display:flex; justify-content:space-between;">
                    <strong>${dateStr}</strong>
                    <span style="font-weight:bold;">Total: ${formatMoney(row.amount)}</span>
                </div>
                ${discTxt}
                ${itemsHtml}
            </li>`;
        }
    });
}

function applyHistoryFilter() {
    historyState.startDate = $('#history-start').value;
    historyState.endDate = $('#history-end').value;
    loadHistoryData(); // Recarrega usando os novos filtros do estado
}

function changeHistoryPage(delta) {
    const newPage = historyState.page + delta;
    if (newPage > 0 && newPage <= historyState.totalPages) {
        historyState.page = newPage;
        loadHistoryData();
    }
}

function updateHistoryPaginationUI() {
    $('#history-page-info').innerText = `Página ${historyState.page} de ${historyState.totalPages}`;
    $('#btn-prev-hist').disabled = historyState.page <= 1;
    $('#btn-next-hist').disabled = historyState.page >= historyState.totalPages;
}