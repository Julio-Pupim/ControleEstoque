'use strict';

const mockDb = {
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
};

jest.mock('../database', () => mockDb);

const CategoryRepository = require('../repository/CategoryRepository');

beforeEach(() => jest.clearAllMocks());

describe('CategoryRepository.findAll', () => {
    test('retorna categorias com brand_ids parseados', async () => {
        mockDb.all.mockResolvedValue([
            { id: 1, name: 'Creme', brand_ids: '1,2,3' },
            { id: 2, name: 'Perfume', brand_ids: null },
        ]);

        const result = await CategoryRepository.findAll();

        expect(result).toEqual([
            { id: 1, name: 'Creme', brand_ids: [1, 2, 3] },
            { id: 2, name: 'Perfume', brand_ids: [] },
        ]);
        expect(mockDb.all).toHaveBeenCalledWith(
            expect.stringContaining('GROUP_CONCAT')
        );
    });
});

describe('CategoryRepository.findById', () => {
    test('retorna categoria com brand_ids', async () => {
        mockDb.get.mockResolvedValue({ id: 1, name: 'Creme' });
        mockDb.all.mockResolvedValue([{ brand_id: 1 }, { brand_id: 3 }]);

        const result = await CategoryRepository.findById(1);

        expect(result).toEqual({ id: 1, name: 'Creme', brand_ids: [1, 3] });
    });

    test('retorna null se categoria nao existe', async () => {
        mockDb.get.mockResolvedValue(undefined);

        const result = await CategoryRepository.findById(999);

        expect(result).toBeNull();
    });
});

describe('CategoryRepository.create', () => {
    test('cria categoria e sincroniza marcas', async () => {
        mockDb.run.mockResolvedValue({ lastID: 10 });

        const result = await CategoryRepository.create('Nova Cat', [1, 2]);

        expect(result).toEqual({ id: 10, name: 'Nova Cat', brand_ids: [1, 2] });
        // INSERT da categoria
        expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO categories'),
            ['Nova Cat']
        );
        // DELETE antigos + 2 INSERTs de brand_categories
        expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM brand_categories'),
            [10]
        );
        expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT OR IGNORE INTO brand_categories'),
            [1, 10]
        );
        expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT OR IGNORE INTO brand_categories'),
            [2, 10]
        );
    });

    test('cria categoria sem marcas', async () => {
        mockDb.run.mockResolvedValue({ lastID: 11 });

        const result = await CategoryRepository.create('Sem Marca');

        expect(result).toEqual({ id: 11, name: 'Sem Marca', brand_ids: [] });
        // Nao deve chamar _syncBrands se nao tem marcas
        expect(mockDb.run).toHaveBeenCalledTimes(1);
    });
});

describe('CategoryRepository.update', () => {
    test('atualiza nome e sincroniza marcas', async () => {
        mockDb.run.mockResolvedValue({});

        await CategoryRepository.update(1, 'Editado', [3, 5]);

        expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE categories'),
            ['Editado', 1]
        );
        expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM brand_categories'),
            [1]
        );
        expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT OR IGNORE INTO brand_categories'),
            [3, 1]
        );
    });
});

describe('CategoryRepository.delete', () => {
    test('exclui categoria sem produtos', async () => {
        mockDb.get.mockResolvedValue(undefined); // nenhum produto
        mockDb.run.mockResolvedValue({});

        await CategoryRepository.delete(1);

        expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM brand_categories'),
            [1]
        );
        expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM categories'),
            [1]
        );
    });

    test('rejeita exclusao se categoria tem produtos', async () => {
        mockDb.get.mockResolvedValue({ id: 5 }); // produto encontrado

        await expect(CategoryRepository.delete(1)).rejects.toThrow(
            'Categoria possui produtos associados'
        );
    });
});
