import pandas as pd
import os

files = {
    'Декоративні свічники 1': '/app/dekor_svichnyky1.xlsx',
    'Декоративні свічники 2': '/app/dekor_svichnyky2.xlsx',
    'Мідні свічники': '/app/midni_svichnyky.xlsx',
    'Золоті свічники': '/app/zoloti_svichnyky.xlsx',
    'Фігури': '/app/figury.xlsx',
}

print("=" * 100)
print("АНАЛІЗ ФАЙЛІВ СВІЧНИКІВ - PRODUCT IDs")
print("=" * 100)

all_ids = {}

for name, filepath in files.items():
    if not os.path.exists(filepath):
        print(f"\n⚠️ Файл не знайдено: {filepath}")
        continue
    
    try:
        df = pd.read_excel(filepath)
        
        # Перевірити, чи є колонка product_id
        if 'product_id' not in df.columns:
            df = pd.read_excel(filepath, skiprows=1)
            headers_df = pd.read_excel(filepath, nrows=1)
            df.columns = headers_df.iloc[0].values
        
        # Отримати список product_id
        ids = df['product_id'].dropna().astype(int).tolist()
        all_ids[name] = set(ids)
        
        print(f"\n{'=' * 100}")
        print(f"{name}:")
        print(f"  Файл: {os.path.basename(filepath)}")
        print(f"  Всього товарів: {len(ids)}")
        print(f"  Product IDs: {sorted(ids)[:20]}")
        if len(ids) > 20:
            print(f"  ... та ще {len(ids) - 20} товарів")
        
    except Exception as e:
        print(f"\n❌ Помилка для {name}: {e}")

# Порівняння файлів
print(f"\n\n{'=' * 100}")
print("ПОРІВНЯННЯ ФАЙЛІВ:")
print("=" * 100)

# Порівняти декоративні свічники 1 і 2
if 'Декоративні свічники 1' in all_ids and 'Декоративні свічники 2' in all_ids:
    ids1 = all_ids['Декоративні свічники 1']
    ids2 = all_ids['Декоративні свічники 2']
    
    common = ids1 & ids2
    only_in_1 = ids1 - ids2
    only_in_2 = ids2 - ids1
    
    print("\n📊 Декоративні свічники 1 vs 2:")
    print(f"  Спільних товарів: {len(common)}")
    print(f"  Тільки в файлі 1: {len(only_in_1)}")
    if only_in_1:
        print(f"    IDs: {sorted(list(only_in_1))[:20]}")
    print(f"  Тільки в файлі 2: {len(only_in_2)}")
    if only_in_2:
        print(f"    IDs: {sorted(list(only_in_2))[:20]}")
    
    if len(common) == len(ids1) == len(ids2):
        print("  ✅ Файли ідентичні!")
    elif only_in_1 or only_in_2:
        print("  ⚠️ Файли містять різні товари!")

# Перевірити перетини між різними типами свічників
print("\n\n📊 Перетини між категоріями:")

categories = ['Мідні свічники', 'Золоті свічники', 'Фігури']
for i, cat1 in enumerate(categories):
    if cat1 not in all_ids:
        continue
    for cat2 in categories[i+1:]:
        if cat2 not in all_ids:
            continue
        
        common = all_ids[cat1] & all_ids[cat2]
        if common:
            print(f"\n  ⚠️ {cat1} ∩ {cat2}: {len(common)} спільних товарів")
            print(f"     IDs: {sorted(list(common))}")

print("\n" + "=" * 100)
