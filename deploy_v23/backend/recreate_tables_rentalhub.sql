-- Recreate tables in RentalHub DB with proper structure matching decor_* tables
-- Run this to prepare RentalHub DB for full migration

USE farforre_rentalhub;

-- Drop existing simplified tables
DROP TABLE IF EXISTS issue_card_items;
DROP TABLE IF EXISTS return_card_items;
DROP TABLE IF EXISTS issue_cards;
DROP TABLE IF EXISTS return_cards;
DROP TABLE IF EXISTS tasks;

-- Recreate issue_cards with full structure
CREATE TABLE issue_cards (
    id VARCHAR(50) PRIMARY KEY,
    order_id INT(11) NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'preparation',
    prepared_by VARCHAR(100),
    issued_by VARCHAR(100),
    items JSON,
    preparation_notes TEXT,
    issue_notes TEXT,
    prepared_at DATETIME,
    issued_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_id (order_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recreate return_cards with full structure
CREATE TABLE return_cards (
    id VARCHAR(50) PRIMARY KEY,
    order_id INT(11) NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    issue_card_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    received_by VARCHAR(100),
    checked_by VARCHAR(100),
    items_expected JSON,
    items_returned JSON,
    total_items_expected INT(11) DEFAULT 0,
    total_items_returned INT(11) DEFAULT 0,
    items_ok INT(11) DEFAULT 0,
    items_dirty INT(11) DEFAULT 0,
    items_damaged INT(11) DEFAULT 0,
    items_missing INT(11) DEFAULT 0,
    cleaning_fee DECIMAL(10,2) DEFAULT 0.00,
    late_fee DECIMAL(10,2) DEFAULT 0.00,
    return_notes TEXT,
    returned_at DATETIME,
    checked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_id (order_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recreate tasks with full structure
CREATE TABLE tasks (
    id VARCHAR(36) PRIMARY KEY,
    order_id INT(11),
    order_number VARCHAR(50),
    damage_id VARCHAR(36),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'todo',
    priority VARCHAR(20) DEFAULT 'medium',
    assigned_to VARCHAR(100),
    due_date DATETIME,
    completed_at DATETIME,
    created_by VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_id (order_id),
    INDEX idx_damage_id (damage_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Update damages table structure (ALTER instead of recreate to preserve any data)
-- Check if table exists first, if not create it
CREATE TABLE IF NOT EXISTS damages (
    id VARCHAR(36) PRIMARY KEY,
    order_id INT(11),
    order_number VARCHAR(50),
    customer_id INT(11),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(32),
    customer_email VARCHAR(96),
    event_name VARCHAR(255),
    return_date DATETIME,
    case_status VARCHAR(50) DEFAULT 'pending',
    severity VARCHAR(20) DEFAULT 'minor',
    source VARCHAR(20),
    from_reaudit_item_id VARCHAR(50),
    finance_status VARCHAR(50) DEFAULT 'pending',
    fulfillment_status VARCHAR(50) DEFAULT 'pending',
    claimed_total DECIMAL(10,2) DEFAULT 0.00,
    paid_total DECIMAL(10,2) DEFAULT 0.00,
    withheld_total DECIMAL(10,2) DEFAULT 0.00,
    deposit_available DECIMAL(10,2) DEFAULT 0.00,
    notes TEXT,
    payment_policy VARCHAR(50),
    created_by VARCHAR(100),
    assigned_to VARCHAR(100),
    manager_comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_id (order_id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_case_status (case_status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create damage_items table
CREATE TABLE IF NOT EXISTS damage_items (
    id INT(11) PRIMARY KEY AUTO_INCREMENT,
    damage_id VARCHAR(36) NOT NULL,
    product_id INT(11),
    barcode VARCHAR(100),
    name VARCHAR(255),
    image VARCHAR(255),
    category VARCHAR(100),
    item_ref VARCHAR(100),
    damage_type VARCHAR(100),
    qty INT(11) DEFAULT 1,
    base_value DECIMAL(10,2) DEFAULT 0.00,
    estimate_value DECIMAL(10,2) DEFAULT 0.00,
    resolution VARCHAR(50),
    comment TEXT,
    photos TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_damage_id (damage_id),
    INDEX idx_product_id (product_id),
    FOREIGN KEY (damage_id) REFERENCES damages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Tables recreated successfully!' as status;
