"""
Test calendar data - verify orders are returned in correct format
"""
import mysql.connector
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta

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
    print("ТЕСТ ДАНИХ ДЛЯ КАЛЕНДАРЯ")
    print("=" * 100)
    
    # Get date range (current month)
    today = datetime.now()
    start_date = today.replace(day=1).strftime('%Y-%m-%d')
    end_date = (today.replace(day=1) + timedelta(days=31)).strftime('%Y-%m-%d')
    
    print(f"\nПеріод: {start_date} - {end_date}")
    
    # Get orders
    cursor.execute("""
        SELECT 
            order_id,
            order_number,
            customer_name,
            customer_phone,
            rental_start_date,
            rental_end_date,
            status,
            total_amount,
            deposit_amount,
            total_loss_value,
            created_at
        FROM orders
        WHERE rental_start_date >= %s AND rental_start_date <= %s
        ORDER BY rental_start_date
    """, (start_date, end_date))
    
    orders = cursor.fetchall()
    
    print(f"\nЗнайдено замовлень: {len(orders)}")
    print("\n" + "=" * 100)
    print("ЗАМОВЛЕННЯ ПО СТАТУСАХ:")
    print("=" * 100)
    
    # Group by status
    status_groups = {}
    for order in orders:
        status = order['status']
        if status not in status_groups:
            status_groups[status] = []
        status_groups[status].append(order)
    
    for status, orders_list in status_groups.items():
        print(f"\n📊 {status.upper()}: {len(orders_list)} замовлень")
        
        for order in orders_list[:3]:  # Show first 3 in each status
            print(f"   • {order['order_number']} - {order['customer_name']}")
            print(f"     Дата видачі: {order['rental_start_date']}")
            print(f"     Дата повернення: {order['rental_end_date']}")
            print(f"     Сума: {order['total_amount']} грн")
            print(f"     Застава: {order['deposit_amount']} грн")
        
        if len(orders_list) > 3:
            print(f"   ... і ще {len(orders_list) - 3}")
    
    print("\n" + "=" * 100)
    print("ВІДОБРАЖЕННЯ В КАЛЕНДАРІ:")
    print("=" * 100)
    
    total_events = 0
    
    for status, orders_list in status_groups.items():
        events = 0
        
        if status == 'awaiting_customer':
            # Show as "new"
            events = len(orders_list)
            print(f"\n🆕 НОВІ (awaiting_customer): {events} подій")
        else:
            # Show as issue + return
            events = len(orders_list) * 2  # issue + return
            print(f"\n📦 ВИДАЧІ: {len(orders_list)} подій")
            print(f"↩️ ПОВЕРНЕННЯ: {len(orders_list)} подій")
        
        total_events += events
    
    print(f"\n{'=' * 100}")
    print(f"ВСЬОГО ПОДІЙ В КАЛЕНДАРІ: {total_events}")
    print("=" * 100)
    
    cursor.close()
    rh.close()
    
    print("\n✅ Тест завершено!")
    
except Exception as e:
    print(f"\n❌ Помилка: {e}")
    import traceback
    traceback.print_exc()
