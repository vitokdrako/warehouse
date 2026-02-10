-- SQL скрипт для оновлення місць зберігання диванів
-- Дата: 06.02.2026
-- Таблиця: products, поле: storage_location

-- Оновлення місць зберігання по product_id
UPDATE products SET storage_location = '3A' WHERE product_id = 185;
UPDATE products SET storage_location = '4A' WHERE product_id = 186;
UPDATE products SET storage_location = '2A' WHERE product_id = 187;
UPDATE products SET storage_location = '9B' WHERE product_id = 188;
UPDATE products SET storage_location = '6A' WHERE product_id = 189;
UPDATE products SET storage_location = '4A, стан старого' WHERE product_id = 190;
UPDATE products SET storage_location = '7A, 2га полиця' WHERE product_id = 193;
UPDATE products SET storage_location = '7A' WHERE product_id = 194;
UPDATE products SET storage_location = '10A' WHERE product_id = 198;
UPDATE products SET storage_location = '14A' WHERE product_id = 826;
UPDATE products SET storage_location = '11B' WHERE product_id = 827;
UPDATE products SET storage_location = '7A' WHERE product_id = 830;
UPDATE products SET storage_location = '9A' WHERE product_id = 831;
UPDATE products SET storage_location = '7A' WHERE product_id = 832;
UPDATE products SET storage_location = '9A' WHERE product_id = 833;
UPDATE products SET storage_location = '14A' WHERE product_id = 834;
UPDATE products SET storage_location = '8A' WHERE product_id = 835;
UPDATE products SET storage_location = '2A' WHERE product_id = 836;
UPDATE products SET storage_location = '11B' WHERE product_id = 837;
UPDATE products SET storage_location = '10A' WHERE product_id = 838;
UPDATE products SET storage_location = '—' WHERE product_id = 839;
UPDATE products SET storage_location = '10A' WHERE product_id = 840;
UPDATE products SET storage_location = '6A' WHERE product_id = 841;
UPDATE products SET storage_location = '5A' WHERE product_id = 843;
UPDATE products SET storage_location = '5A, 2га полиця' WHERE product_id = 842;
UPDATE products SET storage_location = '4A' WHERE product_id = 844;
UPDATE products SET storage_location = '2A' WHERE product_id = 845;
UPDATE products SET storage_location = '5A' WHERE product_id = 846;
UPDATE products SET storage_location = '6A' WHERE product_id = 848;
UPDATE products SET storage_location = '5A' WHERE product_id = 850;
UPDATE products SET storage_location = '10B' WHERE product_id = 852;
UPDATE products SET storage_location = '—' WHERE product_id = 855;
UPDATE products SET storage_location = '4A' WHERE product_id = 2701;
UPDATE products SET storage_location = '2A' WHERE product_id = 2755;
UPDATE products SET storage_location = '3A' WHERE product_id = 2820;
UPDATE products SET storage_location = '9A' WHERE product_id = 2821;
UPDATE products SET storage_location = '5A/6A' WHERE product_id = 3136;
UPDATE products SET storage_location = '11A' WHERE product_id = 3297;
UPDATE products SET storage_location = '—' WHERE product_id = 4031;
UPDATE products SET storage_location = '11A' WHERE product_id = 4061;
UPDATE products SET storage_location = 'сарай' WHERE product_id = 4068;
UPDATE products SET storage_location = '11A, 12A' WHERE product_id = 4451;
UPDATE products SET storage_location = '11A' WHERE product_id = 4466;
UPDATE products SET storage_location = 'Бортничі' WHERE product_id = 4568;
UPDATE products SET storage_location = '8A' WHERE product_id = 4597;
UPDATE products SET storage_location = '8A, 2га полиця' WHERE product_id = 4622;
UPDATE products SET storage_location = '7A' WHERE product_id = 4623;
UPDATE products SET storage_location = '2A' WHERE product_id = 4629;
UPDATE products SET storage_location = '8A' WHERE product_id = 4752;
UPDATE products SET storage_location = '7A' WHERE product_id = 4755;
UPDATE products SET storage_location = 'Бортничі' WHERE product_id = 4851;
UPDATE products SET storage_location = '6A' WHERE product_id = 4860;
UPDATE products SET storage_location = '3A2' WHERE product_id = 4861;
UPDATE products SET storage_location = '9B' WHERE product_id = 4887;
UPDATE products SET storage_location = '10A' WHERE product_id = 4895;
UPDATE products SET storage_location = '2A, верх' WHERE product_id = 4910;
UPDATE products SET storage_location = '3A/4A між ними' WHERE product_id = 5177;
UPDATE products SET storage_location = '3A' WHERE product_id = 5286;
UPDATE products SET storage_location = '1A' WHERE product_id = 5287;
UPDATE products SET storage_location = '1A' WHERE product_id = 6591;
UPDATE products SET storage_location = '8A' WHERE product_id = 6592;
UPDATE products SET storage_location = '8A' WHERE product_id = 7302;

-- Перевірка результатів
SELECT product_id, name, storage_location 
FROM products 
WHERE product_id IN (185, 186, 187, 188, 189, 190, 193, 194, 198, 826, 827, 830, 831, 832, 833, 834, 835, 836, 837, 838, 839, 840, 841, 843, 842, 844, 845, 846, 848, 850, 852, 855, 2701, 2755, 2820, 2821, 3136, 3297, 4031, 4061, 4068, 4451, 4466, 4568, 4597, 4622, 4623, 4629, 4752, 4755, 4851, 4860, 4861, 4887, 4895, 4910, 5177, 5286, 5287, 6591, 6592, 7302)
ORDER BY product_id;
