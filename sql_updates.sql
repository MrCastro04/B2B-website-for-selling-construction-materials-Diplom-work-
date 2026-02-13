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
-- Перевірка: подивись, що все створено правильно
-- ============================================
SELECT * FROM products;
DESCRIBE orders;
DESCRIBE order_items;
