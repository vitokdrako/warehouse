import os
import mysql.connector
from mysql.connector import Error
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

# Дані з Google Spreadsheet (перенесені з файлу)
audit_data = [
    {"product_id": 3230, "name": "Пуф 36*30 см", "quantity": 18, "price": 400.00, "ean": 4000},
    {"product_id": 4774, "name": "Пуф 36*30 см", "quantity": 8, "price": 400.00, "ean": 4000},
    {"product_id": 7982, "name": "Пуф 18 см", "quantity": 2, "price": 400.00, "ean": 4000},
    {"product_id": 4807, "name": "Пуф", "quantity": 1, "price": 400.00, "ean": 4000},
    {"product_id": 8491, "name": "Пуф 46*30 см", "quantity": 1, "price": 400.00, "ean": 4000},
    {"product_id": 8492, "name": "Пуф 25*50 см", "quantity": 1, "price": 400.00, "ean": 4000},
    {"product_id": 5242, "name": "Пуф", "quantity": 4, "price": 500.00, "ean": 4000},
    {"product_id": 5271, "name": "Пуф 36*30 см", "quantity": 1, "price": 500.00, "ean": 4000},
    {"product_id": 7350, "name": "Пуф", "quantity": 6, "price": 600.00, "ean": 3700},
    {"product_id": 3476, "name": "Пуф 40 см", "quantity": 2, "price": 400.00, "ean": 4000},
    {"product_id": 4740, "name": "Пуф 41*41*47 см", "quantity": 4, "price": 500.00, "ean": 4000},
    {"product_id": 5270, "name": "Пуф 41*41*38 см", "quantity": 2, "price": 500.00, "ean": 4000},
    {"product_id": 5274, "name": "Пуф 38*35 см", "quantity": 2, "price": 500.00, "ean": 4000},
    {"product_id": 5269, "name": "Пуф 38*35 см", "quantity": 2, "price": 500.00, "ean": 4000},
    {"product_id": 4793, "name": "Пуф", "quantity": 1, "price": 500.00, "ean": 4000},
    {"product_id": 4630, "name": "Пуф", "quantity": 2, "price": 500.00, "ean": 4500},
    {"product_id": 3049, "name": "Пуф 40*40*40 см", "quantity": 1, "price": 200.00, "ean": 5000},
    {"product_id": 3053, "name": "Пуф 40*40*40 см", "quantity": 2, "price": 400.00, "ean": 5000},
    {"product_id": 811, "name": "Пуф 35 см", "quantity": 2, "price": 400.00, "ean": 5000},
    {"product_id": 2841, "name": "Пуф 40 см", "quantity": 1, "price": 400.00, "ean": 5000},
    {"product_id": 2843, "name": "Пуф 40 см", "quantity": 1, "price": 400.00, "ean": 5000},
    {"product_id": 3084, "name": "Пуф 30*45 см", "quantity": 2, "price": 400.00, "ean": 5000},
    {"product_id": 3228, "name": "Пуф 36*30 см", "quantity": 18, "price": 400.00, "ean": 5000},
    {"product_id": 3229, "name": "Пуф 36*30 см", "quantity": 19, "price": 400.00, "ean": 5000},
    {"product_id": 4497, "name": "Пуф 25*30 см", "quantity": 2, "price": 400.00, "ean": 5000},
    {"product_id": 1015, "name": "Пуф", "quantity": 8, "price": 500.00, "ean": 5000},
    {"product_id": 359, "name": "Пуф 31 см", "quantity": 2, "price": 500.00, "ean": 5000},
    {"product_id": 360, "name": "Пуф 45 см", "quantity": 1, "price": 500.00, "ean": 5000},
    {"product_id": 361, "name": "Пуф 35 см", "quantity": 1, "price": 500.00, "ean": 5000},
    {"product_id": 362, "name": "Пуф 45 см", "quantity": 1, "price": 500.00, "ean": 5000},
    {"product_id": 363, "name": "Пуф 35 см", "quantity": 1, "price": 500.00, "ean": 5000},
    {"product_id": 860, "name": "Пуф", "quantity": 1, "price": 500.00, "ean": 5000},
    {"product_id": 2840, "name": "Пуф 45 см", "quantity": 1, "price": 500.00, "ean": 5000},
    {"product_id": 2842, "name": "Пуф 45 см", "quantity": 1, "price": 500.00, "ean": 5000},
    {"product_id": 3009, "name": "Пуф 50*40 см", "quantity": 1, "price": 500.00, "ean": 5000},
    {"product_id": 3048, "name": "Пуф 40*60 см", "quantity": 2, "price": 500.00, "ean": 5000},
    {"product_id": 3050, "name": "Пуф 40*35 см", "quantity": 3, "price": 500.00, "ean": 5000},
    {"product_id": 3054, "name": "Пуф 40*30 см", "quantity": 4, "price": 500.00, "ean": 5000},
    {"product_id": 3055, "name": "Пуф 30*35 см", "quantity": 4, "price": 500.00, "ean": 5000},
    {"product_id": 3063, "name": "Пуф 38*42*42 см", "quantity": 2, "price": 500.00, "ean": 5000},
    {"product_id": 3064, "name": "Пуф 40*40 см", "quantity": 1, "price": 500.00, "ean": 5000},
    {"product_id": 3074, "name": "Пуф 42*36 см", "quantity": 3, "price": 500.00, "ean": 5000},
    {"product_id": 3085, "name": "Пуф 40*62 см", "quantity": 2, "price": 500.00, "ean": 5000},
    {"product_id": 3086, "name": "Пуф 31*43 см", "quantity": 2, "price": 500.00, "ean": 5000},
    {"product_id": 3088, "name": "Пуф 40*80 см", "quantity": 1, "price": 500.00, "ean": 5000},
    {"product_id": 3089, "name": "Пуф 42*36 см", "quantity": 2, "price": 500.00, "ean": 5000},
    {"product_id": 3090, "name": "Пуф 40*35 см", "quantity": 2, "price": 500.00, "ean": 5000},
    {"product_id": 3091, "name": "Пуф 42*40 см", "quantity": 3, "price": 500.00, "ean": 5000},
    {"product_id": 3216, "name": "Пуф 38*35 см", "quantity": 4, "price": 500.00, "ean": 5000},
    {"product_id": 3217, "name": "Пуф 42*42*42 см", "quantity": 2, "price": 500.00, "ean": 5000},
    {"product_id": 3218, "name": "Пуф 38*42*42 см", "quantity": 2, "price": 500.00, "ean": 5000},
    {"product_id": 3220, "name": "Пуф 39*37 см", "quantity": 9, "price": 500.00, "ean": 5000},
    {"product_id": 3221, "name": "Пуф 42*40 см", "quantity": 2, "price": 500.00, "ean": 5000},
    {"product_id": 3222, "name": "Пуф 39*37 см", "quantity": 7, "price": 500.00, "ean": 5000},
    {"product_id": 3226, "name": "Пуф 40*50 см", "quantity": 3, "price": 500.00, "ean": 5000},
    {"product_id": 3233, "name": "Пуф 31*43 см", "quantity": 4, "price": 500.00, "ean": 5000},
    {"product_id": 3817, "name": "Пуф 42*50 см", "quantity": 1, "price": 500.00, "ean": 5000},
    {"product_id": 3875, "name": "Пуф 38*42*42 см", "quantity": 2, "price": 500.00, "ean": 5000},
    {"product_id": 3876, "name": "Пуф 42 см", "quantity": 4, "price": 500.00, "ean": 5000},
    {"product_id": 4299, "name": "Пуф 47*40 см", "quantity": 1, "price": 500.00, "ean": 5000},
    {"product_id": 4739, "name": "Пуф 38*38*46 см", "quantity": 8, "price": 500.00, "ean": 5000},
    {"product_id": 4968, "name": "Пуф 32 см", "quantity": 2, "price": 500.00, "ean": 5000},
    {"product_id": 4969, "name": "Пуф 32 см", "quantity": 2, "price": 500.00, "ean": 5000},
    {"product_id": 5226, "name": "Пуф 39*37 см", "quantity": 15, "price": 500.00, "ean": 5000},
    {"product_id": 5227, "name": "Пуф 40*35*35 см", "quantity": 1, "price": 500.00, "ean": 5000},
    {"product_id": 5243, "name": "Пуф 31*43 см", "quantity": 4, "price": 500.00, "ean": 5000},
    {"product_id": 357, "name": "Пуф 50 см", "quantity": 5, "price": 600.00, "ean": 5000},
    {"product_id": 358, "name": "Пуф 40 см", "quantity": 2, "price": 600.00, "ean": 5000},
    {"product_id": 723, "name": "Пуф 50*40*40 см", "quantity": 4, "price": 600.00, "ean": 5000},
    {"product_id": 2845, "name": "Пуф 40 см", "quantity": 2, "price": 600.00, "ean": 5000},
    {"product_id": 3052, "name": "Пуф 45*35 см", "quantity": 4, "price": 600.00, "ean": 5000},
    {"product_id": 3056, "name": "Пуф 40*45 см", "quantity": 4, "price": 600.00, "ean": 5000},
    {"product_id": 3065, "name": "Пуф 40*80 см", "quantity": 1, "price": 600.00, "ean": 5000},
    {"product_id": 3066, "name": "Пуф 47*40 см", "quantity": 1, "price": 600.00, "ean": 5000},
    {"product_id": 3087, "name": "Пуф 40*59 см", "quantity": 4, "price": 600.00, "ean": 5000},
    {"product_id": 3214, "name": "Пуф 46*60*40 см", "quantity": 2, "price": 600.00, "ean": 5000},
    {"product_id": 3215, "name": "Пуф 40*50*33 см", "quantity": 2, "price": 600.00, "ean": 5000},
    {"product_id": 3224, "name": "Пуф 48*40*40 см", "quantity": 2, "price": 600.00, "ean": 5000},
    {"product_id": 3227, "name": "Пуф 46*58 см", "quantity": 3, "price": 600.00, "ean": 5000},
    {"product_id": 3232, "name": "Пуф 40*49 см", "quantity": 2, "price": 600.00, "ean": 5000},
    {"product_id": 3278, "name": "Пуф 35*60 см", "quantity": 2, "price": 600.00, "ean": 5000},
    {"product_id": 4261, "name": "Пуф 40*49 см", "quantity": 2, "price": 600.00, "ean": 5000},
    {"product_id": 4494, "name": "Пуф 40*80 см", "quantity": 2, "price": 600.00, "ean": 5000},
    {"product_id": 4967, "name": "Пуф 42 см", "quantity": 2, "price": 600.00, "ean": 5000},
    {"product_id": 4970, "name": "Пуф 42 см", "quantity": 2, "price": 600.00, "ean": 5000},
    {"product_id": 4984, "name": "Пуф", "quantity": 4, "price": 600.00, "ean": 5000},
    {"product_id": 5244, "name": "Пуф 40*60 см", "quantity": 4, "price": 600.00, "ean": 5000},
    {"product_id": 5245, "name": "Пуф 35*35*48 см", "quantity": 4, "price": 600.00, "ean": 5000},
    {"product_id": 5246, "name": "Пуф 41*48 см", "quantity": 4, "price": 600.00, "ean": 5000},
    {"product_id": 5197, "name": "Пуф", "quantity": 2, "price": 600.00, "ean": 5500},
    {"product_id": 5181, "name": "Пуф", "quantity": 2, "price": 500.00, "ean": 6000},
    {"product_id": 5182, "name": "Пуф", "quantity": 2, "price": 500.00, "ean": 6000},
    {"product_id": 3231, "name": "Пуф 60*35*35 см", "quantity": 1, "price": 600.00, "ean": 6000},
    {"product_id": 3877, "name": "Пуф 35*60 см", "quantity": 2, "price": 700.00, "ean": 6000},
    {"product_id": 4298, "name": "Кушетка 45*120 см", "quantity": 1, "price": 800.00, "ean": 6000},
    {"product_id": 4677, "name": "Кушетка 80*40*41 см", "quantity": 1, "price": 600.00, "ean": 6400},
    {"product_id": 4673, "name": "Кушетка 80*40*41 см", "quantity": 1, "price": 700.00, "ean": 6500},
    {"product_id": 4925, "name": "Основа під стіл/пуф/люстра (в чорному кольорі) СКЛАД 2 БОРТНИЧІ", "quantity": 12, "price": 1000.00, "ean": 6500},
    {"product_id": 3219, "name": "Пуф 42*135 см", "quantity": 2, "price": 1100.00, "ean": 8000},
    {"product_id": 3062, "name": "Пуф 47*115 см", "quantity": 2, "price": 1100.00, "ean": 8000},
    {"product_id": 4848, "name": "Пуф 60*80 см СКЛАД 2 БОРТНИЧІ", "quantity": 10, "price": 1200.00, "ean": 8000},
]

def compare_with_database():
    """Порівняти дані з файлу переобліку з даними в базі даних"""
    try:
        # Підключення до бази даних OpenCart (джерело даних)
        connection = mysql.connector.connect(
            host=os.getenv('OC_DB_HOST'),
            port=int(os.getenv('OC_DB_PORT', 3306)),
            database=os.getenv('OC_DB_DATABASE'),
            user=os.getenv('OC_DB_USERNAME'),
            password=os.getenv('OC_DB_PASSWORD')
        )
        
        if connection.is_connected():
            cursor = connection.cursor(dictionary=True)
            
            print("=" * 100)
            print("ПОРІВНЯННЯ ДАНИХ З ФАЙЛУ ПЕРЕОБЛІКУ З БАЗОЮ ДАНИХ OPENCART")
            print("=" * 100)
            print()
            
            discrepancies = []
            matched = 0
            
            for audit_item in audit_data:
                product_id = audit_item['product_id']
                
                # Отримати дані з OpenCart бази
                query = """
                    SELECT p.product_id, pd.name, p.quantity, p.price, p.ean 
                    FROM oc_product p
                    LEFT JOIN oc_product_description pd ON p.product_id = pd.product_id AND pd.language_id = 3
                    WHERE p.product_id = %s
                """
                cursor.execute(query, (product_id,))
                db_item = cursor.fetchone()
                
                if not db_item:
                    discrepancies.append({
                        'product_id': product_id,
                        'issue': 'ВІДСУТНІЙ В БД',
                        'audit_data': audit_item,
                        'db_data': None
                    })
                    continue
                
                # Порівняння полів
                issues = []
                
                # Quantity
                if db_item['quantity'] != audit_item['quantity']:
                    issues.append(f"quantity: БД={db_item['quantity']} vs Файл={audit_item['quantity']}")
                
                # Price (округлення до 2 знаків для коректного порівняння)
                db_price = round(float(db_item['price']), 2)
                audit_price = round(float(audit_item['price']), 2)
                if db_price != audit_price:
                    issues.append(f"price: БД={db_price} vs Файл={audit_price}")
                
                # EAN (округлення до цілого для коректного порівняння)
                db_ean = round(float(db_item['ean']))
                audit_ean = int(audit_item['ean'])
                if db_ean != audit_ean:
                    issues.append(f"ean: БД={db_ean} vs Файл={audit_ean}")
                
                if issues:
                    discrepancies.append({
                        'product_id': product_id,
                        'issue': '; '.join(issues),
                        'audit_data': audit_item,
                        'db_data': db_item
                    })
                else:
                    matched += 1
            
            # Виведення результатів
            print(f"Всього записів у файлі переобліку: {len(audit_data)}")
            print(f"Записів співпало повністю: {matched}")
            print(f"Записів з розбіжностями: {len(discrepancies)}")
            print()
            
            if discrepancies:
                print("=" * 100)
                print("ЗНАЙДЕНІ РОЗБІЖНОСТІ:")
                print("=" * 100)
                print()
                
                for i, disc in enumerate(discrepancies, 1):
                    print(f"{i}. Product ID: {disc['product_id']}")
                    print(f"   Проблема: {disc['issue']}")
                    if disc['db_data']:
                        print(f"   БД: quantity={disc['db_data']['quantity']}, price={disc['db_data']['price']}, ean={disc['db_data']['ean']}")
                    print(f"   Файл: quantity={disc['audit_data']['quantity']}, price={disc['audit_data']['price']}, ean={disc['audit_data']['ean']}")
                    print()
            else:
                print("✅ ВСІ ДАНІ СПІВПАДАЮТЬ! Жодних розбіжностей не знайдено.")
            
            cursor.close()
            connection.close()
            
            return discrepancies
            
    except Error as e:
        print(f"❌ Помилка підключення до бази даних: {e}")
        return None

if __name__ == "__main__":
    compare_with_database()
