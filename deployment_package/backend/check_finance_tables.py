"""
Check finance-related tables structure
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
    
    print("=" * 100)
    print("ПЕРЕВІРКА ФІНАНСОВИХ ТАБЛИЦЬ")
    print("=" * 100)
    
    # Check if finance_transactions table exists
    cursor.execute("SHOW TABLES LIKE 'finance_transactions'")
    finance_table = cursor.fetchone()
    
    if finance_table:
        print("\n✅ Таблиця 'finance_transactions' існує")
        cursor.execute("DESCRIBE finance_transactions")
        columns = cursor.fetchall()
        print("\nСтруктура таблиці finance_transactions:")
        for col in columns:
            print(f"  {col[0]:30} {col[1]:30} {col[2]:10}")
    else:
        print("\n❌ Таблиця 'finance_transactions' НЕ існує!")
    
    # Check orders table fields
    print("\n" + "=" * 100)
    print("ФІНАНСОВІ ПОЛЯ В ТАБЛИЦІ ORDERS:")
    print("=" * 100)
    
    cursor.execute("DESCRIBE orders")
    all_columns = cursor.fetchall()
    
    finance_related = ['total_amount', 'deposit_amount', 'total_loss_value', 'rental_days']
    
    print("\nФінансові поля:")
    for col in all_columns:
        if any(field in col[0] for field in finance_related):
            print(f"  ✅ {col[0]:30} {col[1]:30}")
    
    # Get sample order data
    print("\n" + "=" * 100)
    print("ПРИКЛАД ФІНАНСОВИХ ДАНИХ З ORDERS:")
    print("=" * 100)
    
    cursor.execute("""
        SELECT 
            order_id,
            order_number,
            customer_name,
            total_amount,
            deposit_amount,
            total_loss_value,
            rental_days,
            rental_start_date,
            rental_end_date,
            status
        FROM orders
        ORDER BY synced_at DESC
        LIMIT 3
    """)
    
    orders = cursor.fetchall()
    
    for order in orders:
        print(f"\n{order[1]} - {order[2]}")
        print(f"  Загальна сума: {order[3]} грн")
        print(f"  Застава: {order[4]} грн")
        print(f"  Вартість збитків: {order[5]} грн")
        print(f"  Днів оренди: {order[6]}")
        print(f"  Дати: {order[7]} - {order[8]}")
        print(f"  Статус: {order[9]}")
    
    cursor.close()
    connection.close()
    
    print("\n" + "=" * 100)
    print("✅ Перевірка завершена!")
    print("=" * 100)
    
except Exception as e:
    print(f"❌ Помилка: {e}")
    import traceback
    traceback.print_exc()
