// Formata moeda (BRL)
export const formatMoney = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// Função de Debounce (para a busca não disparar a cada tecla)
export const debounce = (func, wait) => {
    let timeout;
    return function (...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Atalho para selecionar elementos (estilo jQuery, mas nativo)
export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);

// Helper para preencher selects
export const populateSelect = (elementId, data, placeholder = 'Selecione...') => {
    const select = $(elementId);
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    data.forEach(item => {
        select.innerHTML += `<option value="${item.id}">${item.name}</option>`;
    });
};