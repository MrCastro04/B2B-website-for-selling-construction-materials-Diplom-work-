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
// Очікуваний формат тіла запиту (JSON):
// {
//   "customer_name": "Іван Петренко",
//   "items": [
//     { "id": 1, "price": 350.50, "quantity": 2 },
//     { "id": 3, "price": 450.00, "quantity": 1 }
//   ]
// }
app.post('/api/orders', async (req, res) => {
  // Отримуємо дані з тіла запиту
  const { customer_name, items } = req.body;

  // ---- Валідація вхідних даних ----
  // Перевіряємо, що ім'я покупця передано
  if (!customer_name || !customer_name.trim()) {
    return res.status(400).json({ error: "Вкажіть ім'я покупця" });
  }

  // Перевіряємо, що масив товарів не порожній
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Кошик порожній' });
  }

  try {
    // ---- Обчислюємо загальну суму замовлення ----
    const totalPrice = items.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );

    // ---- Крок 1: Вставляємо запис у таблицю orders ----
    const [orderResult] = await db.query(
      'INSERT INTO orders (total_price, customer_name, status) VALUES (?, ?, ?)',
      [totalPrice, customer_name.trim(), 'new']
    );

    // Отримуємо ID щойно створеного замовлення
    const orderId = orderResult.insertId;

    // ---- Крок 2: Вставляємо позиції замовлення в order_items ----
    // Формуємо масив значень для batch-вставки
    const orderItemsValues = items.map((item) => [
      orderId,
      item.id,
      item.quantity,
      Number(item.price),
    ]);

    await db.query(
      'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?',
      [orderItemsValues]
    );

    // ---- Відповідь клієнту з номером замовлення ----
    console.log(`✅ Нове замовлення #${orderId} від "${customer_name}" на суму ${totalPrice.toFixed(2)} ₴`);

    res.status(201).json({
      message: 'Замовлення успішно створено!',
      orderId: orderId,
      totalPrice: totalPrice,
    });
  } catch (err) {
    console.error('Помилка при створенні замовлення:', err.message);
    res.status(500).json({ error: 'Помилка сервера при створенні замовлення' });
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
});
