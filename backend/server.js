// Завантажуємо змінні оточення з .env файлу
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

// ============================================
// 1. Створюємо Express-додаток
// ============================================
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// 2. Підключаємо middleware
// ============================================

// cors — дозволяє запити з frontend (інший порт)
app.use(cors());

// Парсинг JSON у тілі запитів
app.use(express.json());

// ============================================
// 3. Створюємо пул підключень до MySQL
// ============================================
// Пул — це набір з'єднань, які перевикористовуються.
// Це ефективніше, ніж створювати нове з'єднання на кожен запит.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// Обгортка для роботи з промісами (async/await)
const db = pool.promise();

// ============================================
// 4. Перевірка з'єднання з базою даних
// ============================================
async function testConnection() {
  try {
    const [rows] = await db.query('SELECT 1');
    console.log('✅ Підключення до MySQL успішне!');
  } catch (err) {
    console.error('❌ Помилка підключення до MySQL:', err.message);
    process.exit(1);
  }
}

// ============================================
// 5. Маршрути (API endpoints)
// ============================================

// Кореневий маршрут — перевірка, що сервер працює
app.get('/', (req, res) => {
  res.json({ message: 'Сервер магазину будматеріалів працює!' });
});

// GET /api/products — отримати всі товари
app.get('/api/products', async (req, res) => {
  try {
    const [products] = await db.query('SELECT * FROM products');
    res.json(products);
  } catch (err) {
    console.error('Помилка при отриманні товарів:', err.message);
    res.status(500).json({ error: 'Помилка сервера при отриманні товарів' });
  }
});

// GET /api/categories — отримати всі категорії
app.get('/api/categories', async (req, res) => {
  try {
    const [categories] = await db.query('SELECT * FROM categories');
    res.json(categories);
  } catch (err) {
    console.error('Помилка при отриманні категорій:', err.message);
    res.status(500).json({ error: 'Помилка сервера при отриманні категорій' });
  }
});

// GET /api/products/:id — отримати один товар за ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const [products] = await db.query(
      'SELECT * FROM products WHERE id = ?',
      [req.params.id]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'Товар не знайдено' });
    }

    res.json(products[0]);
  } catch (err) {
    console.error('Помилка при отриманні товару:', err.message);
    res.status(500).json({ error: 'Помилка сервера при отриманні товару' });
  }
});

// ============================================
// POST /api/orders — створити нове замовлення
// ============================================
// Використовуємо MySQL-транзакцію, щоб гарантувати:
// 1. Перевірку наявності товару на складі
// 2. Створення замовлення + позицій
// 3. Списання товару зі складу
// Якщо будь-який крок не вдається — відкат (ROLLBACK)
app.post('/api/orders', async (req, res) => {
  const { customer_name, items } = req.body;

  // ---- Валідація вхідних даних ----
  if (!customer_name || !customer_name.trim()) {
    return res.status(400).json({ error: "Вкажіть ім'я покупця" });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Кошик порожній' });
  }

  // Отримуємо окреме з'єднання з пулу для транзакції
  const connection = await pool.promise().getConnection();

  try {
    // ---- Починаємо транзакцію ----
    await connection.beginTransaction();

    // ---- Крок 1: Перевіряємо наявність товару на складі ----
    // Збираємо ID усіх товарів із кошика
    const productIds = items.map((item) => item.id);

    // Отримуємо актуальні залишки з бази (SELECT ... FOR UPDATE блокує рядки)
    const [stockRows] = await connection.query(
      'SELECT id, name, stock_quantity FROM products WHERE id IN (?) FOR UPDATE',
      [productIds]
    );

    // Створюємо Map для швидкого доступу: id → { name, stock_quantity }
    const stockMap = new Map();
    stockRows.forEach((row) => stockMap.set(row.id, row));

    // Перевіряємо кожен товар із кошика
    for (const item of items) {
      const product = stockMap.get(item.id);

      // Товар не знайдено в базі
      if (!product) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          error: `Товар з ID ${item.id} не знайдено`,
        });
      }

      // Недостатньо товару на складі
      if (product.stock_quantity < item.quantity) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          error: `Недостатньо товару на складі: "${product.name}" (доступно: ${product.stock_quantity}, замовлено: ${item.quantity})`,
        });
      }
    }

    // ---- Крок 2: Обчислюємо загальну суму ----
    const totalPrice = items.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );

    // ---- Крок 3: Створюємо запис замовлення ----
    const [orderResult] = await connection.query(
      'INSERT INTO orders (total_price, customer_name, status) VALUES (?, ?, ?)',
      [totalPrice, customer_name.trim(), 'new']
    );
    const orderId = orderResult.insertId;

    // ---- Крок 4: Вставляємо позиції замовлення ----
    const orderItemsValues = items.map((item) => [
      orderId,
      item.id,
      item.quantity,
      Number(item.price),
    ]);

    await connection.query(
      'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?',
      [orderItemsValues]
    );

    // ---- Крок 5: Списуємо товар зі складу ----
    for (const item of items) {
      await connection.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [item.quantity, item.id]
      );
    }

    // ---- Фіксуємо транзакцію — все пройшло успішно ----
    await connection.commit();
    connection.release();

    console.log(`✅ Замовлення #${orderId} від "${customer_name}" на ${totalPrice.toFixed(2)} ₴ (склад оновлено)`);

    res.status(201).json({
      message: 'Замовлення успішно створено!',
      orderId: orderId,
      totalPrice: totalPrice,
    });
  } catch (err) {
    // Якщо сталася помилка — відкочуємо транзакцію
    await connection.rollback();
    connection.release();
    console.error('Помилка при створенні замовлення:', err.message);
    res.status(500).json({ error: 'Помилка сервера при створенні замовлення' });
  }
});

// ============================================
// GET /api/admin/orders — список усіх замовлень
// ============================================
// Повертає: ID, ім'я клієнта, дату, суму, статус
// Сортування: найновіші зверху
app.get('/api/admin/orders', async (req, res) => {
  try {
    const [orders] = await db.query(
      `SELECT
        id,
        customer_name,
        total_price,
        status,
        DATE_FORMAT(created_at, '%d.%m.%Y %H:%i') AS created_at_formatted,
        created_at
      FROM orders
      ORDER BY created_at DESC`
    );
    res.json(orders);
  } catch (err) {
    console.error('Помилка при отриманні замовлень:', err.message);
    res.status(500).json({ error: 'Помилка сервера при отриманні замовлень' });
  }
});

// ============================================
// 6. Запуск сервера
// ============================================
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущено на http://localhost:${PORT}`);
  await testConnection();
  console.log('');
  console.log('Доступні маршрути:');
  console.log(`  GET  http://localhost:${PORT}/`);
  console.log(`  GET  http://localhost:${PORT}/api/products`);
  console.log(`  GET  http://localhost:${PORT}/api/categories`);
  console.log(`  GET  http://localhost:${PORT}/api/products/:id`);
  console.log(`  POST http://localhost:${PORT}/api/orders`);
  console.log(`  GET  http://localhost:${PORT}/api/admin/orders`);
});
