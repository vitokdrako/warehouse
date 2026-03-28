import os
import pandas as pd
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

def process_excel_file():
    """Обробити файл Excel з кріслами та порівняти з базою даних"""
    
    # Завантажити Excel файл
    excel_file = "/app/krisla_audit.xlsx"
    
    try:
        # Перший рядок - це заголовки, тому пропускаємо його
        df = pd.read_excel(excel_file, skiprows=1)
        
        # Встановлюємо правильні назви колонок з першого рядка
        headers_df = pd.read_excel(excel_file, nrows=1)
        df.columns = headers_df.iloc[0].values
        
        print("=" * 100)
        print("ЗАВАНТАЖЕНО ФАЙЛ З КРІСЛАМИ")
        print("=" * 100)
        print(f"Всього рядків: {len(df)}")
        print(f"\nКолонки: {list(df.columns)}")
        print("\nПерші 5 рядків:")
        print(df.head())
        print("\n")
        
        # Перевірити, які колонки є в файлі
        print("Доступні колонки для порівняння:")
        for i, col in enumerate(df.columns, 1):
            print(f"{i}. {col}")
        
        return df
        
    except Exception as e:
        print(f"Помилка при читанні файлу: {e}")
        return None

def compare_with_database(df):
    """Порівняти дані з файлу з базою даних"""
    
    try:
        # Підключення до OpenCart DB
        connection = mysql.connector.connect(
            host=os.getenv('OC_DB_HOST'),
            port=int(os.getenv('OC_DB_PORT', 3306)),
            database=os.getenv('OC_DB_DATABASE'),
            user=os.getenv('OC_DB_USERNAME'),
            password=os.getenv('OC_DB_PASSWORD')
        )
        
        cursor = connection.cursor(dictionary=True)
        
        print("\n" + "=" * 100)
        print("ПОРІВНЯННЯ З БАЗОЮ ДАНИХ OPENCART")
        print("=" * 100)
        
        discrepancies = []
        matched = 0
        missing_in_db = 0
        
        # Визначити колонки для порівняння (гнучко)
        id_col = None
        quantity_col = None
        price_col = None
        ean_col = None
        name_col = None
        
        # Знайти правильні колонки
        for col in df.columns:
            col_lower = str(col).lower()
            if 'product_id' in col_lower or col_lower == 'id':
                id_col = col
            elif 'quantity' in col_lower or 'кількість' in col_lower:
                quantity_col = col
            elif 'price' in col_lower or 'ціна' in col_lower or 'price' == col_lower:
                price_col = col
            elif 'ean' in col_lower or 'збиток' in col_lower:
                ean_col = col
            elif 'name' in col_lower or 'назва' in col_lower or 'name(uk-ua)' in col_lower:
                name_col = col
        
        print(f"\nВизначені колонки:")
        print(f"  ID: {id_col}")
        print(f"  Quantity: {quantity_col}")
        print(f"  Price: {price_col}")
        print(f"  EAN: {ean_col}")
        print(f"  Name: {name_col}")
        print()
        
        if not id_col:
            print("❌ Не знайдено колонку з ID продукту!")
            return
        
        for idx, row in df.iterrows():
            product_id = row[id_col]
            
            # Пропустити пусті рядки
            if pd.isna(product_id):
                continue
            
            product_id = int(product_id)
            
            # Отримати дані з бази
            query = """
                SELECT p.product_id, pd.name, p.quantity, p.price, p.ean 
                FROM oc_product p
                LEFT JOIN oc_product_description pd ON p.product_id = pd.product_id AND pd.language_id = 3
                WHERE p.product_id = %s
            """
            cursor.execute(query, (product_id,))
            db_item = cursor.fetchone()
            
            if not db_item:
                missing_in_db += 1
                discrepancies.append({
                    'product_id': product_id,
                    'issue': 'ВІДСУТНІЙ В БД',
                    'file_data': row.to_dict(),
                    'db_data': None
                })
                continue
            
            # Порівняння полів
            issues = []
            
            # Quantity
            if quantity_col and not pd.isna(row[quantity_col]):
                file_quantity = int(row[quantity_col])
                if db_item['quantity'] != file_quantity:
                    issues.append(f"quantity: БД={db_item['quantity']} vs Файл={file_quantity}")
            
            # Price
            if price_col and not pd.isna(row[price_col]):
                db_price = round(float(db_item['price']), 2)
                file_price = round(float(row[price_col]), 2)
                if db_price != file_price:
                    issues.append(f"price: БД={db_price} vs Файл={file_price}")
            
            # EAN
            if ean_col and not pd.isna(row[ean_col]):
                db_ean = round(float(db_item['ean']))
                file_ean = int(row[ean_col])
                if db_ean != file_ean:
                    issues.append(f"ean: БД={db_ean} vs Файл={file_ean}")
            
            if issues:
                discrepancies.append({
                    'product_id': product_id,
                    'issue': '; '.join(issues),
                    'file_data': row.to_dict(),
                    'db_data': db_item
                })
            else:
                matched += 1
        
        # Виведення результатів
        print(f"\nВсього записів у файлі: {len(df)}")
        print(f"Записів співпало повністю: {matched}")
        print(f"Записів відсутніх в БД: {missing_in_db}")
        print(f"Записів з розбіжностями: {len(discrepancies) - missing_in_db}")
        print()
        
        if discrepancies:
            print("=" * 100)
            print("ЗНАЙДЕНІ РОЗБІЖНОСТІ:")
            print("=" * 100)
            print()
            
            for i, disc in enumerate(discrepancies[:20], 1):  # Показати перші 20
                print(f"{i}. Product ID: {disc['product_id']}")
                print(f"   Проблема: {disc['issue']}")
                if disc['db_data']:
                    print(f"   БД: quantity={disc['db_data']['quantity']}, price={disc['db_data']['price']}, ean={disc['db_data']['ean']}")
                    if quantity_col:
                        print(f"   Файл: quantity={disc['file_data'].get(quantity_col, 'N/A')}, price={disc['file_data'].get(price_col, 'N/A')}, ean={disc['file_data'].get(ean_col, 'N/A')}")
                print()
            
            if len(discrepancies) > 20:
                print(f"... та ще {len(discrepancies) - 20} записів з розбіжностями")
        else:
            print("✅ ВСІ ДАНІ СПІВПАДАЮТЬ!")
        
        cursor.close()
        connection.close()
        
        return discrepancies
        
    except Exception as e:
        print(f"❌ Помилка: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    df = process_excel_file()
    if df is not None:
        compare_with_database(df)
