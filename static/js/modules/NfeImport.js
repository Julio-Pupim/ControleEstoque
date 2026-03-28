import { Api } from '../api.js';
import { $ } from '../utils.js';
import {
    renderEmitterInfo,
    renderStats,
    renderProductRow,
    renderResult,
} from './nfeRenderers.js';

// --- Estado do modulo ---

let previewData     = null;
let brandsCache     = [];
let categoriesCache = [];
let listenersReady  = false;

// --- Init ---

export function initNFeImport() {
    const btn = $('#btn-nfe-import');
    if (!btn) return;
    btn.addEventListener('click', openModal);
}

async function openModal() {
    resetModal();
    $('#nfe-modal').style.display = 'flex';

    if (brandsCache.length === 0 || categoriesCache.length === 0) {
        try {
            [brandsCache, categoriesCache] = await Promise.all([
                Api.getBrands(),
                Api.getCategories(),
            ]);
        } catch {
            showError('Nao foi possivel carregar marcas e categorias. Tente novamente.');
            return;
        }
    }

    attachListeners();
}

function attachListeners() {
    if (listenersReady) return;
    listenersReady = true;

    $('#nfe-file-input').addEventListener('change', handleFileSelect);
    $('#nfe-preview-form').addEventListener('submit', handleImport);

    $('#nfe-product-rows').addEventListener('change', (e) => {
        if (e.target.classList.contains('nfe-update-price-chk')) {
            const idx = e.target.dataset.idx;
            const priceInput = document.querySelector(`.nfe-price-input[data-idx="${idx}"]`);
            if (priceInput) priceInput.style.display = e.target.checked ? 'block' : 'none';
        }
    });

    $('#nfe-modal').addEventListener('click', (e) => {
        if (e.target === $('#nfe-modal')) closeModal();
    });

    $('#nfe-btn-close').addEventListener('click', closeModal);
    $('#nfe-btn-back').addEventListener('click', () => showStep('upload'));
}

// --- Leitura do arquivo ---

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xml')) {
        showError('Selecione um arquivo .xml de NF-e.');
        return;
    }

    showStep('loading');

    try {
        const xmlText = await readFileAsText(file);
        const data = await Api.nfePreview(xmlText);
        previewData = data;
        renderPreview(data);
        showStep('preview');
    } catch (err) {
        showError(err.message || 'Erro ao processar o arquivo.');
    }
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
        reader.readAsText(file, 'UTF-8');
    });
}

// --- Preview ---

function renderPreview(data) {
    $('#nfe-emitter-info').innerHTML = renderEmitterInfo(data);
    $('#nfe-stats').innerHTML = renderStats(data.products);

    const tbody = $('#nfe-product-rows');
    tbody.innerHTML = data.products
        .map((p, idx) => renderProductRow(idx, p, brandsCache, categoriesCache))
        .join('');
}

// --- Import ---

async function handleImport(e) {
    e.preventDefault();
    if (!previewData) return;

    const products = previewData.products.map((p, idx) => {
        const row = document.querySelector(`tr[data-idx="${idx}"]`);
        const priceInput     = row.querySelector('.nfe-price-input');
        const updatePriceChk = row.querySelector('.nfe-update-price-chk');
        const nameInput      = row.querySelector('.nfe-name-input');
        const barcodeInput   = row.querySelector('.nfe-barcode-input');
        const codeInput      = row.querySelector('.nfe-code-input');

        return {
            ...p,
            name:        nameInput    ? nameInput.value.trim()             : p.name,
            barcode:     barcodeInput ? (barcodeInput.value.trim() || null) : p.barcode,
            code:        codeInput    ? codeInput.value.trim()             : p.code,
            action:      row.querySelector('.nfe-action-sel').value,
            brand_id:    parseInt(row.querySelector('.nfe-brand-sel').value) || null,
            category_id: parseInt(row.querySelector('.nfe-cat-sel').value)   || null,
            salePrice:   priceInput  ? parseFloat(priceInput.value) || 0 : 0,
            updatePrice: updatePriceChk ? updatePriceChk.checked : false,
        };
    });

    showStep('loading');

    try {
        const result = await Api.nfeImport(products);
        $('#nfe-result').innerHTML = renderResult(result);
        showStep('result');
    } catch (err) {
        showError(err.message || 'Erro ao importar produtos.');
    }
}

// --- Helpers de UI ---

function showStep(step) {
    ['upload', 'loading', 'preview', 'result'].forEach(s => {
        const el = $(`#nfe-step-${s}`);
        if (el) el.style.display = s === step ? 'block' : 'none';
    });
}

function showError(message) {
    showStep('upload');
    const err = $('#nfe-upload-error');
    if (err) {
        err.textContent = message;
        err.style.display = 'block';
    }
}

function closeModal() {
    $('#nfe-modal').style.display = 'none';
}

function resetModal() {
    previewData = null;
    const fileInput = $('#nfe-file-input');
    if (fileInput) fileInput.value = '';
    const err = $('#nfe-upload-error');
    if (err) err.style.display = 'none';
    showStep('upload');
}
