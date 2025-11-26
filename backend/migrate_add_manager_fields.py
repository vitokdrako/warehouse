"""
Міграція: додати поля manager_comment та damage_fee до таблиці orders
"""
import os
from sqlalchemy import create_engine, text

# Get database credentials from environment
MONGO_URL = os.getenv('MONGO_URL', '')
MYSQL_ROOT_PASSWORD = os.getenv('MYSQL_ROOT_PASSWORD', 'farfor777')

# Use localhost for internal connection
engine = create_engine(f'mysql+pymysql://root:{MYSQL_ROOT_PASSWORD}@127.0.0.1/farforre_rentalhub')

print("🔄 Початок міграції...")

with engine.connect() as conn:
    # Додати колонку manager_comment
    try:
        conn.execute(text("""
            ALTER TABLE orders 
            ADD COLUMN manager_comment TEXT NULL
        """))
        conn.commit()
        print("✅ Додано колонку manager_comment")
    except Exception as e:
        if "Duplicate column name" in str(e):
            print("⚠️ Колонка manager_comment вже існує")
        else:
            print(f"❌ Помилка при додаванні manager_comment: {e}")
    
    # Додати колонку damage_fee
    try:
        conn.execute(text("""
            ALTER TABLE orders 
            ADD COLUMN damage_fee DECIMAL(10,2) DEFAULT 0.00
        """))
        conn.commit()
        print("✅ Додано колонку damage_fee")
    except Exception as e:
        if "Duplicate column name" in str(e):
            print("⚠️ Колонка damage_fee вже існує")
        else:
            print(f"❌ Помилка при додаванні damage_fee: {e}")

print("✅ Міграція завершена!")
