-- =====================================================
-- RENTALHUB DATABASE SCHEMA
-- Оптимізована структура для warehouse management
-- =====================================================

-- CORE TABLES: Snapshot з OpenCart (read-only)
-- =====================================================

-- 1. Products snapshot (синхронізується з OpenCart)
CREATE TABLE IF NOT EXISTS products (
    product_id INT PRIMARY KEY,
    sku VARCHAR(100),
    name VARCHAR(500),
    category_id INT,
    category_name VARCHAR(255),
    subcategory_id INT,
    subcategory_name VARCHAR(255),
    description TEXT,
    price DECIMAL(10,2),
    rental_price DECIMAL(10,2),
    status TINYINT DEFAULT 1,
    image_url VARCHAR(500),
    -- Meta
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_sku (sku),
    INDEX idx_category (category_id),
    INDEX idx_status (status),
    INDEX idx_synced (synced_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Categories snapshot
CREATE TABLE IF NOT EXISTS categories (
    category_id INT PRIMARY KEY,
    parent_id INT DEFAULT 0,
    name VARCHAR(255),
    sort_order INT DEFAULT 0,
    status TINYINT DEFAULT 1,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_parent (parent_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Orders snapshot (базова інфо з OpenCart)
CREATE TABLE IF NOT EXISTS orders (
    order_id INT PRIMARY KEY,
    order_number VARCHAR(50),
    customer_id INT,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    event_date DATE,
    event_time TIME,
    event_location VARCHAR(500),
    rental_start_date DATE,
    rental_end_date DATE,
    rental_days INT,
    total_amount DECIMAL(10,2),
    deposit_amount DECIMAL(10,2),
    status VARCHAR(50),
    payment_status VARCHAR(50),
    -- Meta
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    
    INDEX idx_order_number (order_number),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_event_date (event_date),
    INDEX idx_synced (synced_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Order Items snapshot
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(500),
    quantity INT NOT NULL,
    price DECIMAL(10,2),
    total_rental DECIMAL(10,2),
    total_deposit DECIMAL(10,2),
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_order (order_id),
    INDEX idx_product (product_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Customers snapshot
CREATE TABLE IF NOT EXISTS customers (
    customer_id INT PRIMARY KEY,
    firstname VARCHAR(255),
    lastname VARCHAR(255),
    email VARCHAR(255),
    telephone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    status TINYINT DEFAULT 1,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_phone (telephone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- RENTALHUB OPERATIONAL TABLES
-- =====================================================

-- 6. Inventory Management (складський облік)
CREATE TABLE IF NOT EXISTS inventory (
    id VARCHAR(36) PRIMARY KEY,
    product_id INT NOT NULL,
    zone VARCHAR(50),
    aisle VARCHAR(50),
    shelf VARCHAR(50),
    bin VARCHAR(50),
    quantity INT DEFAULT 0,
    reserved_quantity INT DEFAULT 0,
    available_quantity INT GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    cleaning_status ENUM('clean', 'dirty', 'in_process', 'damaged') DEFAULT 'clean',
    product_state ENUM('available', 'rented', 'maintenance', 'lost') DEFAULT 'available',
    last_audit_date DATE,
    last_audit_by VARCHAR(100),
    next_audit_date DATE,
    audit_priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_product (product_id),
    INDEX idx_zone (zone),
    INDEX idx_location (zone, aisle, shelf),
    INDEX idx_status (product_state),
    INDEX idx_cleaning (cleaning_status),
    INDEX idx_audit_date (next_audit_date),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Audit Records (переоблік)
CREATE TABLE IF NOT EXISTS audit_records (
    id VARCHAR(36) PRIMARY KEY,
    product_id INT NOT NULL,
    inventory_id VARCHAR(36),
    audit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    audited_by VARCHAR(100),
    status ENUM('ok', 'minor', 'critical', 'lost') DEFAULT 'ok',
    quantity_expected INT,
    quantity_actual INT,
    quantity_difference INT,
    notes TEXT,
    photo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_product (product_id),
    INDEX idx_date (audit_date),
    INDEX idx_audited_by (audited_by),
    INDEX idx_status (status),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (inventory_id) REFERENCES inventory(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Damages (пошкодження)
CREATE TABLE IF NOT EXISTS damages (
    id VARCHAR(36) PRIMARY KEY,
    order_id INT,
    product_id INT NOT NULL,
    damage_type ENUM('physical', 'missing', 'stain', 'broken', 'other') DEFAULT 'physical',
    severity ENUM('minor', 'major', 'critical', 'total_loss') DEFAULT 'minor',
    description TEXT,
    damage_cost DECIMAL(10,2) DEFAULT 0,
    responsible_party ENUM('customer', 'staff', 'transport', 'unknown') DEFAULT 'unknown',
    resolution_status ENUM('pending', 'repaired', 'replaced', 'written_off') DEFAULT 'pending',
    reported_by VARCHAR(100),
    reported_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    photo_url VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_product (product_id),
    INDEX idx_order (order_id),
    INDEX idx_severity (severity),
    INDEX idx_status (resolution_status),
    INDEX idx_date (reported_date),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Issue Cards (видача товарів)
CREATE TABLE IF NOT EXISTS issue_cards (
    id VARCHAR(36) PRIMARY KEY,
    order_id INT NOT NULL,
    issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    issued_by VARCHAR(100),
    status ENUM('pending', 'in_progress', 'issued', 'returned', 'cancelled') DEFAULT 'pending',
    notes TEXT,
    photo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_order (order_id),
    INDEX idx_status (status),
    INDEX idx_issued_by (issued_by),
    INDEX idx_date (issue_date),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Issue Card Items
CREATE TABLE IF NOT EXISTS issue_card_items (
    id VARCHAR(36) PRIMARY KEY,
    issue_card_id VARCHAR(36) NOT NULL,
    product_id INT NOT NULL,
    quantity_expected INT,
    quantity_issued INT DEFAULT 0,
    condition_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_issue_card (issue_card_id),
    INDEX idx_product (product_id),
    FOREIGN KEY (issue_card_id) REFERENCES issue_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Return Cards (повернення товарів)
CREATE TABLE IF NOT EXISTS return_cards (
    id VARCHAR(36) PRIMARY KEY,
    order_id INT NOT NULL,
    issue_card_id VARCHAR(36),
    return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    received_by VARCHAR(100),
    status ENUM('pending', 'in_progress', 'completed', 'partial') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_order (order_id),
    INDEX idx_issue_card (issue_card_id),
    INDEX idx_status (status),
    INDEX idx_date (return_date),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (issue_card_id) REFERENCES issue_cards(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Return Card Items
CREATE TABLE IF NOT EXISTS return_card_items (
    id VARCHAR(36) PRIMARY KEY,
    return_card_id VARCHAR(36) NOT NULL,
    product_id INT NOT NULL,
    quantity_expected INT,
    quantity_returned INT DEFAULT 0,
    condition ENUM('good', 'damaged', 'missing') DEFAULT 'good',
    condition_notes TEXT,
    needs_cleaning BOOLEAN DEFAULT FALSE,
    needs_repair BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_return_card (return_card_id),
    INDEX idx_product (product_id),
    INDEX idx_condition (condition),
    FOREIGN KEY (return_card_id) REFERENCES return_cards(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Tasks (задачі для співробітників)
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(36) PRIMARY KEY,
    task_type ENUM('cleaning', 'repair', 'audit', 'packing', 'other') NOT NULL,
    title VARCHAR(255),
    description TEXT,
    product_id INT,
    order_id INT,
    assigned_to VARCHAR(100),
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
    due_date DATE,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_type (task_type),
    INDEX idx_product (product_id),
    INDEX idx_order (order_id),
    INDEX idx_assigned (assigned_to),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_due_date (due_date),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Product History (історія змін товару)
CREATE TABLE IF NOT EXISTS product_history (
    id VARCHAR(36) PRIMARY KEY,
    product_id INT NOT NULL,
    action VARCHAR(100),
    actor VARCHAR(100),
    details TEXT,
    photo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_product (product_id),
    INDEX idx_action (action),
    INDEX idx_date (created_at),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Product Lifecycle Metrics (метрики життєвого циклу)
CREATE TABLE IF NOT EXISTS product_lifecycle (
    product_id INT PRIMARY KEY,
    total_rentals INT DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    total_damages INT DEFAULT 0,
    damage_cost DECIMAL(10,2) DEFAULT 0,
    last_rental_date DATE,
    last_audit_date DATE,
    days_since_last_rental INT,
    days_since_last_audit INT,
    roi DECIMAL(10,2),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_rentals (total_rentals),
    INDEX idx_revenue (total_revenue),
    INDEX idx_damages (total_damages),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Finance Transactions
CREATE TABLE IF NOT EXISTS finance_transactions (
    id VARCHAR(36) PRIMARY KEY,
    transaction_type ENUM('rental', 'deposit', 'damage', 'refund', 'payment') NOT NULL,
    order_id INT,
    customer_id INT,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'UAH',
    payment_method VARCHAR(50),
    status ENUM('pending', 'completed', 'cancelled', 'refunded') DEFAULT 'pending',
    description TEXT,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_type (transaction_type),
    INDEX idx_order (order_id),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_date (transaction_date),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Sync Log (для моніторингу синхронізації)
CREATE TABLE IF NOT EXISTS sync_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sync_type ENUM('products', 'orders', 'customers', 'categories', 'full') NOT NULL,
    status ENUM('started', 'completed', 'failed') NOT NULL,
    records_synced INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    duration_seconds INT,
    
    INDEX idx_type (sync_type),
    INDEX idx_status (status),
    INDEX idx_date (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- VIEWS для зручності
-- =====================================================

-- Продукти з inventory інформацією
CREATE OR REPLACE VIEW v_products_inventory AS
SELECT 
    p.product_id,
    p.sku,
    p.name,
    p.category_name,
    p.subcategory_name,
    p.price,
    p.rental_price,
    p.status as product_status,
    i.id as inventory_id,
    i.zone,
    i.aisle,
    i.shelf,
    i.quantity,
    i.reserved_quantity,
    i.available_quantity,
    i.cleaning_status,
    i.product_state,
    i.last_audit_date,
    i.next_audit_date,
    DATEDIFF(CURDATE(), i.last_audit_date) as days_since_audit
FROM products p
LEFT JOIN inventory i ON p.product_id = i.product_id;

-- Замовлення з деталями
CREATE OR REPLACE VIEW v_orders_details AS
SELECT 
    o.*,
    c.firstname,
    c.lastname,
    c.email,
    c.telephone,
    COUNT(DISTINCT oi.id) as items_count,
    SUM(oi.quantity) as total_quantity
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY o.order_id;

-- Аудит товарів що потребують перевірки
CREATE OR REPLACE VIEW v_products_need_audit AS
SELECT 
    p.product_id,
    p.sku,
    p.name,
    p.category_name,
    i.zone,
    i.last_audit_date,
    i.next_audit_date,
    DATEDIFF(CURDATE(), i.last_audit_date) as days_overdue,
    i.audit_priority
FROM products p
JOIN inventory i ON p.product_id = i.product_id
WHERE i.next_audit_date <= CURDATE()
   OR i.last_audit_date IS NULL
ORDER BY i.audit_priority DESC, days_overdue DESC;

-- =====================================================
-- INDEXES для оптимізації
-- =====================================================

-- Додаткові composite indexes для частих запитів
CREATE INDEX idx_inventory_location_status ON inventory(zone, aisle, product_state);
CREATE INDEX idx_orders_date_status ON orders(event_date, status);
CREATE INDEX idx_damages_product_status ON damages(product_id, resolution_status);
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status);

-- Full-text search indexes
ALTER TABLE products ADD FULLTEXT INDEX ft_name_desc (name, description);

-- =====================================================
-- ГОТОВО! База створена та оптимізована
-- =====================================================
