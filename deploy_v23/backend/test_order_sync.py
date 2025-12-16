"""
Test script to verify order sync logic
"""
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

try:
    # Connect to OpenCart
    oc = mysql.connector.connect(
        host=os.getenv('OC_DB_HOST'),
        port=int(os.getenv('OC_DB_PORT', 3306)),
        database=os.getenv('OC_DB_DATABASE'),
        user=os.getenv('OC_DB_USERNAME'),
        password=os.getenv('OC_DB_PASSWORD')
    )
    
    cursor = oc.cursor(dictionary=True)
    
    print("=" * 100)
    print("ТЕСТ ЛОГІКИ СИНХРОНІЗАЦІЇ ЗАМОВЛЕНЬ")
    print("=" * 100)
    
    # Get one test order
    cursor.execute("""
        SELECT 
            o.order_id,
            CONCAT('OC-', o.order_id) as order_number,
            o.customer_id,
            CONCAT(o.firstname, ' ', o.lastname) as customer_name,
            o.email as customer_email,
            o.telephone as customer_phone,
            o.total as total_amount,
            osf.rent_issue_date as rental_start_date,
            osf.rent_return_date as rental_end_date,
            o.date_added,
            o.order_status_id
        FROM oc_order o
        LEFT JOIN oc_order_simple_fields osf ON o.order_id = osf.order_id
        WHERE o.order_status_id = 2
        ORDER BY o.order_id DESC
        LIMIT 1
    """)
    
    order = cursor.fetchone()
    
    if not order:
        print("❌ Немає замовлень зі статусом 'Processing' (status = 2)")
        cursor.close()
        oc.close()
        exit()
    
    print(f"\n📦 Тестове замовлення: {order['order_number']}")
    print(f"   Клієнт: {order['customer_name']}")
    print(f"   Дата видачі: {order['rental_start_date']}")
    print(f"   Дата повернення: {order['rental_end_date']}")
    print(f"   Загальна сума: {order['total_amount']}")
    
    # Get products with EAN
    cursor.execute("""
        SELECT 
            op.product_id,
            op.name as product_name,
            op.quantity,
            p.ean,
            p.price as rental_price
        FROM oc_order_product op
        JOIN oc_product p ON op.product_id = p.product_id
        WHERE op.order_id = %s
    """, (order['order_id'],))
    
    products = cursor.fetchall()
    
    print(f"\n📋 Товари в замовленні:")
    print("-" * 100)
    
    total_ean = 0
    for prod in products:
        ean_value = float(prod['ean']) if prod['ean'] else 0
        product_ean_total = ean_value * prod['quantity']
        total_ean += product_ean_total
        
        print(f"   {prod['product_name'][:50]:<50}")
        print(f"      Кількість: {prod['quantity']}")
        print(f"      Ціна оренди: {prod['rental_price']} грн")
        print(f"      EAN (збиток за 1 шт): {ean_value} грн")
        print(f"      EAN разом: {product_ean_total} грн")
        print()
    
    print("=" * 100)
    print(f"💰 РОЗРАХУНОК:")
    print(f"   Сума всіх EAN: {total_ean} грн")
    print(f"   Застава (EAN / 2): {total_ean / 2} грн")
    print(f"   Повна вартість збитків: {total_ean} грн")
    print("=" * 100)
    
    # Calculate rental days
    if order['rental_start_date'] and order['rental_end_date']:
        from datetime import datetime
        start = datetime.strptime(str(order['rental_start_date']), '%Y-%m-%d')
        end = datetime.strptime(str(order['rental_end_date']), '%Y-%m-%d')
        rental_days = (end - start).days
        if rental_days < 1:
            rental_days = 1
        print(f"\n📅 Днів оренди: {rental_days}")
    
    cursor.close()
    oc.close()
    
    print("\n✅ Тест завершено!")
    
except Exception as e:
    print(f"\n❌ Помилка: {e}")
    import traceback
    traceback.print_exc()
