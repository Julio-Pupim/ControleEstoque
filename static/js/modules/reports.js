import { Api } from '../api.js';
import { formatMoney, $ } from '../utils.js';

export function initReports() {
    // Listener do botão de atualizar
    $('#btn-refresh-report').addEventListener('click', loadBestCustomer);

    // Carrega automaticamente ao entrar na aba (opcional)
    loadBestCustomer();
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