USE construction_shop;

DELETE FROM products WHERE id > 53;

SELECT COUNT(*) AS total_products FROM products;
