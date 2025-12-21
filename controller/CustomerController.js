const CustomerRepo = require('../repository/CustomerRepository');

class CustomerController {

    async index(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search || '';
            const offset = (page - 1) * limit;

            const result = await CustomerRepo.findAll({ limit, offset, search });

            res.json({
                data: result.data,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(result.total / limit),
                    totalItems: result.total
                }
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }

    async store(req, res) {
        try {
            const result = await CustomerRepo.create(req.body);
            res.status(201).json(result);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }

    async update(req, res) {
        try {
            await CustomerRepo.update(req.params.id, req.body);
            res.json({ message: "Updated" });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }

    async delete(req, res) {
        try {
            await CustomerRepo.delete(req.params.id);
            res.json({ message: "Deleted" });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }

    async payDebt(req, res) {
        try {
            const { customer_id, amount, date } = req.body;
            if (!customer_id || !amount) throw new Error("Invalid data");
            const result = await CustomerRepo.addPayment(customer_id, parseFloat(amount), date);
            res.json(result);
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    }

    async history(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const result = await CustomerRepo.getHistory(req.params.id, {
                limit,
                offset: (page - 1) * limit,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            });
            res.json({
                data: result.data,
                pagination: { currentPage: page, totalPages: Math.ceil(result.total / limit) }
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
}

module.exports = new CustomerController();