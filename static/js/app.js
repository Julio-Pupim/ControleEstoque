// O "const API_URL" foi removido. Agora usamos window.Api (definido no api.js)

function showSection(sectionId) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById(sectionId).style.display = 'block';
    if (document.getElementById('main-menu').classList.contains('active')) toggleMobileMenu();

    if (sectionId === 'products') {
        loadCategoriesFilter();
        loadProducts();
    }
    if (sectionId === 'customers') loadCustomers();
    if (sectionId === 'pos') loadPOS();
    if (sectionId === 'reports') loadBestCustomer();
}

function toggleMobileMenu() { document.getElementById('main-menu').classList.toggle('active'); }

let productState = { page: 1, totalPages: 1, limit: 10, search: '', categoryId: '' };
let customerState = { page: 1, totalPages: 1, limit: 10, search: '' };
let historyState = { page: 1, totalPages: 1, limit: 5, customerId: null, startDate: '', endDate: '' };
let searchTimeout = null;

// --- Products ---
async function loadBrandsAndCategoriesForModal() {
    try {
        const [brands, categories] = await Promise.all([Api.getBrands(), Api.getCategories()]);

        const brandSelect = document.getElementById('prod-brand');
        brandSelect.innerHTML = '<option value="">Selecione...</option>';
        brands.forEach(b => {
            brandSelect.innerHTML += `<option value="${b.id}">${b.name}</option>`;
        });

        const categorySelect = document.getElementById('prod-category');
        categorySelect.innerHTML = '<option value="">Selecione...</option>';
        categories.forEach(c => {
            categorySelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });

    } catch (e) { console.error("Error loading modal options:", e); }
}

async function checkProductExistence(barcode) {
    if (!barcode) return;

    // Only check if we are in "New Product" mode (no ID)
    const id = document.getElementById('prod-id').value;
    if (id) return;

    try {
        const product = await Api.getProductByBarcode(barcode);
        if (product) {
            // Smart Stock Mode
            document.getElementById('prod-id').value = product.id; // Store ID for update
            document.getElementById('prod-code').value = product.code || '';
            document.getElementById('prod-name').value = product.name;
            document.getElementById('prod-name').value = product.name;
            document.getElementById('prod-brand').value = product.brand_id; // Using ID
            document.getElementById('prod-category').value = product.category_id || ''; // Using ID
            document.getElementById('prod-price').value = product.price;

            // Disable fields
            document.getElementById('prod-code').disabled = true;
            document.getElementById('prod-name').disabled = true;
            document.getElementById('prod-brand').disabled = true;
            document.getElementById('prod-category').disabled = true;
            document.getElementById('prod-price').disabled = true;

            // Focus stock and change label
            document.getElementById('prod-stock-label').innerText = "Adicionar ao Estoque (Atual: " + product.stock + "):";
            document.getElementById('prod-stock').value = '';
            document.getElementById('prod-stock').focus();

            // Store original stock to calculate total later (optional, handled in backend or logic below)
            document.getElementById('prod-stock').dataset.currentStock = product.stock;
        }
    } catch (err) {
        console.error("Error checking product existence:", err);
    }
}

async function loadProducts(page = 1) {
    productState.page = page;
    try {
        const response = await Api.getProducts(page, productState.limit, productState.search, productState.categoryId);

        productState.totalPages = response.pagination.totalPages;
        const tbody = document.getElementById('products-list');
        tbody.innerHTML = '';
        response.data.forEach(p => {
            tbody.innerHTML += `
            <tr>
                <td>${p.name}</td>
                <td>${p.brand}</td>
                <td>${p.category || '-'}</td>
                <td>R$ ${p.price.toFixed(2)}</td>
                <td>${p.stock}</td>
                <td>
                    <div class="action-buttons">
                        <button onclick='editProduct(${JSON.stringify(p)})'>Editar</button>
                        <button onclick='deleteProduct(${p.id})'>Excluir</button>
                    </div>
                </td>
            </tr>`;
        });
        updatePaginationUI('product', productState);
    } catch (err) { console.error(err); }
}
function debounceProductSearch(e) { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { productState.search = e.target.value.trim(); loadProducts(1); }, 500); }
function changeProductPage(d) { if (productState.page + d > 0 && productState.page + d <= productState.totalPages) loadProducts(productState.page + d); }

function filterProductsByCategory(catId) {
    productState.categoryId = catId;
    loadProducts(1);
}

async function loadCategoriesFilter() {
    try {
        const categories = await Api.getCategories();
        const select = document.getElementById('product-category-filter');
        const currentVal = select.value;

        // Preserve "Todas as Categorias"
        select.innerHTML = '<option value="">Todas as Categorias</option>';

        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.innerText = c.name;
            select.appendChild(opt);
        });

        if (currentVal) select.value = currentVal;
    } catch (e) { console.error("Error loading categories:", e); }
}

async function openProductModal(p = null) {
    document.getElementById('product-modal').style.display = 'block';
    document.getElementById('prod-stock-label').innerText = "Estoque:";

    // Ensure options are loaded
    await loadBrandsAndCategoriesForModal();

    // Reset disabled state
    document.getElementById('prod-name').disabled = false;
    document.getElementById('prod-brand').disabled = false;
    document.getElementById('prod-category').disabled = false;
    document.getElementById('prod-price').disabled = false;
    document.getElementById('prod-code').disabled = false;
    delete document.getElementById('prod-stock').dataset.currentStock;

    if (p) {
        document.getElementById('product-modal-title').innerText = 'Editar Produto';
        document.getElementById('prod-id').value = p.id;
        document.getElementById('prod-barcode').value = p.barcode;
        document.getElementById('prod-code').value = p.code || '';
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-brand').value = p.brand_id;
        document.getElementById('prod-category').value = p.category_id || '';
        document.getElementById('prod-price').value = p.price;
        document.getElementById('prod-stock').value = p.stock;
    } else {
        document.getElementById('product-modal-title').innerText = 'Novo Produto';
        document.getElementById('product-form').reset();
        document.getElementById('prod-id').value = '';
    }
}

async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    let stock = parseInt(document.getElementById('prod-stock').value);

    // Smart Stock Logic: If adding to existing stock
    const currentStock = document.getElementById('prod-stock').dataset.currentStock;
    if (currentStock) {
        stock += parseInt(currentStock);
    }

    const body = {
        id: id || null,
        barcode: document.getElementById('prod-barcode').value,
        code: document.getElementById('prod-code').value,
        name: document.getElementById('prod-name').value,
        brand_id: document.getElementById('prod-brand').value,
        category_id: document.getElementById('prod-category').value,
        price: parseFloat(document.getElementById('prod-price').value),
        stock: stock
    };

    await Api.saveProduct(body);

    closeModal('product-modal');
    loadProducts(productState.page);
}
function editProduct(p) { openProductModal(p); }
async function deleteProduct(id) {
    if (confirm('Confirmar exclusão?')) {
        await Api.deleteProduct(id);
        loadProducts(productState.page);
    }
}

// --- Customers ---
async function loadCustomers(page = 1) {
    customerState.page = page;
    try {
        const response = await Api.getCustomers(page, customerState.limit, customerState.search);

        customerState.totalPages = response.pagination.totalPages;
        const tbody = document.getElementById('customers-list');
        tbody.innerHTML = '';
        response.data.forEach(c => {
            tbody.innerHTML += `
            <tr>
                <td>${c.id}</td>
                <td>${c.name}</td>
                <td>${c.phone}</td>
                <td style="color: ${c.balance > 0.01 ? '#ff4d4f' : '#52c41a'}; font-weight:600;">R$ ${c.balance.toFixed(2)}</td>
                <td>
                    <div class="action-buttons">
                        <button onclick='editCustomer(${JSON.stringify(c)})'>Editar</button>
                        <button onclick='openPaymentModal(${c.id}, "${c.name}")' class="btn-pay">Pagar</button>
                        <button onclick='viewHistory(${c.id})'>Histórico</button>
                    </div>
                </td>
            </tr>`;
        });
        updatePaginationUI('customer', customerState);
    } catch (err) { console.error(err); }
}
function debounceCustomerSearch(e) { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { customerState.search = e.target.value.trim(); loadCustomers(1); }, 500); }
function changeCustomerPage(d) { if (customerState.page + d > 0 && customerState.page + d <= customerState.totalPages) loadCustomers(customerState.page + d); }

function openCustomerModal(c = null) {
    document.getElementById('customer-modal').style.display = 'block';

    if (c) {
        document.getElementById('customer-modal-title').innerText = 'Editar Cliente';
        document.getElementById('cust-id').value = c.id;
        document.getElementById('cust-name').value = c.name;
        document.getElementById('cust-phone').value = c.phone;
        document.getElementById('cust-initial-debt').value = c.balance.toFixed(2);
        document.getElementsByTagName("small")[0].style.display = 'none';
    } else {
        document.getElementById('customer-modal-title').innerText = 'Novo Cliente';
        document.getElementById('customer-form').reset();
        document.getElementById('cust-id').value = '';
        initialDebtContainer.style.display = 'block';
        document.getElementById('cust-initial-debt').value = '';
    }
}

async function saveCustomer(e) {
    e.preventDefault();
    const id = document.getElementById('cust-id').value;
    const initialDebtVal = document.getElementById('cust-initial-debt').value;

    const body = {
        id: id || null,
        name: document.getElementById('cust-name').value,
        phone: document.getElementById('cust-phone').value,
        initialBalance: (!id && initialDebtVal) ? parseFloat(initialDebtVal) : 0
    };

    await Api.saveCustomer(body);

    closeModal('customer-modal');
    loadCustomers(customerState.page);
}
function editCustomer(c) { openCustomerModal(c); }
async function deleteCustomer(id) {
    if (confirm('Excluir?')) {
        await Api.deleteCustomer(id);
        loadCustomers(customerState.page);
    }
}

// --- Payments ---
function openPaymentModal(id, name) {
    document.getElementById('pay-cust-id').value = id;
    document.getElementById('pay-cust-name-display').innerText = `Cliente: ${name}`;
    document.getElementById('payment-modal').style.display = 'block';
    document.getElementById('pay-amount').value = '';
    document.getElementById('pay-amount').focus();
    document.getElementById('pay-date').value = ''
}

async function submitPayment(e) {
    e.preventDefault();
    const id = document.getElementById('pay-cust-id').value;
    const amount = document.getElementById('pay-amount').value;
    const date = document.getElementById('pay-date').value;
    const res = await Api.payDebt(id, parseFloat(amount), date);

    if (res.ok) { alert("Pagamento registrado!"); closeModal('payment-modal'); loadCustomers(customerState.page); }
    else alert("Erro ao registrar pagamento.");
}

// --- History ---
function viewHistory(id, page = 1) {
    historyState.customerId = id;
    historyState.page = page;
    if (page === 1) document.getElementById('history-list').innerHTML = '<li>Carregando...</li>';
    document.getElementById('history-modal').style.display = 'block';
    loadHistoryData();
}

async function loadHistoryData() {
    const { customerId, page, limit, startDate, endDate } = historyState;

    const response = await Api.getHistory(customerId, page, { limit, startDate, endDate });

    historyState.totalPages = response.pagination.totalPages;
    const list = document.getElementById('history-list');
    list.innerHTML = '';

    if (response.data.length === 0) list.innerHTML = '<li style="text-align:center; padding:1rem;">Sem histórico.</li>';

    response.data.forEach(row => {
        const dateObj = new Date(row.created_at);
        const date = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (row.type === 'payment') {
            list.innerHTML += `
            <li style="border-left: 4px solid #4facfe; padding-left: 10px; background: #252541; margin-bottom:10px; border-radius:4px;">
                <div style="display:flex; justify-content:space-between;">
                    <strong>${date}</strong>
                    <span style="color: #4facfe; font-weight:bold;">PAGAMENTO</span>
                </div>
                <div>Valor: R$ ${row.amount.toFixed(2)}</div>
            </li>`;
        } else {
            let itemsHtml = '<ul style="margin:5px 0 5px 15px; font-size:0.9em; color:#b8b8d1;">';
            if (row.items) row.items.forEach(i => itemsHtml += `<li>${i.name} x${i.quantity}</li>`);
            itemsHtml += '</ul>';

            const discTxt = row.discount > 0 ? `<span style="color: #f5576c; font-size:0.85em;">(Desc: -R$ ${row.discount.toFixed(2)})</span>` : '';

            list.innerHTML += `
            <li style="border-left: 4px solid #f5576c; padding-left: 10px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between;">
                    <strong>${date}</strong>
                    <span style="font-weight:bold;">Total: R$ ${row.total.toFixed(2)}</span>
                </div>
                ${discTxt}
                ${itemsHtml}
            </li>`;
        }
    });
    updatePaginationUI('history', historyState);
}
function applyHistoryFilter() { historyState.startDate = document.getElementById('history-start').value; historyState.endDate = document.getElementById('history-end').value; historyState.page = 1; loadHistoryData(); }
function changeHistoryPage(d) { if (historyState.page + d > 0 && historyState.page + d <= historyState.totalPages) { historyState.page += d; loadHistoryData(); } }

// --- POS ---
let cart = [];
let posSearchTimeout;

async function loadPOS() {
    const response = await Api.getCustomers(1, 500); // Traz 500 clientes

    const select = document.getElementById('pos-customer-select');
    select.innerHTML = '<option value="">Selecione um cliente</option>';
    response.data.forEach(c => { select.innerHTML += `<option value="${c.id}">${c.name}</option>`; });
    cart = [];
    document.getElementById('pos-discount').value = 0;
    document.getElementById('pos-quantity').value = 1;
    updateCartUI();
    document.getElementById('pos-search-unified').focus();
}

async function handleSearchInput(e) {
    const query = e.target.value.trim();
    const resultsDiv = document.getElementById('search-results');
    if (!query) { resultsDiv.classList.remove('active'); resultsDiv.innerHTML = ''; return; }
    clearTimeout(posSearchTimeout);
    posSearchTimeout = setTimeout(async () => {
        const products = await Api.searchProducts(query);
        displaySearchResults(products);
    }, 300);
}

async function handleSearchKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const query = e.target.value.trim();
        if (!query) return;

        const product = await Api.getProductByBarcode(query);

        if (product) { selectProduct(product); }
        else {
            const resultsDiv = document.getElementById('search-results');
            if (resultsDiv.children.length === 1 && resultsDiv.children[0].onclick) resultsDiv.children[0].click();
        }
    }
}

function displaySearchResults(products) {
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '';
    if (products.length === 0) { resultsDiv.classList.remove('active'); return; }
    products.forEach(p => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `<div class="search-result-name">${p.name}</div><div class="search-result-details">${p.brand} | R$ ${p.price.toFixed(2)}</div>`;
        item.onclick = () => selectProduct(p);
        resultsDiv.appendChild(item);
    });
    resultsDiv.classList.add('active');
}

function selectProduct(p) {
    addToCart(p);
    const input = document.getElementById('pos-search-unified');
    input.value = ''; input.focus();
    document.getElementById('search-results').classList.remove('active');
    document.getElementById('pos-product-info').innerText = `Adicionado: ${p.name}`;
    document.getElementById('pos-quantity').value = 1;
}

document.addEventListener('click', (e) => {
    const container = document.querySelector('.pos-input');
    if (container && !container.contains(e.target)) document.getElementById('search-results').classList.remove('active');
});

function addToCart(product) {
    const qtyInput = document.getElementById('pos-quantity');
    let qty = parseInt(qtyInput.value);
    if (isNaN(qty) || qty < 1) qty = 1;
    const existing = cart.find(i => i.product.id === product.id);
    if (existing) existing.quantity += qty;
    else cart.push({ product: product, quantity: qty });
    updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById('pos-cart-list');
    list.innerHTML = '';
    let subTotal = 0;
    cart.forEach((item, index) => {
        const itemTotal = item.product.price * item.quantity;
        subTotal += itemTotal;
        list.innerHTML += `<li><span>${item.product.name} x${item.quantity}</span><div><strong>R$ ${itemTotal.toFixed(2)}</strong><button onclick="removeFromCart(${index})" style="color:red; margin-left:5px; border:none; background:none; cursor:pointer;">X</button></div></li>`;
    });
    subTotal = Math.round(subTotal * 100) / 100;
    const discountInput = document.getElementById('pos-discount');
    let discount = parseFloat(discountInput.value) || 0;
    let finalTotal = Math.max(0, subTotal - discount);
    finalTotal = Math.round(finalTotal * 100) / 100;
    document.getElementById('pos-total').innerHTML = `${finalTotal.toFixed(2)} <span style="font-size:0.8em; color:gray;">(Sub: ${subTotal.toFixed(2)})</span>`;
}
function removeFromCart(index) { cart.splice(index, 1); updateCartUI(); }

async function finalizeSale() {
    if (cart.length === 0) return alert('Carrinho vazio!');
    const customerId = document.getElementById('pos-customer-select').value;
    if (!customerId) return alert('Selecione um cliente!');
    const discountVal = parseFloat(document.getElementById('pos-discount').value) || 0;

    const saleData = { customer_id: parseInt(customerId), discount: discountVal, items: cart.map(i => ({ product_id: i.product.id, quantity: i.quantity })) };

    const res = await Api.createSale(saleData);

    if (res.ok) { alert('Venda realizada!'); cart = []; document.getElementById('pos-discount').value = 0; updateCartUI(); document.getElementById('pos-product-info').innerText = ''; }
    else { const err = await res.json(); alert('Erro: ' + err.error); }
}

async function loadBestCustomer() {
    const data = await Api.getBestCustomer();
    document.getElementById('best-customer-display').innerHTML = data.Name ? `<p><strong>${data.Name}</strong><br>R$ ${data.TotalSpent.toFixed(2)}</p>` : 'Sem dados.';
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function updatePaginationUI(type, state) {
    const info = document.getElementById(`${type}-page-info`);
    const container = document.getElementById(`${type}-pagination`);
    if (info) info.innerText = `Página ${state.page} de ${state.totalPages}`;
    const btns = container.getElementsByTagName('button');
    btns[0].disabled = state.page <= 1;
    btns[1].disabled = state.page >= state.totalPages;
}
window.onclick = function (e) { if (e.target.classList.contains('modal')) e.target.style.display = "none"; }