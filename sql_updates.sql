-- ============================================
-- SQL-запити для MySQL Workbench
-- Виконай ці запити по черзі у своїй базі construction_shop
-- ============================================

-- ============================================
-- 1. Додаємо колонку image_url до таблиці products
--    (якщо її ще немає)
-- ============================================
ALTER TABLE products
ADD COLUMN image_url VARCHAR(500) DEFAULT NULL;

-- ============================================
-- 2. Оновлюємо зображення для існуючих товарів
--    (посилання на реальні .jpg зображення)
-- ============================================

-- Молоток сталевий
UPDATE products
SET image_url = 'https://images.unsplash.com/photo-1586864387789-628af9feed72?w=400&h=300&fit=crop'
WHERE name LIKE '%Молоток%';

-- Цемент М-500
UPDATE products
SET image_url = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=300&fit=crop'
WHERE name LIKE '%Цемент%';

-- Кабель ВВГ
UPDATE products
SET image_url = 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop'
WHERE name LIKE '%Кабель%';

-- ============================================
-- 3. Створюємо таблицю замовлень (orders)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- Загальна сума замовлення
  total_price DECIMAL(10, 2) NOT NULL,
  -- Ім'я покупця
  customer_name VARCHAR(255) NOT NULL,
  -- Статус замовлення: new, processing, completed, cancelled
  status VARCHAR(50) DEFAULT 'new',
  -- Дата і час створення замовлення (автоматично)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. Створюємо таблицю позицій замовлення (order_items)
--    Зберігає які саме товари входять у кожне замовлення
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- Зв'язок із таблицею orders
  order_id INT NOT NULL,
  -- Зв'язок із таблицею products
  product_id INT NOT NULL,
  -- Кількість одиниць цього товару в замовленні
  quantity INT NOT NULL,
  -- Ціна товару на момент замовлення (може змінитись пізніше)
  price DECIMAL(10, 2) NOT NULL,
  -- Зовнішні ключі для цілісності даних
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================
-- 5. Створюємо таблицю користувачів (users)
--    Зберігає зареєстрованих покупців
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- Ім'я користувача
  name VARCHAR(255) NOT NULL,
  -- Email (унікальний, тільки @gmail.com)
  email VARCHAR(255) NOT NULL UNIQUE,
  -- Хеш пароля (bcrypt)
  password_hash VARCHAR(255) NOT NULL,
  -- Дата реєстрації
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. Додаємо колонку user_id до orders
--    Зв'язок замовлення з користувачем (необов'язковий)
-- ============================================
ALTER TABLE orders
ADD COLUMN user_id INT DEFAULT NULL;

-- ============================================
-- 7. Корисні SQL-запити для адміністратора
-- ============================================

-- Вибірка всіх замовлень: ID, клієнт, дата, сума, статус
SELECT
  id AS 'ID замовлення',
  customer_name AS 'Клієнт',
  DATE_FORMAT(created_at, '%d.%m.%Y %H:%i') AS 'Дата',
  total_price AS 'Сума (₴)',
  status AS 'Статус'
FROM orders
ORDER BY created_at DESC;

-- Детальна вибірка: замовлення з переліком товарів
SELECT
  o.id AS 'ID замовлення',
  o.customer_name AS 'Клієнт',
  DATE_FORMAT(o.created_at, '%d.%m.%Y %H:%i') AS 'Дата',
  p.name AS 'Товар',
  oi.quantity AS 'Кількість',
  oi.price AS 'Ціна за шт.',
  (oi.quantity * oi.price) AS 'Сума позиції',
  o.total_price AS 'Загальна сума'
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
ORDER BY o.created_at DESC, p.name;

-- Перевірка залишків на складі
SELECT id, name, stock_quantity AS 'На складі' FROM products;

-- ============================================
-- Перевірка: подивись, що все створено правильно
-- ============================================
SELECT * FROM products;
DESCRIBE orders;
DESCRIBE order_items;
