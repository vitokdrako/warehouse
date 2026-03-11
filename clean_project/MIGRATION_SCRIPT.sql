-- =====================================================
-- МІГРАЦІЙНИЙ СКРИПТ v2: Повна оптимізація RentalHub
-- Виконати на production базі farforre_rentalhub
-- ПЕРЕД запуском нового бекенду
-- =====================================================

-- ============ ФАЗА 1: ОБОВ'ЯЗКОВІ ЗМІНИ ============

-- 1. Додати нові поля в product_damage_history
ALTER TABLE product_damage_history ADD COLUMN source VARCHAR(50) DEFAULT 'manual' AFTER created_by;
ALTER TABLE product_damage_history ADD COLUMN base_value DECIMAL(10,2) DEFAULT 0 AFTER fee_per_item;
ALTER TABLE product_damage_history ADD COLUMN estimate_value DECIMAL(10,2) DEFAULT 0 AFTER base_value;
ALTER TABLE product_damage_history ADD COLUMN updated_at DATETIME DEFAULT NULL AFTER created_at;

-- 2. Додати індекси для швидкості
ALTER TABLE product_damage_history ADD INDEX idx_pdh_product_processing (product_id, processing_type, processing_status);
ALTER TABLE product_damage_history ADD INDEX idx_pdh_order (order_id);

-- 3. Уніфікувати processing_type: 'washing' → 'wash'
UPDATE product_damage_history SET processing_type = 'wash' WHERE processing_type = 'washing';

-- 4. Уніфікувати batch_type в laundry_batches
UPDATE laundry_batches SET batch_type = 'wash' WHERE batch_type = 'washing';

-- ============ ФАЗА 2: ОЧИСТКА ТАБЛИЦЬ (після 1 тижня роботи) ============

-- DROP TABLE IF EXISTS customers;
-- DROP TABLE IF EXISTS inventory;
-- DROP TABLE IF EXISTS inventory_recounts;
-- DROP TABLE IF EXISTS product_cleaning;
-- DROP TABLE IF EXISTS product_lifecycle;
-- DROP TABLE IF EXISTS product_reservations;
-- DROP TABLE IF EXISTS order_notes;
-- DROP TABLE IF EXISTS order_item_packing;

-- ============ ФАЗА 3: ПІСЛЯ 1 МІСЯЦЯ РОБОТИ ============

-- Видалити стару таблицю product_cleaning_status (дані тепер в product_damage_history)
-- DROP TABLE IF EXISTS product_cleaning_status;

-- Видалити стару таблицю finance_transactions (замінена fin_transactions)
-- DROP TABLE IF EXISTS finance_transactions;

-- ============ ПРИМІТКИ ============
-- Оновлені бекенд файли:
--   orders.py          — фінанси → fin_transactions, повернення → product_damage_history
--   return_cards.py    — шкода → product_damage_history (замість damages+damage_items)
--   catalog.py         — restoration з product_damage_history (замість product_cleaning_status)
--   product_cleaning.py — повністю переписаний, читає з product_damage_history
--   laundry.py         — washing → wash
--   damage_cases.py    — пише тільки в product_damage_history
--   user_tracking.py   — читає з fin_transactions (замість finance_transactions)
--   product_damage_history.py — washing → wash
