#!/usr/bin/env python3
"""
Додає поля issue_time та return_time до таблиці orders
"""
from database_rentalhub import get_rh_db_sync
from sqlalchemy import text

def add_time_fields():
    db = get_rh_db_sync()
    
    try:
        # Перевірити чи колонки вже існують
        result = db.execute(text("SHOW COLUMNS FROM orders LIKE 'issue_time'")).fetchone()
        if result:
            print("✅ Колонка issue_time вже існує")
        else:
            db.execute(text("ALTER TABLE orders ADD COLUMN issue_time VARCHAR(50) DEFAULT '11:30–12:00'"))
            db.commit()
            print("✅ Додано колонку issue_time")
        
        result = db.execute(text("SHOW COLUMNS FROM orders LIKE 'return_time'")).fetchone()
        if result:
            print("✅ Колонка return_time вже існує")
        else:
            db.execute(text("ALTER TABLE orders ADD COLUMN return_time VARCHAR(50) DEFAULT 'до 17:00'"))
            db.commit()
            print("✅ Додано колонку return_time")
            
        print("\n✅ Міграція завершена успішно!")
        
    except Exception as e:
        print(f"❌ Помилка: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_time_fields()
