import { Api } from '../api.js';
import { formatMoney, $ } from '../utils.js';

let cart = [];
let searchTimeout = null;

export function initPos() {
    // Carrega clientes no select ao iniciar
    loadPosCustomers();

    // Listeners de Busca e Input
    $('#pos-search-unified').addEventListener('input', handleSearchInput);
    $('#pos-search-unified').addEventListener('keydown', handleSearchKeydown);

    // Fechar resultados se clicar fora
    document.addEventListener('click', (e) => {
        const container = $('.pos-input');
        if (container && !container.contains(e.target)) {
            $('#search-results').classList.remove('active');
        }
    });

    // Listener do Botão Finalizar
    $('#btn-finalize-sale').addEventListener('click', finalizeSale);

    // Listener do Desconto (Recalcular total)
    $('#pos-discount').addEventListener('input', updateCartUI);

    // Delegação de eventos para o Carrinho (Botão Remover)
    $('#pos-cart-list').addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-item')) {
            const index = parseInt(e.target.dataset.index);
            removeFromCart(index);
        }
    });

    // Focar no campo de busca ao abrir a aba (opcional, ajuda na UX)
    $('#pos-search-unified').focus();
}

async function loadPosCustomers() {
    try {
        const res = await Api.getCustomers(1, 500); // Traz até 500 clientes
        const select = $('#pos-customer-select');
        select.innerHTML = '<option value="">Selecione um cliente</option>';
        res.data.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    } catch (err) { console.error("Erro ao carregar clientes do PDV", err); }
}

// --- Busca de Produtos ---

function handleSearchInput(e) {
    const query = e.target.value.trim();
    const resultsDiv = $('#search-results');

    if (!query) {
        resultsDiv.classList.remove('active');
        resultsDiv.innerHTML = '';
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            const products = await Api.searchProducts(query);
            displaySearchResults(products);
        } catch (err) { console.error(err); }
    }, 300);
}

function displaySearchResults(products) {
    const resultsDiv = $('#search-results');
    resultsDiv.innerHTML = '';

    if (products.length === 0) {
        resultsDiv.classList.remove('active');
        return;
    }

    products.forEach(p => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
            <div class="search-result-name">${p.name}</div>
            <div class="search-result-details">${p.brand} | ${formatMoney(p.price)}</div>
        `;
        // Aqui usamos closure, mas poderia ser data-attributes
        item.addEventListener('click', () => selectProduct(p));
        resultsDiv.appendChild(item);
    });

    resultsDiv.classList.add('active');
}

async function handleSearchKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const query = e.target.value.trim();
        if (!query) return;

        // Tenta buscar exato por código de barras primeiro
        try {
            const product = await Api.getProductByBarcode(query);
            if (product) {
                selectProduct(product);
            } else {
                // Se não achou direto, vê se tem algo na lista de resultados visual
                const resultsDiv = $('#search-results');
                if (resultsDiv.children.length === 1) {
                    // Simula clique no único resultado
                    resultsDiv.children[0].click();
                }
            }
        } catch (err) { console.error(err); }
    }
}

function selectProduct(p) {
    addToCart(p);

    // Limpar busca e focar novamente
    const input = $('#pos-search-unified');
    input.value = '';
    input.focus();
    $('#search-results').classList.remove('active');

    // Feedback visual rápido
    $('#pos-product-info').innerText = `Adicionado: ${p.name}`;
    setTimeout(() => $('#pos-product-info').innerText = '', 3000);

    // Resetar quantidade
    $('#pos-quantity').value = 1;
}

// --- Carrinho ---

function addToCart(product) {
    const qtyInput = $('#pos-quantity');
    let qty = parseInt(qtyInput.value);
    if (isNaN(qty) || qty < 1) qty = 1;

    const existing = cart.find(i => i.product.id === product.id);
    if (existing) {
        existing.quantity += qty;
    } else {
        cart.push({ product: product, quantity: qty });
    }
    updateCartUI();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

function updateCartUI() {
    const list = $('#pos-cart-list');
    list.innerHTML = '';
    let subTotal = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.product.price * item.quantity;
        subTotal += itemTotal;

        list.innerHTML += `
            <li>
                <span>${item.product.name} x${item.quantity}</span>
                <div>
                    <strong>${formatMoney(itemTotal)}</strong>
                    <button class="btn-remove-item" data-index="${index}" 
                        style="color:red; margin-left:5px; border:none; background:none; cursor:pointer;">X</button>
                </div>
            </li>`;
    });

    // Cálculos finais
    const discountInput = $('#pos-discount');
    let discount = parseFloat(discountInput.value) || 0;

    // Evita desconto negativo ou maior que o total
    if (discount < 0) discount = 0;

    let finalTotal = Math.max(0, subTotal - discount);

    $('#pos-total').innerHTML = `${formatMoney(finalTotal)} <span style="font-size:0.8em; color:gray;">(Sub: ${formatMoney(subTotal)})</span>`;
}

async function finalizeSale() {
    if (cart.length === 0) return alert('Carrinho vazio!');

    const customerId = $('#pos-customer-select').value;
    if (!customerId) return alert('Selecione um cliente!');

    const discountVal = parseFloat($('#pos-discount').value) || 0;

    const saleData = {
        customer_id: parseInt(customerId),
        discount: discountVal,
        items: cart.map(i => ({
            product_id: i.product.id,
            quantity: i.quantity
        }))
    };

    try {
        await Api.createSale(saleData);
        alert('Venda realizada com sucesso!');

        // Resetar PDV
        cart = [];
        $('#pos-discount').value = 0;
        $('#pos-customer-select').value = '';
        updateCartUI();
        $('#pos-product-info').innerText = '';

    } catch (err) {
        alert('Erro ao finalizar venda: ' + err.message);
    }
}