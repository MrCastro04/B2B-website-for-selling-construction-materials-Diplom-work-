// Завантажуємо змінні оточення з .env файлу
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

// ============================================
// 1. Створюємо Express-додаток
// ============================================
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// 2. Підключаємо middleware
// ============================================

// cors — дозволяє запити з frontend (інший порт)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

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
// GET /api/delivery-methods
// ============================================
app.get('/api/delivery-methods', async (req, res) => {
  try {
    const [methods] = await db.query('SELECT * FROM delivery_methods ORDER BY id');
    res.json(methods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET /api/suppliers
// ============================================
app.get('/api/suppliers', async (req, res) => {
  try {
    const [suppliers] = await db.query('SELECT * FROM suppliers ORDER BY id');
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// POST /api/register — реєстрація нового користувача
// ============================================
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;

  // ---- Валідація ----
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Вкажіть ваше ім'я" });
  }

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Вкажіть email' });
  }

  // Перевіряємо, що email закінчується на @gmail.com
  if (!email.trim().toLowerCase().endsWith('@gmail.com')) {
    return res.status(400).json({ error: 'Дозволені тільки адреси @gmail.com' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Пароль має містити щонайменше 6 символів' });
  }

  try {
    // Перевіряємо, чи email вже зайнятий
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Користувач з таким email вже існує' });
    }

    // Хешуємо пароль (10 раундів bcrypt)
    const passwordHash = await bcrypt.hash(password, 10);

    // Зберігаємо користувача в базу
    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), passwordHash]
    );

    console.log(`✅ Новий користувач: "${name}" (${email})`);

    res.status(201).json({
      user: {
        id: result.insertId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
      },
    });
  } catch (err) {
    console.error('Помилка при реєстрації:', err.message);
    res.status(500).json({ error: 'Помилка сервера при реєстрації' });
  }
});

// ============================================
// POST /api/login — вхід користувача
// ============================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  // ---- Валідація ----
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Вкажіть email' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Вкажіть пароль' });
  }

  try {
    // Шукаємо користувача за email
    const [users] = await db.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Невірний email або пароль' });
    }

    const user = users[0];

    // Порівнюємо пароль з хешем
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Невірний email або пароль' });
    }

    console.log(`✅ Вхід: "${user.name}" (${user.email})`);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('Помилка при вході:', err.message);
    res.status(500).json({ error: 'Помилка сервера при вході' });
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
  const { customer_name, items, user_id, delivery_method_id } = req.body;

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
    // Якщо user_id передано — прив'язуємо замовлення до користувача
    const [orderResult] = await connection.query(
      'INSERT INTO orders (total_price, customer_name, status, user_id, delivery_method_id) VALUES (?, ?, ?, ?, ?)',
      [totalPrice, customer_name.trim(), 'new', user_id || null, delivery_method_id || null]
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

    // ---- Крок 6: Створюємо receipt (чек) ----
    const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
    await db.query(
      'INSERT INTO receipts (order_id, order_count, order_price) VALUES (?, ?, ?)',
      [orderId, totalCount, totalPrice]
    );

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
// GET /api/orders/:name — історія замовлень за іменем покупця
// ============================================
// Повертає замовлення конкретного клієнта з переліком товарів
app.get('/api/orders/:name', async (req, res) => {
  const customerName = decodeURIComponent(req.params.name).trim();

  if (!customerName) {
    return res.status(400).json({ error: "Вкажіть ім'я покупця" });
  }

  try {
    // Крок 1: Знаходимо всі замовлення цього клієнта
    const [orders] = await db.query(
      `SELECT
        id,
        total_price,
        status,
        DATE_FORMAT(created_at, '%d.%m.%Y %H:%i') AS created_at_formatted
      FROM orders
      WHERE customer_name = ?
      ORDER BY created_at DESC`,
      [customerName]
    );

    // Якщо замовлень немає — повертаємо порожній масив
    if (orders.length === 0) {
      return res.json([]);
    }

    // Крок 2: Для кожного замовлення завантажуємо позиції (товари)
    const orderIds = orders.map((o) => o.id);
    const [items] = await db.query(
      `SELECT
        oi.order_id,
        p.name AS product_name,
        oi.quantity,
        oi.price
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id IN (?)`,
      [orderIds]
    );

    // Крок 3: Групуємо позиції по замовленнях
    const result = orders.map((order) => ({
      ...order,
      items: items.filter((item) => item.order_id === order.id),
    }));

    res.json(result);
  } catch (err) {
    console.error('Помилка при отриманні історії замовлень:', err.message);
    res.status(500).json({ error: 'Помилка сервера при отриманні історії' });
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
// 5а. Seed адмін-користувача при старті
// ============================================
async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log('ℹ️ ADMIN_EMAIL/ADMIN_PASSWORD не задані в .env — сидинг адміна пропущено');
    return;
  }

  try {
    const adminName = 'Адміністратор';
    const hash = await bcrypt.hash(adminPassword, 10);
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [adminEmail]);
    if (existing.length > 0) {
      await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [hash, adminEmail]);
      console.log(`✅ Пароль адміна оновлено (${adminEmail})`);
    } else {
      await db.query(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [adminName, adminEmail, hash]
      );
      console.log(`✅ Адміна створено (${adminEmail})`);
    }
  } catch (err) {
    console.error('⚠️ Помилка seedAdmin:', err.message);
  }
}

// ============================================
// POST /api/admin/products — створити товар
// ============================================
app.post('/api/admin/products', async (req, res) => {
  const { name, description, price, stock_quantity, category_id, image_url } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Вкажіть назву товару' });
  if (!price || isNaN(price)) return res.status(400).json({ error: 'Вкажіть коректну ціну' });
  if (!category_id) return res.status(400).json({ error: 'Вкажіть категорію' });
  try {
    const [result] = await db.query(
      'INSERT INTO products (name, description, price, stock_quantity, category_id, image_url) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), description || '', Number(price), Number(stock_quantity) || 0, Number(category_id), image_url || null]
    );
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /api/admin/products error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PUT /api/admin/products/:id — оновити товар
// ============================================
app.put('/api/admin/products/:id', async (req, res) => {
  try {
    const { name, description, price, stock_quantity, category_id, image_url } = req.body;
    const id = Number(req.params.id);
    await db.query(
      'UPDATE products SET name=?, description=?, price=?, stock_quantity=?, category_id=?, image_url=? WHERE id=?',
      [
        String(name || '').trim(),
        String(description || ''),
        Number(price) || 0,
        Number(stock_quantity) || 0,
        Number(category_id),
        image_url || null,
        id,
      ]
    );
    const [[product]] = await db.query('SELECT * FROM products WHERE id=?', [id]);
    res.json(product);
  } catch (err) {
    console.error('PUT /api/admin/products error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// DELETE /api/admin/products/:id — видалити товар
// ============================================
app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.query('DELETE FROM order_items WHERE product_id=?', [id]);
    await db.query('DELETE FROM products WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admin/products error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 6. Запуск сервера
// ============================================
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущено на http://localhost:${PORT}`);
  await testConnection();
  await seedAdmin();
  console.log('');
  console.log('Доступні маршрути:');
  console.log(`  GET  http://localhost:${PORT}/`);
  console.log(`  POST http://localhost:${PORT}/api/register`);
  console.log(`  POST http://localhost:${PORT}/api/login`);
  console.log(`  GET  http://localhost:${PORT}/api/products`);
  console.log(`  GET  http://localhost:${PORT}/api/categories`);
  console.log(`  GET  http://localhost:${PORT}/api/products/:id`);
  console.log(`  POST http://localhost:${PORT}/api/orders`);
  console.log(`  GET  http://localhost:${PORT}/api/orders/:name`);
  console.log(`  GET  http://localhost:${PORT}/api/admin/orders`);
});
