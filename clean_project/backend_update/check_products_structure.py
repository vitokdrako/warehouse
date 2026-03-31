import os
import mysql.connector
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
    cursor.execute("DESCRIBE products")
    columns = cursor.fetchall()
    
    print("Структура таблиці products:")
    print("=" * 80)
    for col in columns:
        print(f"{col[0]:20} {col[1]:30} {col[2]:10} {col[3]:10}")
    
    cursor.close()
    connection.close()
    
except Exception as e:
    print(f"Помилка: {e}")
