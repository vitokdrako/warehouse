"""
Create decor_issue_cards table if not exists
"""
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

try:
    connection = mysql.connector.connect(
        host=os.getenv('RH_DB_HOST'),
        port=int(os.getenv('RH_DB_PORT', 3306)),
        database=os.getenv('RH_DB_DATABASE'),
        user=os.getenv('RH_DB_USERNAME'),
        password=os.getenv('RH_DB_PASSWORD')
    )
    
    cursor = connection.cursor()
    
    print("Створення таблиці decor_issue_cards...")
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS decor_issue_cards (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'preparation',
            preparation_notes TEXT,
            warehouse_location VARCHAR(255),
            assigned_to VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            completed_at TIMESTAMP NULL,
            
            INDEX idx_order_id (order_id),
            INDEX idx_status (status),
            INDEX idx_assigned_to (assigned_to),
            
            FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """)
    
    connection.commit()
    
    print("✅ Таблиця decor_issue_cards успішно створена!")
    
    # Verify
    cursor.execute("DESCRIBE decor_issue_cards")
    columns = cursor.fetchall()
    
    print("\nСтруктура таблиці:")
    print("=" * 80)
    for col in columns:
        print(f"  {col[0]:25} {col[1]:30} {col[2]:10}")
    
    cursor.close()
    connection.close()
    
except Exception as e:
    print(f"❌ Помилка: {e}")
    import traceback
    traceback.print_exc()
