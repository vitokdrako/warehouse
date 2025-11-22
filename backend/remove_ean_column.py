"""
Remove incorrectly added EAN column from products table
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
    
    print("Видаляю неправильну колонку EAN з таблиці products...")
    
    # Remove EAN column
    cursor.execute("""
        ALTER TABLE products 
        DROP COLUMN ean
    """)
    
    connection.commit()
    
    print("✅ Колонка EAN видалена!")
    
    cursor.close()
    connection.close()
    
except Exception as e:
    print(f"❌ Помилка: {e}")
