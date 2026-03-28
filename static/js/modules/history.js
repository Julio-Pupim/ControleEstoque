import { Api } from '../api.js';
import { formatMoney, $ } from '../utils.js';

let state = { page: 1, limit: 5, totalPages: 1, customerId: null, startDate: '', endDate: '' };

/**
 * Inicializa listeners do modal de historico.
 * Chamado uma vez pelo initCustomers().
 */
export function initHistory() {
    $('#btn-filter-history').addEventListener('click', applyFilter);
    $('#btn-prev-hist').addEventListener('click', () => changePage(-1));
    $('#btn-next-hist').addEventListener('click', () => changePage(1));
}

export function viewHistory(id) {
    state.customerId = id;
    state.page = 1;
    state.startDate = '';
    state.endDate = '';

    $('#history-start').value = '';
    $('#history-end').value = '';
    $('#history-list').innerHTML = '<li>Carregando...</li>';
    $('#history-modal').style.display = 'block';

    loadData();
}

async function loadData() {
    const { customerId, page, limit, startDate, endDate } = state;
    try {
        const response = await Api.getHistory(customerId, page, { limit, startDate, endDate });
        state.totalPages = response.pagination.totalPages;
        renderList(response.data);
        updatePagination();
    } catch (err) { console.error(err); }
}

function renderList(data) {
    const list = $('#history-list');
    list.innerHTML = '';

    if (data.length === 0) {
        list.innerHTML = '<li style="text-align:center; padding:1rem;">Sem historico.</li>';
        return;
    }

    data.forEach(row => {
        const dateStr = formatDate(row.created_at);
        list.innerHTML += row.type === 'payment'
            ? renderPaymentItem(dateStr, row)
            : renderSaleItem(dateStr, row);
    });
}

function renderPaymentItem(dateStr, row) {
    return `
    <li style="border-left: 4px solid #4facfe; padding-left: 10px; background: #252541; margin-bottom:10px; border-radius:4px; padding: 10px;">
        <div style="display:flex; justify-content:space-between;">
            <strong>${dateStr}</strong>
            <span style="color: #4facfe; font-weight:bold;">PAGAMENTO</span>
        </div>
        <div>Valor: ${formatMoney(row.amount)}</div>
    </li>`;
}

function renderSaleItem(dateStr, row) {
    let itemsHtml = '<ul style="margin:5px 0 5px 15px; font-size:0.9em; color:#b8b8d1;">';
    if (row.items) row.items.forEach(i => itemsHtml += `<li>${i.name} x${i.quantity}</li>`);
    itemsHtml += '</ul>';

    const discTxt = row.discount > 0
        ? `<span style="color: #f5576c; font-size:0.85em;">(Desc: -${formatMoney(row.discount)})</span>`
        : '';

    return `
    <li style="border-left: 4px solid #f5576c; padding-left: 10px; margin-bottom:10px; padding: 10px;">
        <div style="display:flex; justify-content:space-between;">
            <strong>${dateStr}</strong>
            <span style="font-weight:bold;">Total: ${formatMoney(row.amount)}</span>
        </div>
        ${discTxt}
        ${itemsHtml}
    </li>`;
}

function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function applyFilter() {
    state.startDate = $('#history-start').value;
    state.endDate = $('#history-end').value;
    state.page = 1;
    loadData();
}

function changePage(delta) {
    const newPage = state.page + delta;
    if (newPage > 0 && newPage <= state.totalPages) {
        state.page = newPage;
        loadData();
    }
}

function updatePagination() {
    $('#history-page-info').innerText = `Pagina ${state.page} de ${state.totalPages}`;
    $('#btn-prev-hist').disabled = state.page <= 1;
    $('#btn-next-hist').disabled = state.page >= state.totalPages;
}
