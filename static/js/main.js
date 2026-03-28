import { initProducts } from './modules/products.js';
import { initCustomers } from './modules/customers.js';
import { initPos } from './modules/pos.js';
import { initReports } from './modules/reports.js';
import { initCategories } from './modules/categories.js';
import { initNFeImport } from './modules/NfeImport.js';

const sections = {
    'pos':       { init: initPos, loaded: false },
    'products':  { init: initProducts, loaded: false },
    'customers':  { init: initCustomers, loaded: false },
    'categories': { init: initCategories, loaded: false },
    'reports':    { init: initReports, loaded: false }
};

const PARTIALS = ['pos', 'products', 'customers', 'categories', 'reports'];

async function loadPartials() {
    const results = await Promise.all(
        PARTIALS.map(name =>
            fetch(`/static/partials/${name}.html`).then(r => {
                if (!r.ok) throw new Error(`Falha ao carregar partial: ${name}`);
                return r.text();
            })
        )
    );

    const main = document.getElementById('main-content');
    const modalContainer = document.getElementById('modal-container');

    for (const html of results) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        temp.querySelectorAll('section').forEach(el => main.appendChild(el));
        temp.querySelectorAll('.modal, .nfe-modal-overlay').forEach(el => modalContainer.appendChild(el));
    }
}

function navigateTo(sectionId) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';

    const menu = document.getElementById('main-menu');
    if (menu.classList.contains('active')) menu.classList.remove('active');

    const cfg = sections[sectionId];
    if (cfg && cfg.init && !cfg.loaded) {
        cfg.init();
        cfg.loaded = true;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadPartials();

    // Configurar menu
    document.querySelectorAll('.menu button').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            if (section) navigateTo(section);
        });
    });

    initNFeImport();
    navigateTo('pos');

    // Fechar modais com X
    document.querySelectorAll('.close').forEach(span => {
        span.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
});

window.toggleMobileMenu = () =>
    document.getElementById('main-menu').classList.toggle('active');
