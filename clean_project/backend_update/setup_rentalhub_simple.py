"""
Simple script to create RentalHub tables one by one
"""
import mysql.connector
from mysql.connector import Error

RENTALHUB_DB_CONFIG = {
    'host': 'farforre.mysql.tools',
    'database': 'farforre_rentalhub',
    'user': 'farforre_rentalhub',
    'password': '-nu+3Gp54L',
    'charset': 'utf8mb4'
}

# List of CREATE TABLE statements
TABLES = [
    # 1. Products snapshot
    """CREATE TABLE IF NOT EXISTS products (
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
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sku (sku),
        INDEX idx_category (category_id),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 2. Categories
    """CREATE TABLE IF NOT EXISTS categories (
        category_id INT PRIMARY KEY,
        parent_id INT DEFAULT 0,
        name VARCHAR(255),
        sort_order INT DEFAULT 0,
        status TINYINT DEFAULT 1,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_parent (parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 3. Orders
    """CREATE TABLE IF NOT EXISTS orders (
        order_id INT PRIMARY KEY,
        order_number VARCHAR(50),
        customer_id INT,
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        customer_email VARCHAR(255),
        event_date DATE,
        rental_start_date DATE,
        rental_end_date DATE,
        rental_days INT,
        total_amount DECIMAL(10,2),
        deposit_amount DECIMAL(10,2),
        status VARCHAR(50),
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP,
        INDEX idx_order_number (order_number),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 4. Order Items
    """CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        product_name VARCHAR(500),
        quantity INT NOT NULL,
        price DECIMAL(10,2),
        total_rental DECIMAL(10,2),
        INDEX idx_order (order_id),
        INDEX idx_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 5. Customers
    """CREATE TABLE IF NOT EXISTS customers (
        customer_id INT PRIMARY KEY,
        firstname VARCHAR(255),
        lastname VARCHAR(255),
        email VARCHAR(255),
        telephone VARCHAR(50),
        status TINYINT DEFAULT 1,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 6. Inventory
    """CREATE TABLE IF NOT EXISTS inventory (
        id VARCHAR(36) PRIMARY KEY,
        product_id INT NOT NULL,
        zone VARCHAR(50),
        aisle VARCHAR(50),
        shelf VARCHAR(50),
        quantity INT DEFAULT 0,
        reserved_quantity INT DEFAULT 0,
        cleaning_status VARCHAR(20) DEFAULT 'clean',
        product_state VARCHAR(20) DEFAULT 'available',
        last_audit_date DATE,
        last_audit_by VARCHAR(100),
        next_audit_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_product (product_id),
        INDEX idx_zone (zone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 7. Audit Records
    """CREATE TABLE IF NOT EXISTS audit_records (
        id VARCHAR(36) PRIMARY KEY,
        product_id INT NOT NULL,
        inventory_id VARCHAR(36),
        audit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        audited_by VARCHAR(100),
        status VARCHAR(20) DEFAULT 'ok',
        quantity_expected INT,
        quantity_actual INT,
        notes TEXT,
        photo_url VARCHAR(500),
        INDEX idx_product (product_id),
        INDEX idx_date (audit_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 8. Damages
    """CREATE TABLE IF NOT EXISTS damages (
        id VARCHAR(36) PRIMARY KEY,
        order_id INT,
        product_id INT NOT NULL,
        damage_type VARCHAR(50) DEFAULT 'physical',
        severity VARCHAR(20) DEFAULT 'minor',
        description TEXT,
        damage_cost DECIMAL(10,2) DEFAULT 0,
        resolution_status VARCHAR(50) DEFAULT 'pending',
        reported_by VARCHAR(100),
        reported_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        photo_url VARCHAR(500),
        INDEX idx_product (product_id),
        INDEX idx_order (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 9. Issue Cards
    """CREATE TABLE IF NOT EXISTS issue_cards (
        id VARCHAR(36) PRIMARY KEY,
        order_id INT NOT NULL,
        issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        issued_by VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        INDEX idx_order (order_id),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 10. Issue Card Items
    """CREATE TABLE IF NOT EXISTS issue_card_items (
        id VARCHAR(36) PRIMARY KEY,
        issue_card_id VARCHAR(36) NOT NULL,
        product_id INT NOT NULL,
        quantity_expected INT,
        quantity_issued INT DEFAULT 0,
        condition_notes TEXT,
        INDEX idx_issue_card (issue_card_id),
        INDEX idx_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 11. Return Cards
    """CREATE TABLE IF NOT EXISTS return_cards (
        id VARCHAR(36) PRIMARY KEY,
        order_id INT NOT NULL,
        return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        received_by VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        INDEX idx_order (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 12. Return Card Items
    """CREATE TABLE IF NOT EXISTS return_card_items (
        id VARCHAR(36) PRIMARY KEY,
        return_card_id VARCHAR(36) NOT NULL,
        product_id INT NOT NULL,
        quantity_expected INT,
        quantity_returned INT DEFAULT 0,
        condition VARCHAR(20) DEFAULT 'good',
        needs_cleaning BOOLEAN DEFAULT FALSE,
        INDEX idx_return_card (return_card_id),
        INDEX idx_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 13. Tasks
    """CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(36) PRIMARY KEY,
        task_type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        description TEXT,
        product_id INT,
        order_id INT,
        assigned_to VARCHAR(100),
        priority VARCHAR(20) DEFAULT 'medium',
        status VARCHAR(50) DEFAULT 'pending',
        due_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_type (task_type),
        INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 14. Product History
    """CREATE TABLE IF NOT EXISTS product_history (
        id VARCHAR(36) PRIMARY KEY,
        product_id INT NOT NULL,
        action VARCHAR(100),
        actor VARCHAR(100),
        details TEXT,
        photo_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_product (product_id),
        INDEX idx_action (action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 15. Product Lifecycle
    """CREATE TABLE IF NOT EXISTS product_lifecycle (
        product_id INT PRIMARY KEY,
        total_rentals INT DEFAULT 0,
        total_revenue DECIMAL(10,2) DEFAULT 0,
        total_damages INT DEFAULT 0,
        damage_cost DECIMAL(10,2) DEFAULT 0,
        last_rental_date DATE,
        last_audit_date DATE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 16. Finance Transactions
    """CREATE TABLE IF NOT EXISTS finance_transactions (
        id VARCHAR(36) PRIMARY KEY,
        transaction_type VARCHAR(50) NOT NULL,
        order_id INT,
        customer_id INT,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'UAH',
        status VARCHAR(50) DEFAULT 'pending',
        description TEXT,
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_type (transaction_type),
        INDEX idx_order (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    
    # 17. Sync Log
    """CREATE TABLE IF NOT EXISTS sync_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sync_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        records_synced INT DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        INDEX idx_type (sync_type),
        INDEX idx_date (started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"""
]

def main():
    print("=" * 60)
    print("🚀 CREATING RENTALHUB TABLES")
    print("=" * 60)
    
    try:
        # Connect
        connection = mysql.connector.connect(**RENTALHUB_DB_CONFIG)
        cursor = connection.cursor()
        print(f"✅ Connected to: {RENTALHUB_DB_CONFIG['database']}\n")
        
        # Create each table
        for i, table_sql in enumerate(TABLES, 1):
            try:
                cursor.execute(table_sql)
                # Extract table name
                table_name = table_sql.split('TABLE IF NOT EXISTS ')[1].split(' (')[0].strip()
                print(f"  ✅ {i}/{len(TABLES)} Created: {table_name}")
            except Error as e:
                print(f"  ❌ Error creating table: {e}")
        
        connection.commit()
        
        # Verify
        print(f"\n🔍 Verifying tables...")
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        print(f"\n✅ Total tables created: {len(tables)}")
        for table in tables:
            print(f"  - {table[0]}")
        
        cursor.close()
        connection.close()
        
        print("\n" + "=" * 60)
        print("✅ RENTALHUB DATABASE READY!")
        print("=" * 60)
        
    except Error as e:
        print(f"❌ Database error: {e}")

if __name__ == "__main__":
    main()
