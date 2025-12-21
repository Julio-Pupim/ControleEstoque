const db = require('../database');

class CustomerRepository {
    async findAll({ limit, offset, search }) {
        let query = "SELECT id, name, phone, ROUND(balance, 2) as balance FROM customers";
        let countQuery = "SELECT COUNT(*) as total FROM customers";
        let params = [];

        if (search) {
            const where = " WHERE name LIKE ? OR CAST(id AS TEXT) LIKE ?";
            query += where;
            countQuery += where;
            params = [`%${search}%`, `%${search}%`];
        }

        query += " LIMIT ? OFFSET ?";
        const rows = await db.all(query, [...params, limit, offset]);
        const countResult = await db.get(countQuery, params);

        return { data: rows, total: countResult.total };
    }

    async create(customer) {
        const { name, phone, balance } = customer;
        balance ??= 0;
        console.log(balance);
        const result = await db.run(
            `INSERT INTO customers (name, phone, balance) VALUES (?, ?, ?)`,
            [name, phone, balance]
        );
        return { id: result.lastID, name, phone, balance };
    }

    async update(id, customer) {
        const { name, phone, balance } = customer;
        await db.run(
            `UPDATE customers SET name = ?, phone = ?, balance = ? WHERE id = ?`,
            [name, phone, balance, id]
        );
        return { message: "Updated" };
    }

    async delete(id) {
        return await db.run(`DELETE FROM customers WHERE id = ?`, [id]);
    }

    async addPayment(customerId, amount, customDate = null) {
        let dateValue = "CURRENT_TIMESTAMP";
        let params = [customerId, amount];

        if (customDate) {
            dateValue = "?";
            params = [customerId, amount, `${customDate} 12:00:00`];
        }

        await db.run(
            `INSERT INTO customer_payments (customer_id, amount, created_at) VALUES (?, ?, ${dateValue})`,
            params
        );

        await db.run("UPDATE customers SET balance = balance - ? WHERE id = ?", [amount, customerId]);
        return { ok: true, message: "Payment registered" };
    }

    async getHistory(customerId, { limit, offset, startDate, endDate }) {
        let dateFilter = "";
        let dateParams = [];

        if (startDate && endDate) {
            dateFilter = " AND created_at BETWEEN ? AND ?";
            dateParams = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
        }

        const query = `
            SELECT 'sale' as type, id, total as amount, created_at, discount
            FROM sales 
            WHERE customer_id = ? ${dateFilter}
            UNION ALL
            SELECT 'payment' as type, id, amount, created_at, 0 as discount
            FROM customer_payments 
            WHERE customer_id = ? ${dateFilter}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;

        // Params needs to match the order of placeholders:
        // 1. sales: customer_id, [date start, date end]
        // 2. payments: customer_id, [date start, date end]
        // 3. limit, offset
        const queryParams = [
            customerId, ...dateParams,
            customerId, ...dateParams,
            limit, offset
        ];

        const rows = await db.all(query, queryParams);

        // Fetch items only for sales
        for (let row of rows) {
            if (row.type === 'sale') {
                row.items = await db.all(`
                    SELECT p.name, si.quantity, si.price 
                    FROM sale_items si JOIN products p ON si.product_id = p.id 
                    WHERE si.sale_id = ?`, [row.id]);
            } else {
                row.items = null;
            }
        }

        // Count for pagination
        const countQuery = `
            SELECT COUNT(*) as total FROM (
                SELECT id FROM sales WHERE customer_id = ? ${dateFilter}
                UNION ALL
                SELECT id FROM customer_payments WHERE customer_id = ? ${dateFilter}
            )
        `;
        // Params for count: customer_id, [dates], customer_id, [dates]
        const countParams = [
            customerId, ...dateParams,
            customerId, ...dateParams
        ];

        const countResult = await db.get(countQuery, countParams);

        return { data: rows, total: countResult ? countResult.total : 0 };
    }
}

module.exports = new CustomerRepository();