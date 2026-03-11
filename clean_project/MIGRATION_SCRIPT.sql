-- =====================================================
-- МІГРАЦІЙНИЙ СКРИПТ: Оптимізація Damage Cabinet
-- Виконати на production базі farforre_rentalhub
-- ПЕРЕД запуском нового бекенду
-- =====================================================

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

-- 4. Оновити batch_type в laundry_batches (якщо є 'washing')
UPDATE laundry_batches SET batch_type = 'wash' WHERE batch_type = 'washing';

-- =====================================================
-- ПІСЛЯ ПЕРЕВІРКИ що все працює (через кілька днів):
-- =====================================================

-- 5. Видалити порожні таблиці (безпечно)
-- DROP TABLE IF EXISTS customers;
-- DROP TABLE IF EXISTS inventory;
-- DROP TABLE IF EXISTS inventory_recounts;
-- DROP TABLE IF EXISTS product_cleaning;
-- DROP TABLE IF EXISTS product_lifecycle;
-- DROP TABLE IF EXISTS product_reservations;
-- DROP TABLE IF EXISTS order_notes;
-- DROP TABLE IF EXISTS order_item_packing;

-- 6. ПІСЛЯ ТИЖНЯ РОБОТИ: видалити product_cleaning_status
-- DROP TABLE IF EXISTS product_cleaning_status;

-- 7. ПІСЛЯ МІСЯЦЯ: видалити старі backup файли з сервера
-- rm -f routes/archive_old.py routes/audit.py.backup routes/catalog_old.py
-- rm -f routes/damages.py.backup routes/damages_old.py routes/extended_catalog_old.py
-- rm -f routes/finance_old.py routes/issue_cards_old.py routes/orders.py.backup
-- rm -f routes/orders_old_full.py routes/orders_simple_backup.py
-- rm -f routes/products.py.backup routes/return_cards_old.py routes/tasks_old.py
