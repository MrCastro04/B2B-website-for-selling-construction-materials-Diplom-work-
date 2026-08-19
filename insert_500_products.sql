USE construction_shop;

-- ============================================
-- Вставка 500 нових товарів через збережену процедуру
-- По 100 товарів на кожну з 5 категорій
-- ============================================

DELIMITER //

DROP PROCEDURE IF EXISTS insert_500_products//

CREATE PROCEDURE insert_500_products()
BEGIN
  DECLARE i INT DEFAULT 1;
  DECLARE cat_id INT;
  DECLARE local_index INT;
  DECLARE prod_name VARCHAR(255);
  DECLARE prod_desc TEXT;
  DECLARE prod_price DECIMAL(10,2);
  DECLARE prod_stock INT;
  DECLARE prod_image VARCHAR(500);

  WHILE i <= 500 DO
    -- Категорія: 1..5, по 100 на кожну
    SET cat_id    = CEIL(i / 100.0);
    SET local_index = i - (cat_id - 1) * 100;   -- порядковий номер всередині категорії (1..100)

    -- Ціна від 50 до 9500 грн (рандомно, але відтворювано за seed)
    SET prod_price = ROUND(50 + (RAND() * 9450), 2);
    -- Залишок на складі від 5 до 500 шт
    SET prod_stock = FLOOR(5 + RAND() * 496);

    CASE cat_id
      WHEN 1 THEN
        SET prod_name  = CONCAT('Інструмент будівельний #', local_index);
        SET prod_desc  = CONCAT(
          'Професійний будівельний інструмент серії ', local_index,
          '. Виготовлений з високоміцної сталі. Ергономічна рукоятка.',
          ' Підходить для побутових і промислових робіт. Гарантія 12 місяців.'
        );
        SET prod_image = 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=500';

      WHEN 2 THEN
        SET prod_name  = CONCAT('Будівельна суміш серія #', local_index);
        SET prod_desc  = CONCAT(
          'Сертифікована будівельна суміш ', local_index,
          '. Відповідає ДСТУ. Підходить для внутрішніх та зовнішніх робіт.',
          ' Час схоплювання 45–60 хв. Мішок 25 кг.'
        );
        SET prod_image = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=500';

      WHEN 3 THEN
        SET prod_name  = CONCAT('Електрокомпонент #', local_index);
        SET prod_desc  = CONCAT(
          'Електротехнічний виріб серії ', local_index,
          '. Відповідає стандартам безпеки IEC. Номінальна напруга 220 В.',
          ' Клас захисту IP44. Термін служби 10 років.'
        );
        SET prod_image = 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&q=80&w=500';

      WHEN 4 THEN
        SET prod_name  = CONCAT('Сантехнічний виріб #', local_index);
        SET prod_desc  = CONCAT(
          'Сантехнічний виріб серії ', local_index,
          '. Корозієстійкі матеріали. Робочий тиск до 10 Бар.',
          ' Підходить для холодної та гарячої води. Гарантія 24 місяці.'
        );
        SET prod_image = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=500';

      WHEN 5 THEN
        SET prod_name  = CONCAT('Лакофарбовий матеріал #', local_index);
        SET prod_desc  = CONCAT(
          'Лакофарбовий матеріал серії ', local_index,
          '. Відмінна адгезія до бетону, дерева та металу.',
          ' Стійкість до вологи та УФ-випромінювання. Витрата 120–150 мл/м².'
        );
        SET prod_image = 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&q=80&w=500';
    END CASE;

    INSERT INTO products (category_id, name, description, price, stock_quantity, image_url)
    VALUES (cat_id, prod_name, prod_desc, prod_price, prod_stock, prod_image);

    SET i = i + 1;
  END WHILE;
END//

DELIMITER ;

-- Виконуємо та прибираємо процедуру
CALL insert_500_products();
DROP PROCEDURE IF EXISTS insert_500_products;

-- Перевірка
SELECT COUNT(*) AS total_products FROM products;
