import os
import pandas as pd
import mysql.connector
from dotenv import load_dotenv
from datetime import datetime
import numpy as np

load_dotenv()

excel_file = '/app/stelazh.xlsx'

# Завантажити Excel файл
df = pd.read_excel(excel_file)

if 'product_id' not in df.columns:
    df = pd.read_excel(excel_file, skiprows=1)
    headers_df = pd.read_excel(excel_file, nrows=1)
    df.columns = headers_df.iloc[0].values

print("=" * 100)
print("ОНОВЛЕННЯ: СТЕЛАЖІ")
print("=" * 100)
print(f"Всього записів: {len(df)}")

# Знайти колонку з ціною (це NaN)
price_col = None
for col in df.columns:
    if isinstance(col, float) and pd.isna(col):
        price_col = col
        break

print(f"Колонка з ціною: {price_col}")

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
changes_log = []

for idx, row in df.iterrows():
    product_id = int(row['product_id'])
    
    # Отримати поточні дані з бази
    cursor.execute("""
        SELECT product_id, quantity, price, ean 
        FROM oc_product 
        WHERE product_id = %s
    """, (product_id,))
    
    current_data = cursor.fetchone()
    
    if not current_data:
        continue
    
    # Підготувати нові дані
    new_quantity = int(row['quantity']) if not pd.isna(row['quantity']) else current_data['quantity']
    new_price = float(row[price_col]) if price_col and not pd.isna(row[price_col]) else float(current_data['price'])
    
    if pd.isna(row['ean']) or str(row['ean']).strip() == '':
        new_ean = float(current_data['ean']) if current_data['ean'] and str(current_data['ean']).strip() != '' else 0.0
    else:
        new_ean = float(row['ean'])
    
    # Перевірити, чи є зміни
    price_changed = round(float(current_data['price']), 2) != round(new_price, 2)
    
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

print(f"\n✅ Оновлено: {updated_count}")

if changes_log:
    print("\nЗміни:")
    for change in changes_log:
        print(f"  • {change['product_id']}: {change['changes']}")

cursor.close()
connection.close()

print("\n✅ ГОТОВО!")
