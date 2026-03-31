import os
import mysql.connector
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

# Дані зі скатертин з Google Sheets
skatertyny_data = [
    {"product_id": 2818, "quantity": 12, "price": 1110.00, "ean": 5750},
    {"product_id": 2866, "quantity": 20, "price": 850.00, "ean": 5750},
    {"product_id": 2917, "quantity": 4, "price": 850.00, "ean": 5750},
    {"product_id": 3407, "quantity": 12, "price": 850.00, "ean": 5750},
    {"product_id": 3417, "quantity": 11, "price": 850.00, "ean": 5750},
    {"product_id": 3432, "quantity": 4, "price": 850.00, "ean": 5750},
    {"product_id": 2920, "quantity": 1, "price": 1380.00, "ean": 5750},
    {"product_id": 2921, "quantity": 9, "price": 1110.00, "ean": 8050},
    {"product_id": 3406, "quantity": 10, "price": 1110.00, "ean": 5750},
    {"product_id": 3438, "quantity": 2, "price": 850.00, "ean": 4600},
    {"product_id": 3418, "quantity": 8, "price": 1000.00, "ean": 0},
    {"product_id": 3443, "quantity": 1, "price": 850.00, "ean": 5750},
    {"product_id": 3416, "quantity": 7, "price": 1110.00, "ean": 0},
    {"product_id": 3462, "quantity": 9, "price": 850.00, "ean": 5750},
    {"product_id": 5208, "quantity": 1, "price": 1000.00, "ean": 0},
    {"product_id": 3420, "quantity": 1, "price": 2400.00, "ean": 0},
    {"product_id": 3422, "quantity": 2, "price": 140.00, "ean": 2300},
    {"product_id": 3423, "quantity": 1, "price": 1380.00, "ean": 0},
    {"product_id": 3424, "quantity": 1, "price": 1110.00, "ean": 0},
    {"product_id": 3995, "quantity": 1, "price": 850.00, "ean": 4030},
    {"product_id": 4639, "quantity": 11, "price": 850.00, "ean": 3450},
    {"product_id": 3427, "quantity": 1, "price": 2400.00, "ean": 0},
    {"product_id": 4602, "quantity": 12, "price": 1000.00, "ean": 0},
    {"product_id": 3429, "quantity": 4, "price": 1660.00, "ean": 8050},
    {"product_id": 5725, "quantity": 4, "price": 1000.00, "ean": 0},
    {"product_id": 4758, "quantity": 5, "price": 850.00, "ean": 1730},
    {"product_id": 8574, "quantity": 2, "price": 850.00, "ean": 4600},
    {"product_id": 3433, "quantity": 12, "price": 1110.00, "ean": 0},
    {"product_id": 3434, "quantity": 3, "price": 2070.00, "ean": 6900},
    {"product_id": 3435, "quantity": 1, "price": 1250.00, "ean": 4600},
    {"product_id": 3436, "quantity": 4, "price": 1110.00, "ean": 5750},
    {"product_id": 3437, "quantity": 1, "price": 1380.00, "ean": 4600},
    {"product_id": 8575, "quantity": 1, "price": 850.00, "ean": 4600},
    {"product_id": 3439, "quantity": 1, "price": 830.00, "ean": 0},
    {"product_id": 8576, "quantity": 1, "price": 850.00, "ean": 4600},
    {"product_id": 3441, "quantity": 16, "price": 1110.00, "ean": 4600},
    {"product_id": 8577, "quantity": 2, "price": 850.00, "ean": 4600},
    {"product_id": 2865, "quantity": 1, "price": 970.00, "ean": 8050},
    {"product_id": 3444, "quantity": 3, "price": 1110.00, "ean": 8050},
    {"product_id": 8567, "quantity": 10, "price": 1000.00, "ean": 0},
    {"product_id": 3446, "quantity": 1, "price": 1110.00, "ean": 6900},
    {"product_id": 3447, "quantity": 13, "price": 140.00, "ean": 1150},
    {"product_id": 3450, "quantity": 1, "price": 2070.00, "ean": 11500},
    {"product_id": 3451, "quantity": 1, "price": 1660.00, "ean": 9200},
    {"product_id": 3452, "quantity": 1, "price": 1660.00, "ean": 9200},
    {"product_id": 3453, "quantity": 1, "price": 2760.00, "ean": 17250},
    {"product_id": 3459, "quantity": 4, "price": 1660.00, "ean": 9200},
    {"product_id": 3460, "quantity": 13, "price": 1110.00, "ean": 8050},
    {"product_id": 2918, "quantity": 2, "price": 1110.00, "ean": 5750},
    {"product_id": 3827, "quantity": 1, "price": 1110.00, "ean": 4600},
    {"product_id": 3440, "quantity": 2, "price": 1110.00, "ean": 2300},
    {"product_id": 4262, "quantity": 4, "price": 1110.00, "ean": 8050},
    {"product_id": 3442, "quantity": 2, "price": 1110.00, "ean": 4600},
    {"product_id": 3445, "quantity": 9, "price": 1000.00, "ean": 8050},
    {"product_id": 7500, "quantity": 14, "price": 1110.00, "ean": 6900},
    {"product_id": 4271, "quantity": 7, "price": 1000.00, "ean": 8050},
    {"product_id": 5207, "quantity": 9, "price": 1000.00, "ean": 5750},
    {"product_id": 8568, "quantity": 10, "price": 1110.00, "ean": 3450},
    {"product_id": 8569, "quantity": 6, "price": 1110.00, "ean": 3450},
    {"product_id": 8570, "quantity": 1, "price": 1110.00, "ean": 3450},
    {"product_id": 8571, "quantity": 12, "price": 1110.00, "ean": 5750},
    {"product_id": 5206, "quantity": 10, "price": 1110.00, "ean": 0},
    {"product_id": 6691, "quantity": 8, "price": 1000.00, "ean": 5750},
    {"product_id": 6694, "quantity": 10, "price": 1000.00, "ean": 5750},
    {"product_id": 5403, "quantity": 8, "price": 1110.00, "ean": 3450},
    {"product_id": 5405, "quantity": 1, "price": 2760.00, "ean": 5750},
    {"product_id": 5460, "quantity": 26, "price": 1660.00, "ean": 2300},
    {"product_id": 5516, "quantity": 1, "price": 2300.00, "ean": 0},
    {"product_id": 5571, "quantity": 2, "price": 1660.00, "ean": 5750},
    {"product_id": 6794, "quantity": 1, "price": 1000.00, "ean": 3450},
    {"product_id": 5673, "quantity": 4, "price": 1380.00, "ean": 6900},
    {"product_id": 5711, "quantity": 1, "price": 700.00, "ean": 0},
    {"product_id": 5712, "quantity": 1, "price": 1380.00, "ean": 4600},
    {"product_id": 8223, "quantity": 2, "price": 1610.00, "ean": 5180},
    {"product_id": 5835, "quantity": 7, "price": 1380.00, "ean": 4600},
    {"product_id": 5872, "quantity": 7, "price": 1110.00, "ean": 4600},
    {"product_id": 5894, "quantity": 2, "price": 2880.00, "ean": 6900},
    {"product_id": 6689, "quantity": 6, "price": 1110.00, "ean": 5750},
    {"product_id": 6690, "quantity": 9, "price": 1110.00, "ean": 5750},
    {"product_id": 4603, "quantity": 8, "price": 1660.00, "ean": 0},
    {"product_id": 3428, "quantity": 3, "price": 1660.00, "ean": 0},
    {"product_id": 6692, "quantity": 3, "price": 1660.00, "ean": 9200},
    {"product_id": 3408, "quantity": 4, "price": 1700.00, "ean": 0},
    {"product_id": 6695, "quantity": 7, "price": 1110.00, "ean": 0},
    {"product_id": 6696, "quantity": 1, "price": 1660.00, "ean": 6900},
    {"product_id": 3430, "quantity": 1, "price": 2100.00, "ean": 11500},
    {"product_id": 2919, "quantity": 4, "price": 1380.00, "ean": 5750},
    {"product_id": 4638, "quantity": 7, "price": 1380.00, "ean": 3450},
    {"product_id": 7738, "quantity": 1, "price": 810.00, "ean": 4600},
    {"product_id": 5665, "quantity": 1, "price": 3000.00, "ean": 11500},
    {"product_id": 6693, "quantity": 1, "price": 3500.00, "ean": 0},
    {"product_id": 3425, "quantity": 1, "price": 1660.00, "ean": 8050},
    {"product_id": 3426, "quantity": 1, "price": 1660.00, "ean": 9200},
    {"product_id": 4636, "quantity": 8, "price": 1660.00, "ean": 4600},
    {"product_id": 3409, "quantity": 1, "price": 2070.00, "ean": 11500},
    {"product_id": 3431, "quantity": 1, "price": 2070.00, "ean": 0},
    {"product_id": 4270, "quantity": 1, "price": 2070.00, "ean": 8050},
    {"product_id": 4567, "quantity": 1, "price": 2070.00, "ean": 8050},
    {"product_id": 7499, "quantity": 11, "price": 2070.00, "ean": 8050},
]

def update_skatertyny():
    """Оновити дані скатертин з Google Sheets"""
    
    try:
        connection = mysql.connector.connect(
            host=os.getenv('OC_DB_HOST'),
            port=int(os.getenv('OC_DB_PORT', 3306)),
            database=os.getenv('OC_DB_DATABASE'),
            user=os.getenv('OC_DB_USERNAME'),
            password=os.getenv('OC_DB_PASSWORD')
        )
        
        cursor = connection.cursor(dictionary=True)
        
        print("=" * 100)
        print("ОНОВЛЕННЯ СКАТЕРТИН З GOOGLE SHEETS")
        print("=" * 100)
        print(f"Всього записів: {len(skatertyny_data)}")
        print(f"Час: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        updated_count = 0
        changes_log = []
        
        for item in skatertyny_data:
            product_id = item['product_id']
            
            # Отримати поточні дані
            cursor.execute("""
                SELECT product_id, quantity, price, ean 
                FROM oc_product 
                WHERE product_id = %s
            """, (product_id,))
            
            current_data = cursor.fetchone()
            
            if not current_data:
                continue
            
            # Підготувати нові дані
            new_quantity = item['quantity']
            new_price = float(item['price'])
            new_ean = float(item['ean']) if item['ean'] else 0.0
            
            # Перевірити зміни
            price_changed = round(float(current_data['price']), 2) != round(new_price, 2)
            
            try:
                current_ean = float(current_data['ean']) if current_data['ean'] else 0.0
                ean_changed = round(current_ean) != round(new_ean)
            except (ValueError, TypeError):
                ean_changed = False
            
            quantity_changed = current_data['quantity'] != new_quantity
            
            if price_changed or ean_changed or quantity_changed:
                # Оновити дані
                update_query = """
                    UPDATE oc_product 
                    SET quantity = %s, price = %s, ean = %s, date_modified = NOW()
                    WHERE product_id = %s
                """
                
                cursor.execute(update_query, (new_quantity, new_price, new_ean, product_id))
                
                # Логувати зміни
                change_details = []
                if quantity_changed:
                    change_details.append(f"qty: {current_data['quantity']}→{new_quantity}")
                if price_changed:
                    change_details.append(f"price: {current_data['price']}→{new_price}")
                if ean_changed:
                    change_details.append(f"ean: {current_data['ean']}→{new_ean}")
                
                changes_log.append({
                    'product_id': product_id,
                    'changes': '; '.join(change_details)
                })
                
                updated_count += 1
        
        # Зберегти зміни
        connection.commit()
        
        print(f"\n✅ Оновлено: {updated_count}")
        
        if changes_log and len(changes_log) <= 20:
            print("\nЗміни:")
            for change in changes_log:
                print(f"  • {change['product_id']}: {change['changes']}")
        elif changes_log:
            print(f"\nЗмінено {len(changes_log)} записів")
        
        cursor.close()
        connection.close()
        
        print("\n✅ ОНОВЛЕННЯ СКАТЕРТИН ЗАВЕРШЕНО!")
        
    except Exception as e:
        print(f"❌ Помилка: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    update_skatertyny()
