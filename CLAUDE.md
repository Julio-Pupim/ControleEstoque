# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack inventory management system for a beauty/cosmetics reseller. Express.js backend with SQLite, vanilla JS SPA frontend. Brazilian Portuguese domain (NF-e = electronic invoices, customers with debt balances, promotional cycles by brand).

## Commands

```bash
npm start              # Start server on port 3000 (binds to ::)
npm test               # Run all Jest tests
npm test -- NFeParser  # Run a single test suite by name
npm test -- --watch    # Watch mode
```

No build step — static files served directly. No lint script configured (eslint/prettier are devDependencies but have no npm script).

## Architecture

**Backend (MVC with repository pattern):**

```
server.js (routes + Express setup)
  → controller/*Controller.js (HTTP handling)
    → service/*.js (business logic, XML parsing)
    → repository/*Repository.js (SQL queries)
      → database.js (sqlite3 wrapped with promises: db.run/get/all + db.raw for transactions)
```

**Frontend (vanilla JS SPA):**
- `static/index.html` — single page with tab sections (POS, Products, Customers, Reports)
- `static/js/api.js` — centralized fetch wrapper, all API methods
- `static/js/modules/*.js` — one module per tab (products.js, pos.js, customers.js, reports.js, NfeImport.js)

## Key Domain Concepts

- **NF-e Import Pipeline**: XML upload → `NfeParserService.parseNFe()` (brand detection, NCM→category mapping) → `ProductService.findExistingProduct()` (barcode→code→name fuzzy match) → user resolves conflicts → `NfeController.importProducts()` applies actions (create/update_stock/link/skip)
- **Product Identifiers**: Separate `product_identifiers` table allows multiple barcodes/codes per product. Lookup via `ProductIdentifierRepository.findByIdentifier(type, value)`.
- **Promotional Cycles**: Brand-specific date ranges with promo pricing. Effective price queries LEFT JOIN cycles to show active promo price.
- **Sales**: Transactional (BEGIN/COMMIT/ROLLBACK on `db.raw`) — creates sale + items, deducts stock, updates customer balance atomically.

## Database

SQLite (`inventory.db`, gitignored). Schema auto-created in `database.js` on startup with CREATE TABLE IF NOT EXISTS. Seed data: 7 brands, 15 categories, brand-category mappings. Migrations are additive ALTER/CREATE statements that ignore if already exist.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) auto-deploys on push to master — SSHs into VPS, pulls code, installs deps, restarts PM2 process `estoque-v2`.

## Development Practices

- **TDD**: Sempre desenvolver testes antes ou junto com o código novo. Validar com `npm test` antes de considerar a tarefa concluída.
- **Clean Code**: Seguir princípios de código limpo — nomes significativos, funções pequenas, responsabilidade única, sem duplicação.
- **Refatoração**: Identificar e sugerir refatorações proativamente ao detectar code smells (duplicação, métodos longos, nomes obscuros, acoplamento excessivo).
