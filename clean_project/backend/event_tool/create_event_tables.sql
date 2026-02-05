-- SQL скрипт для створення таблиць Event Planning System
-- База: farforre_rentalhub

-- Розширення таблиці customers для авторизації
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 1,
ADD COLUMN IF NOT EXISTS email_verified TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_login DATETIME;

-- Таблиця для мудбордів/івентів
CREATE TABLE IF NOT EXISTS event_boards (
    id VARCHAR(36) PRIMARY KEY,
    customer_id INT NOT NULL,
    board_name VARCHAR(255) NOT NULL,
    event_date DATE,
    event_type VARCHAR(100),  -- 'wedding', 'birthday', 'photoshoot', 'corporate', 'other'
    rental_start_date DATE,
    rental_end_date DATE,
    rental_days INT,
    status VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'active', 'submitted', 'converted', 'archived'
    notes TEXT,
    cover_image VARCHAR(500),
    budget DECIMAL(10, 2),
    estimated_total DECIMAL(10, 2) DEFAULT 0.00,
    canvas_layout JSON,  -- Layout for visual moodboard
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    converted_to_order_id INT,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (converted_to_order_id) REFERENCES orders(order_id) ON DELETE SET NULL,
    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_event_date (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблиця для товарів в мудборді
CREATE TABLE IF NOT EXISTS event_board_items (
    id VARCHAR(36) PRIMARY KEY,
    board_id VARCHAR(36) NOT NULL,
    product_id INT NOT NULL,
    quantity INT DEFAULT 1,
    notes TEXT,
    section VARCHAR(100),  -- 'tables', 'lighting', 'decor', 'furniture', etc.
    position INT DEFAULT 0,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES event_boards(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    INDEX idx_board (board_id),
    INDEX idx_product (product_id),
    INDEX idx_section (section)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблиця для м'якого резервування (30 хв)
CREATE TABLE IF NOT EXISTS soft_reservations (
    id VARCHAR(36) PRIMARY KEY,
    board_id VARCHAR(36) NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    reserved_from DATE NOT NULL,
    reserved_until DATE NOT NULL,
    expires_at DATETIME NOT NULL,  -- через 30 хвилин від created_at
    customer_id INT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',  -- 'active', 'expired', 'released', 'converted'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES event_boards(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    INDEX idx_board (board_id),
    INDEX idx_product_dates (product_id, reserved_from, reserved_until),
    INDEX idx_expires (expires_at),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблиця тегів для товарів (для розумного пошуку)
CREATE TABLE IF NOT EXISTS product_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    tag VARCHAR(100) NOT NULL,
    tag_type VARCHAR(50),  -- 'style', 'mood', 'occasion', 'color', 'material'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    INDEX idx_product (product_id),
    INDEX idx_tag (tag),
    INDEX idx_tag_type (tag_type),
    UNIQUE KEY unique_product_tag (product_id, tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблиця шаблонів івентів
CREATE TABLE IF NOT EXISTS event_templates (
    id VARCHAR(36) PRIMARY KEY,
    customer_id INT,  -- NULL для системних шаблонів
    template_name VARCHAR(255) NOT NULL,
    event_type VARCHAR(100),
    description TEXT,
    items JSON,  -- структура: [{"product_id": 123, "quantity": 5, "section": "tables"}]
    estimated_total DECIMAL(10, 2),
    is_public TINYINT(1) DEFAULT 0,  -- публічний шаблон
    created_by VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    INDEX idx_customer (customer_id),
    INDEX idx_event_type (event_type),
    INDEX idx_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблиця для відстеження активності користувачів
CREATE TABLE IF NOT EXISTS customer_activity (
    id VARCHAR(36) PRIMARY KEY,
    customer_id INT NOT NULL,
    activity_type VARCHAR(50) NOT NULL,  -- 'board_created', 'item_added', 'search', 'login'
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    INDEX idx_customer (customer_id),
    INDEX idx_activity_type (activity_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Таблиця для JWT refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id VARCHAR(36) PRIMARY KEY,
    customer_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked TINYINT(1) DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    INDEX idx_customer (customer_id),
    INDEX idx_token_hash (token_hash),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
