import { initProducts } from './modules/products.js';
import { initCustomers } from './modules/customers.js';
import { initPos } from './modules/pos.js';
import { initReports } from './modules/reports.js';

// Roteamento Simples
const sections = {
    'pos': { init: initPos, loaded: false }, // POS geralmente carrega dados frescos sempre
    'products': { init: initProducts, loaded: false },
    'customers': { init: initCustomers, loaded: false },
    'reports': { init: initReports, loaded: false }
};

function navigateTo(sectionId) {
    // Esconde tudo
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');

    // Mostra alvo
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';

    // Gerencia Menu Mobile
    const menu = document.getElementById('main-menu');
    if (menu.classList.contains('active')) menu.classList.remove('active');

    // Inicialização Preguiçosa (Lazy Load)
    const sectionConfig = sections[sectionId];
    if (sectionConfig && sectionConfig.init && !sectionConfig.loaded) {
        sectionConfig.init();
        sectionConfig.loaded = true;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Configurar menu
    document.querySelectorAll('.menu button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = btn.dataset.section;
            if (section) navigateTo(section);
        });
    });

    // Iniciar na seção padrão
    navigateTo('pos');

    // Global Listeners (Modais fechar com X)
    document.querySelectorAll('.close').forEach(span => {
        span.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
});