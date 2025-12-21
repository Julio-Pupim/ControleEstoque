const db = require('../database');

class SaleController {
    // A lógica de venda é complexa e transacional, mantivemos aqui mas com async/await encapsulado
    async store(req, res) {
        const { customer_id, items, discount } = req.body;
        const saleDiscount = parseFloat(discount) || 0;

        if (!items || items.length === 0) return res.status(400).json({ error: "No items" });
        if (!customer_id) return res.status(400).json({ error: "Customer required" });

        // Validação e cálculo inicial
        let subTotal = 0;
        let checkedItems = [];

        try {
            // 1. Verificar estoque e preços
            for (const item of items) {
                let product;
                if (item.product_id) {
                    product = await db.get("SELECT * FROM products WHERE id = ?", [item.product_id]);
                } else if (item.barcode) {
                    product = await db.get("SELECT * FROM products WHERE barcode = ?", [item.barcode]);
                }

                if (!product) throw new Error(`Produto não encontrado (ID: ${item.product_id || item.barcode})`);
                if (product.stock < item.quantity) throw new Error(`Estoque insuficiente: ${product.name}`);

                subTotal += product.price * item.quantity;
                checkedItems.push({ ...item, product_id: product.id, price: product.price });
            }

            // 2. Executar Transação (Venda + Baixa Estoque + Débito Cliente)
            const finalTotal = Math.max(0, subTotal - saleDiscount);

            await new Promise((resolve, reject) => {
                db.raw.serialize(() => {
                    db.raw.run("BEGIN TRANSACTION");

                    const stmtSale = db.raw.prepare("INSERT INTO sales (customer_id, total, discount) VALUES (?, ?, ?)");
                    stmtSale.run([customer_id, finalTotal, saleDiscount], function (err) {
                        if (err) { db.raw.run("ROLLBACK"); return reject(err); }
                        const saleId = this.lastID;

                        const stmtItem = db.raw.prepare("INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)");
                        const stmtStock = db.raw.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");

                        checkedItems.forEach(i => {
                            stmtItem.run(saleId, i.product_id, i.quantity, i.price);
                            stmtStock.run(i.quantity, i.product_id);
                        });

                        stmtItem.finalize();
                        stmtStock.finalize();

                        db.raw.run("UPDATE customers SET balance = balance + ? WHERE id = ?", [finalTotal, customer_id], (err) => {
                            if (err) { db.raw.run("ROLLBACK"); return reject(err); }
                            db.raw.run("COMMIT", (err) => {
                                if (err) return reject(err);
                                resolve({ id: saleId, total: finalTotal });
                            });
                        });
                    });
                });
            })
                .then(result => res.status(201).json(result))
                .catch(err => res.status(400).json({ error: err.message }));

        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
}

module.exports = new SaleController();