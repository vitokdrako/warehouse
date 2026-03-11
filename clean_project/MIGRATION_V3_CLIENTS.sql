-- =====================================================
-- МІГРАЦІЙНИЙ СКРИПТ v3: Клієнтська база + Документи
-- Виконати на production базі farforre_rentalhub
-- ПЕРЕД оновленням бекенду
-- Дата: 2026-03-11
-- =====================================================

-- ============ ФАЗА 1: РОЗШИРЕННЯ client_users ============
-- Безпечно: IF NOT EXISTS / перевірка наявності колонки

-- Додати нові CRM поля в client_users
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS is_regular BOOLEAN DEFAULT FALSE;
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS company VARCHAR(255) DEFAULT NULL;
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS rating INT DEFAULT 0;
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS rating_labels TEXT DEFAULT NULL;
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS internal_notes TEXT DEFAULT NULL;
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS instagram VARCHAR(255) DEFAULT NULL;
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(12,2) DEFAULT 0;
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS last_order_date DATE DEFAULT NULL;

-- Індекси для пошуку
ALTER TABLE client_users ADD INDEX IF NOT EXISTS idx_cu_is_regular (is_regular);
ALTER TABLE client_users ADD INDEX IF NOT EXISTS idx_cu_full_name (full_name);

-- ============ ФАЗА 2: МІГРАЦІЯ ДАНИХ ============
-- Бекфіл: заповнити total_revenue та last_order_date з orders

UPDATE client_users cu
SET 
    cu.total_revenue = COALESCE((
        SELECT SUM(COALESCE(o.total_price, 0))
        FROM orders o 
        WHERE o.customer_name COLLATE utf8mb4_unicode_ci = cu.full_name COLLATE utf8mb4_unicode_ci
    ), 0),
    cu.last_order_date = (
        SELECT MAX(o.rental_start_date)
        FROM orders o 
        WHERE o.customer_name COLLATE utf8mb4_unicode_ci = cu.full_name COLLATE utf8mb4_unicode_ci
    )
WHERE cu.total_revenue = 0 OR cu.total_revenue IS NULL;

-- ============ ФАЗА 3: ІМПОРТ НОВИХ КЛІЄНТІВ ============
-- Додати клієнтів з orders яких ще немає в client_users

INSERT INTO client_users (full_name, phone, email, source, created_at)
SELECT DISTINCT
    o.customer_name,
    COALESCE(o.phone, o.customer_phone),
    COALESCE(o.email, o.customer_email),
    'migrated_from_orders',
    NOW()
FROM orders o
WHERE o.customer_name IS NOT NULL 
  AND o.customer_name != ''
  AND NOT EXISTS (
      SELECT 1 FROM client_users cu 
      WHERE cu.full_name COLLATE utf8mb4_unicode_ci = o.customer_name COLLATE utf8mb4_unicode_ci
  )
GROUP BY o.customer_name;

-- Після імпорту: оновити total_revenue для нових клієнтів
UPDATE client_users cu
SET 
    cu.total_revenue = COALESCE((
        SELECT SUM(COALESCE(o.total_price, 0))
        FROM orders o 
        WHERE o.customer_name COLLATE utf8mb4_unicode_ci = cu.full_name COLLATE utf8mb4_unicode_ci
    ), 0),
    cu.last_order_date = (
        SELECT MAX(o.rental_start_date)
        FROM orders o 
        WHERE o.customer_name COLLATE utf8mb4_unicode_ci = cu.full_name COLLATE utf8mb4_unicode_ci
    )
WHERE cu.source = 'migrated_from_orders';

-- ============ ПРИМІТКИ ============
-- Нові шаблони документів:
--   templates/documents/invoice_payment.html  — Рахунок на оплату
--   templates/documents/service_act.html      — Акт надання послуг
--
-- Нові ендпоінти:
--   GET /api/documents/available-invoices/{order_id}
--   GET /api/documents/invoice-payment/{order_id}/preview
--   GET /api/documents/service-act/{order_id}/preview
--
-- Оновлені файли бекенду:
--   routes/clients.py    — CRM поля (is_regular, company, rating, internal_notes, instagram)
--   routes/documents.py  — рахунок на оплату + акт надання послуг
