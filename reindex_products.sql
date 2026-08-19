USE construction_shop;

SET FOREIGN_KEY_CHECKS = 0;

-- Шаг 1: сдвигаем во временный диапазон (100000+), чтобы не было конфликтов
UPDATE products
SET id = id + 100000
WHERE id > 53
ORDER BY id DESC;

-- Шаг 2: присваиваем последовательные ID начиная с 54
SET @new_id = 53;
UPDATE products
SET id = (@new_id := @new_id + 1)
WHERE id > 100053
ORDER BY id ASC;

-- Шаг 3: сбрасываем AUTO_INCREMENT (MySQL автоматически возьмёт MAX(id)+1)
ALTER TABLE products AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- Проверка
SELECT COUNT(*) AS total, MIN(id) AS min_id, MAX(id) AS max_id
FROM products WHERE id > 53;
