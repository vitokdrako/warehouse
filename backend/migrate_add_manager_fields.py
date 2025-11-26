"""
Міграція: додати поля manager_comment та damage_fee до таблиці orders
"""
import os
from sqlalchemy import create_engine, text

# Get database credentials from environment
MONGO_URL = os.getenv('MONGO_URL', '')
MYSQL_ROOT_PASSWORD = os.getenv('MYSQL_ROOT_PASSWORD', 'farfor777')

# Use the same connection as the app
RH_HOST = os.environ.get('RH_DB_HOST', 'farforre.mysql.tools')
RH_USER = os.environ.get('RH_DB_USER', 'farforre_rental')
RH_PASSWORD = os.environ.get('RH_DB_PASSWORD', 'farfor777')
RH_PORT = os.environ.get('RH_DB_PORT', '3306')
RH_DATABASE = os.environ.get('RH_DB_NAME', 'farforre_rentalhub')

engine = create_engine(f'mysql+pymysql://{RH_USER}:{RH_PASSWORD}@{RH_HOST}:{RH_PORT}/{RH_DATABASE}?charset=utf8mb4')

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
