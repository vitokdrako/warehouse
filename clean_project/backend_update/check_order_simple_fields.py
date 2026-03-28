import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

try:
    connection = mysql.connector.connect(
        host=os.getenv('OC_DB_HOST'),
        port=int(os.getenv('OC_DB_PORT', 3306)),
        database=os.getenv('OC_DB_DATABASE'),
        user=os.getenv('OC_DB_USERNAME'),
        password=os.getenv('OC_DB_PASSWORD')
    )
    
    cursor = connection.cursor()
    
    print("Структура таблиці oc_order_simple_fields:")
    print("=" * 80)
    cursor.execute("DESCRIBE oc_order_simple_fields")
    columns = cursor.fetchall()
    for col in columns:
        print(f"{col[0]:30} {col[1]:30} {col[2]:10}")
    
    print("\n\nПриклад даних (останні 3 замовлення):")
    print("=" * 80)
    cursor.execute("""
        SELECT * FROM oc_order_simple_fields 
        ORDER BY order_id DESC 
        LIMIT 3
    """)
    rows = cursor.fetchall()
    
    # Get column names
    cursor.execute("DESCRIBE oc_order_simple_fields")
    col_names = [col[0] for col in cursor.fetchall()]
    
    for row in rows:
        print(f"\nOrder ID: {row[0]}")
        for i, col_name in enumerate(col_names):
            if i < len(row):
                print(f"  {col_name}: {row[i]}")
    
    cursor.close()
    connection.close()
    
except Exception as e:
    print(f"Помилка: {e}")
