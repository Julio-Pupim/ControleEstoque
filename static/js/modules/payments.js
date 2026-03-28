import { Api } from '../api.js';
import { $ } from '../utils.js';

/**
 * Inicializa listeners do modal de pagamento.
 * Chamado uma vez pelo initCustomers().
 */
export function initPayments() {
    $('#payment-form').addEventListener('submit', submitPayment);
}

export function openPaymentModal(customer) {
    $('#pay-cust-id').value = customer.id;
    $('#pay-cust-name-display').innerText = `Cliente: ${customer.name}`;
    $('#payment-modal').style.display = 'block';
    $('#pay-amount').value = '';
    $('#pay-date').value = '';
    $('#pay-amount').focus();
}

/**
 * @param {Function} onSuccess - callback para recarregar a lista de clientes
 */
let _onPaymentSuccess = null;

export function setPaymentCallback(fn) {
    _onPaymentSuccess = fn;
}

async function submitPayment(e) {
    e.preventDefault();
    const id = $('#pay-cust-id').value;
    const amount = parseFloat($('#pay-amount').value);
    const date = $('#pay-date').value;

    try {
        await Api.payDebt(id, amount, date);
        alert('Pagamento registrado!');
        $('#payment-modal').style.display = 'none';
        if (_onPaymentSuccess) _onPaymentSuccess();
    } catch (err) {
        console.error(err);
        alert('Erro ao registrar pagamento.');
    }
}
