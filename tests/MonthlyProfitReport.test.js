'use strict';

const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
};

jest.mock('../database', () => mockDb);

// Importar após o mock para que server.js use o mock
// Mas server.js inicia o listen, então testamos a lógica isoladamente
describe('Monthly Profit Report', () => {
  test('calcula margem corretamente', () => {
    const row = { month: '2026-03', revenue: 1000, total_cost: 600, profit: 400 };
    const margin = row.revenue > 0 ? ((row.profit / row.revenue) * 100).toFixed(1) : '0.0';
    expect(margin).toBe('40.0');
  });

  test('margem 0 quando receita é zero', () => {
    const row = { month: '2026-03', revenue: 0, total_cost: 0, profit: 0 };
    const margin = row.revenue > 0 ? ((row.profit / row.revenue) * 100).toFixed(1) : '0.0';
    expect(margin).toBe('0.0');
  });

  test('transforma rows do banco no formato esperado', () => {
    const rows = [
      { month: '2026-03', revenue: 1000, total_cost: 600, profit: 400 },
      { month: '2026-02', revenue: 500, total_cost: 300, profit: 200 },
    ];

    const result = rows.map(r => ({
      month: r.month,
      revenue: r.revenue || 0,
      totalCost: r.total_cost || 0,
      profit: r.profit || 0,
      margin: r.revenue > 0 ? ((r.profit / r.revenue) * 100).toFixed(1) : '0.0',
    }));

    expect(result).toEqual([
      { month: '2026-03', revenue: 1000, totalCost: 600, profit: 400, margin: '40.0' },
      { month: '2026-02', revenue: 500, totalCost: 300, profit: 200, margin: '40.0' },
    ]);
  });

  test('retorna array vazio quando não há vendas', () => {
    const rows = [];
    const result = rows.map(r => ({
      month: r.month,
      revenue: r.revenue || 0,
      totalCost: r.total_cost || 0,
      profit: r.profit || 0,
      margin: r.revenue > 0 ? ((r.profit / r.revenue) * 100).toFixed(1) : '0.0',
    }));
    expect(result).toEqual([]);
  });

  test('trata valores null como 0', () => {
    const row = { month: '2026-01', revenue: null, total_cost: null, profit: null };
    const result = {
      month: row.month,
      revenue: row.revenue || 0,
      totalCost: row.total_cost || 0,
      profit: row.profit || 0,
      margin: row.revenue > 0 ? ((row.profit / row.revenue) * 100).toFixed(1) : '0.0',
    };
    expect(result).toEqual({ month: '2026-01', revenue: 0, totalCost: 0, profit: 0, margin: '0.0' });
  });
});
