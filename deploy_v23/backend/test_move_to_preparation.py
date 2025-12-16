"""
Test move-to-preparation workflow
"""
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def test_preparation_flow():
    """Тест процесу відправки на збір"""
    
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
        print("ТЕСТ ПРОЦЕСУ 'ВІДПРАВИТИ НА ЗБІР'")
        print("=" * 100)
        
        # 1. Перевірити чи є замовлення зі статусом awaiting_customer
        print("\n1️⃣ Пошук замовлень у статусі 'awaiting_customer':")
        cursor.execute("""
            SELECT 
                order_id,
                order_number,
                customer_name,
                status,
                client_confirmed
            FROM orders
            WHERE status = 'awaiting_customer'
            LIMIT 5
        """)
        
        awaiting_orders = cursor.fetchall()
        
        if awaiting_orders:
            print(f"   ✅ Знайдено {len(awaiting_orders)} замовлень:")
            for order in awaiting_orders:
                print(f"      • {order['order_number']} - {order['customer_name']}")
                print(f"        Статус: {order['status']}, Підтверджено: {order['client_confirmed']}")
        else:
            print("   ⚠️ Немає замовлень зі статусом 'awaiting_customer'")
            print("   Створіть тестове замовлення через синхронізацію")
        
        # 2. Перевірити чи є замовлення зі статусом processing
        print("\n2️⃣ Пошук замовлень у статусі 'processing' (після відправки на збір):")
        cursor.execute("""
            SELECT 
                o.order_id,
                o.order_number,
                o.customer_name,
                o.status,
                o.client_confirmed,
                dic.id as issue_card_id,
                dic.status as issue_status
            FROM orders o
            LEFT JOIN decor_issue_cards dic ON o.order_id = dic.order_id
            WHERE o.status = 'processing'
            LIMIT 5
        """)
        
        processing_orders = cursor.fetchall()
        
        if processing_orders:
            print(f"   ✅ Знайдено {len(processing_orders)} замовлень на збір:")
            for order in processing_orders:
                print(f"      • {order['order_number']} - {order['customer_name']}")
                print(f"        Статус: {order['status']}, Підтверджено: {order['client_confirmed']}")
                if order['issue_card_id']:
                    print(f"        Issue Card ID: {order['issue_card_id']}, Статус: {order['issue_status']}")
                else:
                    print(f"        ⚠️ Issue Card відсутня!")
        else:
            print("   ℹ️ Немає замовлень у статусі 'processing'")
        
        # 3. Перевірити issue cards зі статусом preparation
        print("\n3️⃣ Перевірка Issue Cards зі статусом 'preparation':")
        cursor.execute("""
            SELECT 
                dic.id,
                dic.order_id,
                o.order_number,
                o.customer_name,
                dic.status,
                dic.created_at,
                dic.updated_at
            FROM decor_issue_cards dic
            JOIN orders o ON dic.order_id = o.order_id
            WHERE dic.status = 'preparation'
            LIMIT 5
        """)
        
        preparation_cards = cursor.fetchall()
        
        if preparation_cards:
            print(f"   ✅ Знайдено {len(preparation_cards)} карток на комплектації:")
            for card in preparation_cards:
                print(f"      • Issue Card #{card['id']} - {card['order_number']}")
                print(f"        Замовлення: {card['customer_name']}")
                print(f"        Створено: {card['created_at']}")
                print(f"        Оновлено: {card['updated_at']}")
        else:
            print("   ℹ️ Немає карток зі статусом 'preparation'")
        
        # 4. Перевірка логіки workflow
        print("\n" + "=" * 100)
        print("ПЕРЕВІРКА WORKFLOW:")
        print("=" * 100)
        
        print("\n📋 Очікувана логіка:")
        print("   1. Замовлення створюється зі статусом 'awaiting_customer'")
        print("   2. Менеджер натискає '📦 Відправити на збір'")
        print("   3. Backend оновлює:")
        print("      • orders.status → 'processing'")
        print("      • orders.client_confirmed → TRUE")
        print("      • Створює або оновлює decor_issue_cards зі статусом 'preparation'")
        print("   4. Замовлення з'являється в колонці 'На комплектації' на дашборді")
        
        # 5. Підсумок
        print("\n" + "=" * 100)
        print("ПІДСУМОК:")
        print("=" * 100)
        
        print(f"\n✅ Замовлень очікують підтвердження: {len(awaiting_orders)}")
        print(f"✅ Замовлень на обробці (processing): {len(processing_orders)}")
        print(f"✅ Карток на комплектації: {len(preparation_cards)}")
        
        if awaiting_orders and not processing_orders:
            print("\n💡 Рекомендація: Відкрийте замовлення і натисніть '📦 Відправити на збір'")
        
        cursor.close()
        rh.close()
        
        print("\n" + "=" * 100)
        print("✅ Тест завершено!")
        print("=" * 100)
        
    except Exception as e:
        print(f"\n❌ Помилка: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_preparation_flow()
