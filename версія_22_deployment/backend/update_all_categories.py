import os
import pandas as pd
import mysql.connector
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

def update_from_excel(excel_file, category_name):
    """Оновити базу даних з Excel файлу"""
    
    try:
        # Завантажити Excel файл
        # Спочатку спробувати прочитати напряму (якщо заголовки вже є)
        df = pd.read_excel(excel_file)
        
        # Перевірити, чи є колонка product_id
        if 'product_id' not in df.columns:
            # Спробувати інший підхід - перший рядок може бути заголовком
            df = pd.read_excel(excel_file, skiprows=1)
            headers_df = pd.read_excel(excel_file, nrows=1)
            df.columns = headers_df.iloc[0].values
        elif df.iloc[0]['product_id'] == 'product_id':
            # Перший рядок містить 'product_id' як значення
            df = pd.read_excel(excel_file, skiprows=1)
            headers_df = pd.read_excel(excel_file, nrows=1)
            df.columns = headers_df.iloc[0].values
        
        print("\n" + "=" * 100)
        print(f"ОНОВЛЕННЯ: {category_name.upper()}")
        print("=" * 100)
        print(f"Файл: {excel_file}")
        print(f"Всього записів: {len(df)}")
        print(f"Час: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
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
            
            # Price може бути відсутнім у колонках (NaN як назва колонки)
            price_col = 'price' if 'price' in row.index else None
            if price_col is None:
                # Спробувати знайти колонку з NaN або float
                for col in row.index:
                    if pd.isna(col) or (isinstance(col, float) and pd.isna(col)):
                        price_col = col
                        break
            
            if price_col and not pd.isna(row[price_col]):
                new_price = float(row[price_col])
            else:
                new_price = float(current_data['price'])
            
            # EAN може бути порожнім рядком або NaN
            if pd.isna(row['ean']) or str(row['ean']).strip() == '':
                new_ean = float(current_data['ean']) if current_data['ean'] and str(current_data['ean']).strip() != '' else 0.0
            else:
                new_ean = float(row['ean'])
            
            # Перевірити, чи є зміни
            price_changed = round(float(current_data['price']), 2) != round(new_price, 2)
            
            # Безпечне порівняння EAN
            try:
                current_ean = float(current_data['ean']) if current_data['ean'] and str(current_data['ean']).strip() != '' else 0.0
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
                    'name': row.get('name(uk-ua)', 'N/A'),
                    'changes': '; '.join(change_details)
                })
                
                updated_count += 1
        
        # Зберегти зміни
        connection.commit()
        
        print(f"\n✅ Оновлено: {updated_count} | Без змін: {skipped_count}")
        
        if changes_log and len(changes_log) <= 10:
            print("\nЗміни:")
            for change in changes_log[:10]:
                print(f"  • {change['product_id']}: {change['changes']}")
        elif changes_log:
            print(f"\nЗмінено {len(changes_log)} записів (детальний звіт у файлі)")
        
        cursor.close()
        connection.close()
        
        return {
            'category': category_name,
            'updated': updated_count,
            'skipped': skipped_count,
            'changes': changes_log
        }
        
    except Exception as e:
        print(f"\n❌ Помилка для {category_name}: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """Оновити всі категорії"""
    
    files = [
        ('/app/products_16.xlsx', 'Products (16)'),
        ('/app/novyi_rik.xlsx', 'Новий рік'),
    ]
    
    print("=" * 100)
    print("МАСОВЕ ОНОВЛЕННЯ ДАНИХ З EXCEL ФАЙЛІВ")
    print("=" * 100)
    print(f"Початок: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Категорій для оновлення: {len(files)}")
    
    results = []
    
    for file_path, category_name in files:
        if os.path.exists(file_path):
            result = update_from_excel(file_path, category_name)
            if result:
                results.append(result)
        else:
            print(f"\n⚠️ Файл не знайдено: {file_path}")
    
    # Підсумковий звіт
    print("\n\n" + "=" * 100)
    print("ПІДСУМКОВИЙ ЗВІТ")
    print("=" * 100)
    
    total_updated = 0
    total_skipped = 0
    
    for result in results:
        total_updated += result['updated']
        total_skipped += result['skipped']
        print(f"\n{result['category']}:")
        print(f"  Оновлено: {result['updated']}")
        print(f"  Без змін: {result['skipped']}")
    
    print(f"\n{'=' * 100}")
    print(f"ВСЬОГО:")
    print(f"  Оновлено записів: {total_updated}")
    print(f"  Без змін: {total_skipped}")
    print(f"  Завершено: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 100)
    
    # Зберегти детальний звіт
    report_file = f"/app/mass_update_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("=" * 100 + "\n")
        f.write("ЗВІТ ПРО МАСОВЕ ОНОВЛЕННЯ ДАНИХ\n")
        f.write("=" * 100 + "\n\n")
        f.write(f"Дата: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Всього оновлено записів: {total_updated}\n")
        f.write(f"Всього без змін: {total_skipped}\n\n")
        
        for result in results:
            f.write("\n" + "=" * 100 + "\n")
            f.write(f"КАТЕГОРІЯ: {result['category']}\n")
            f.write("=" * 100 + "\n")
            f.write(f"Оновлено: {result['updated']}\n")
            f.write(f"Без змін: {result['skipped']}\n\n")
            
            if result['changes']:
                f.write("Детальні зміни:\n")
                for i, change in enumerate(result['changes'], 1):
                    f.write(f"{i}. ID {change['product_id']} - {change['name']}\n")
                    f.write(f"   {change['changes']}\n")
    
    print(f"\n✅ Детальний звіт збережено: {report_file}")
    print("\n✅ МАСОВЕ ОНОВЛЕННЯ ЗАВЕРШЕНО УСПІШНО!\n")

if __name__ == "__main__":
    main()
