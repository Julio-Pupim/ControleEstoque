import { Api } from '../api.js';
import { formatMoney, $ } from '../utils.js';

export function initReports() {
    $('#btn-refresh-report').addEventListener('click', loadBestCustomer);
    $('#btn-refresh-profit').addEventListener('click', loadMonthlyProfit);

    loadBestCustomer();
    loadMonthlyProfit();
}

async function loadBestCustomer() {
    const display = $('#best-customer-display');
    display.innerHTML = 'Carregando...';

    try {
        const data = await Api.getBestCustomer();

        if (data && data.Name) {
            display.innerHTML = `
                <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">
                    <strong>${data.Name}</strong>
                </p>
                <p style="color: #4facfe; font-weight: bold; font-size: 1.2rem;">
                    ${formatMoney(data.TotalSpent)}
                </p>
            `;
        } else {
            display.innerHTML = 'Sem dados de vendas ainda.';
        }
    } catch (err) {
        console.error(err);
        display.innerHTML = 'Erro ao carregar dados.';
    }
}

async function loadMonthlyProfit() {
    const tbody = $('#monthly-profit-list');
    tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';

    try {
        const data = await Api.getMonthlyProfit();

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Sem dados de vendas ainda.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(r => `
            <tr>
                <td>${formatMonth(r.month)}</td>
                <td>${formatMoney(r.revenue)}</td>
                <td>${formatMoney(r.totalCost)}</td>
                <td style="color: ${r.profit >= 0 ? '#4facfe' : '#ff6b6b'}; font-weight: bold;">
                    ${formatMoney(r.profit)}
                </td>
                <td>${r.margin}%</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5">Erro ao carregar dados.</td></tr>';
    }
}

function formatMonth(yyyymm) {
    const [year, month] = yyyymm.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(month) - 1]}/${year}`;
}
