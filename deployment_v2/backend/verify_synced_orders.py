"""
Verify that orders were synced correctly
"""
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

try:
    # Connect to RentalHub
    rh = mysql.connector.connect(
        host=os.getenv('RH_DB_HOST'),
        port=int(os.getenv('RH_DB_PORT', 3306)),
        database=os.getenv('RH_DB_DATABASE'),
        user=os.getenv('RH_DB_USERNAME'),
        password=os.getenv('RH_DB_PASSWORD')
    )
    
    cursor = rh.cursor(dictionary=True)
    
    print("=" * 100)
    print("ПЕРЕВІРКА СИНХРОНІЗОВАНИХ ЗАМОВЛЕНЬ")
    print("=" * 100)
    
    # Get latest 5 orders
    cursor.execute("""
        SELECT 
            order_id,
            order_number,
            customer_name,
            total_amount,
            deposit_amount,
            total_loss_value,
            rental_start_date,
            rental_end_date,
            rental_days,
            status,
            synced_at
        FROM orders
        ORDER BY synced_at DESC
        LIMIT 5
    """)
    
    orders = cursor.fetchall()
    
    print(f"\nОстанні {len(orders)} синхронізованих замовлень:\n")
    
    for i, order in enumerate(orders, 1):
        print(f"{i}. {order['order_number']} - {order['customer_name']}")
        print(f"   Дата видачі: {order['rental_start_date']}")
        print(f"   Дата повернення: {order['rental_end_date']}")
        print(f"   Днів оренди: {order['rental_days']}")
        print(f"   Загальна сума: {order['total_amount']} грн")
        print(f"   Застава: {order['deposit_amount']} грн")
        print(f"   Повна вартість збитків: {order['total_loss_value']} грн")
        print(f"   Статус: {order['status']}")
        print(f"   Синхронізовано: {order['synced_at']}")
        print()
    
    cursor.close()
    rh.close()
    
    print("✅ Перевірка завершена!")
    
except Exception as e:
    print(f"❌ Помилка: {e}")
    import traceback
    traceback.print_exc()
