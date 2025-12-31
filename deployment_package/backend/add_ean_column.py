"""
Add EAN column to products table in RentalHub DB
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
    
    print("Додаю колонку EAN до таблиці products...")
    
    # Add EAN column
    cursor.execute("""
        ALTER TABLE products 
        ADD COLUMN ean VARCHAR(100) NULL AFTER rental_price
    """)
    
    connection.commit()
    
    print("✅ Колонка EAN успішно додана!")
    
    # Verify
    cursor.execute("DESCRIBE products")
    columns = cursor.fetchall()
    
    print("\nОновлена структура таблиці products:")
    print("=" * 80)
    for col in columns:
        if col[0] in ['ean', 'rental_price', 'price']:
            print(f"  {col[0]:20} {col[1]:30} {col[2]:10}")
    
    cursor.close()
    connection.close()
    
except Exception as e:
    print(f"❌ Помилка: {e}")
    import traceback
    traceback.print_exc()
