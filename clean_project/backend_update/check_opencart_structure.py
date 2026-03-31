import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

try:
    # Підключення до OpenCart DB
    connection = mysql.connector.connect(
        host=os.getenv('OC_DB_HOST'),
        port=int(os.getenv('OC_DB_PORT', 3306)),
        database=os.getenv('OC_DB_DATABASE'),
        user=os.getenv('OC_DB_USERNAME'),
        password=os.getenv('OC_DB_PASSWORD')
    )
    
    cursor = connection.cursor()
    cursor.execute("DESCRIBE oc_product")
    columns = cursor.fetchall()
    
    print("Структура таблиці oc_product (OpenCart):")
    print("=" * 80)
    for col in columns:
        print(f"{col[0]:20} {col[1]:30} {col[2]:10}")
    
    print("\n\n")
    
    # Перевірити один продукт для прикладу
    cursor.execute("SELECT product_id, sku, price, ean FROM oc_product WHERE product_id = 3230")
    product = cursor.fetchone()
    print("Приклад продукту (ID 3230):")
    if product:
        print(f"product_id: {product[0]}")
        print(f"sku: {product[1]}")
        print(f"price: {product[2]}")
        print(f"ean: {product[3]}")
    
    cursor.close()
    connection.close()
    
except Exception as e:
    print(f"Помилка: {e}")
