import os
import pandas as pd
import mysql.connector
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

def update_database_from_excel():
    """Оновити базу даних з Excel файлу"""
    
    excel_file = "/app/krisla_audit.xlsx"
    
    try:
        # Завантажити Excel файл
        df = pd.read_excel(excel_file, skiprows=1)
        headers_df = pd.read_excel(excel_file, nrows=1)
        df.columns = headers_df.iloc[0].values
        
        print("=" * 100)
        print("ОНОВЛЕННЯ ДАНИХ З ФАЙЛУ КРІСЛА")
        print("=" * 100)
        print(f"Всього записів у файлі: {len(df)}")
        print(f"Час початку: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # Підключення до OpenCart DB
        connection = mysql.connector.connect(
            host=os.getenv('OC_DB_HOST'),
            port=int(os.getenv('OC_DB_PORT', 3306)),
            database=os.getenv('OC_DB_DATABASE'),
            user=os.getenv('OC_DB_USERNAME'),
            password=os.getenv('OC_DB_PASSWORD')
        )
        
        cursor = connection.cursor(dictionary=True)
        
        updated_count = 0
        skipped_count = 0
        changes_log = []
        
        for idx, row in df.iterrows():
            product_id = row['product_id']
            
            if pd.isna(product_id):
                continue
            
            product_id = int(product_id)
            
            # Отримати поточні дані з бази
            cursor.execute("""
                SELECT product_id, quantity, price, ean 
                FROM oc_product 
                WHERE product_id = %s
            """, (product_id,))
            
            current_data = cursor.fetchone()
            
            if not current_data:
                skipped_count += 1
                continue
            
            # Підготувати нові дані
            new_quantity = int(row['quantity']) if not pd.isna(row['quantity']) else current_data['quantity']
            new_price = float(row['price']) if not pd.isna(row['price']) else float(current_data['price'])
            new_ean = float(row['ean']) if not pd.isna(row['ean']) else float(current_data['ean'])
            
            # Перевірити, чи є зміни
            price_changed = round(float(current_data['price']), 2) != round(new_price, 2)
            ean_changed = round(float(current_data['ean'])) != round(new_ean)
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
                    change_details.append(f"quantity: {current_data['quantity']} → {new_quantity}")
                if price_changed:
                    change_details.append(f"price: {current_data['price']} → {new_price}")
                if ean_changed:
                    change_details.append(f"ean: {current_data['ean']} → {new_ean}")
                
                changes_log.append({
                    'product_id': product_id,
                    'name': row.get('name(uk-ua)', 'N/A'),
                    'changes': '; '.join(change_details)
                })
                
                updated_count += 1
            else:
                skipped_count += 1
        
        # Зберегти зміни
        connection.commit()
        
        print("\n" + "=" * 100)
        print("РЕЗУЛЬТАТИ ОНОВЛЕННЯ")
        print("=" * 100)
        print(f"Оновлено записів: {updated_count}")
        print(f"Пропущено (без змін): {skipped_count}")
        print(f"Час завершення: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        if changes_log:
            print("\n" + "=" * 100)
            print("ДЕТАЛЬНИЙ ЗВІТ ПРО ЗМІНИ:")
            print("=" * 100)
            print()
            
            for i, change in enumerate(changes_log, 1):
                print(f"{i}. Product ID: {change['product_id']} - {change['name']}")
                print(f"   Зміни: {change['changes']}")
                print()
        
        # Зберегти звіт у файл
        report_file = f"/app/krisla_update_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("=" * 100 + "\n")
            f.write("ЗВІТ ПРО ОНОВЛЕННЯ ДАНИХ КРІСЕЛ\n")
            f.write("=" * 100 + "\n\n")
            f.write(f"Дата: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Файл джерела: {excel_file}\n")
            f.write(f"Оновлено записів: {updated_count}\n")
            f.write(f"Пропущено (без змін): {skipped_count}\n\n")
            
            if changes_log:
                f.write("=" * 100 + "\n")
                f.write("ДЕТАЛЬНИЙ СПИСОК ЗМІН:\n")
                f.write("=" * 100 + "\n\n")
                
                for i, change in enumerate(changes_log, 1):
                    f.write(f"{i}. Product ID: {change['product_id']} - {change['name']}\n")
                    f.write(f"   Зміни: {change['changes']}\n\n")
        
        print(f"\n✅ Звіт збережено у файл: {report_file}")
        
        cursor.close()
        connection.close()
        
        print("\n✅ ОНОВЛЕННЯ ЗАВЕРШЕНО УСПІШНО!")
        
    except Exception as e:
        print(f"\n❌ Помилка: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    update_database_from_excel()
