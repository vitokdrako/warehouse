#!/usr/bin/env python3
"""
Синхронізація категорій та підкатегорій з OpenCart в RentalHub
"""
import pymysql
from datetime import datetime

# OpenCart DB
oc_conn = pymysql.connect(
    host='farforre.mysql.tools',
    port=3306,
    user='farforre_db',
    password='gPpAHTvv',
    database='farforre_db',
    cursorclass=pymysql.cursors.DictCursor
)

# RentalHub DB
rh_conn = pymysql.connect(
    host='farforre.mysql.tools',
    port=3306,
    user='farforre_rentalhub',
    password='-nu+3Gp54L',
    database='farforre_rentalhub',
    cursorclass=pymysql.cursors.DictCursor
)

try:
    print("🔄 Починаємо синхронізацію категорій з OpenCart...")
    
    with oc_conn.cursor() as oc_cursor, rh_conn.cursor() as rh_cursor:
        # 1. Отримати всі категорії з OpenCart
        oc_cursor.execute("""
            SELECT c.category_id, c.parent_id, cd.name, c.sort_order
            FROM oc_category c
            JOIN oc_category_description cd ON c.category_id = cd.category_id
            WHERE cd.language_id = 3
            ORDER BY c.parent_id, c.sort_order, cd.name
        """)
        
        oc_categories = oc_cursor.fetchall()
        print(f"📥 Отримано {len(oc_categories)} категорій з OpenCart")
        
        # 2. Очистити існуючі категорії в RentalHub
        rh_cursor.execute("DELETE FROM categories")
        print(f"🗑️  Очищено старі категорії в RentalHub")
        
        # 3. Вставити всі категорії в RentalHub
        inserted = 0
        for cat in oc_categories:
            rh_cursor.execute("""
                INSERT INTO categories (category_id, parent_id, name, sort_order, created_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (
                cat['category_id'],
                cat['parent_id'],
                cat['name'],
                cat['sort_order']
            ))
            inserted += 1
        
        rh_conn.commit()
        print(f"✅ Вставлено {inserted} категорій в RentalHub")
        
        # 4. Статистика
        rh_cursor.execute("SELECT COUNT(*) as count FROM categories WHERE parent_id = 0")
        main_cats = rh_cursor.fetchone()['count']
        
        rh_cursor.execute("SELECT COUNT(*) as count FROM categories WHERE parent_id != 0")
        sub_cats = rh_cursor.fetchone()['count']
        
        print(f"\n📊 Результат:")
        print(f"   Головних категорій: {main_cats}")
        print(f"   Підкатегорій: {sub_cats}")
        print(f"   Всього: {main_cats + sub_cats}")
        
        # 5. Показати приклади
        rh_cursor.execute("""
            SELECT c.name as parent, COUNT(s.category_id) as subcat_count
            FROM categories c
            LEFT JOIN categories s ON c.category_id = s.parent_id
            WHERE c.parent_id = 0
            GROUP BY c.category_id, c.name
            ORDER BY c.name
            LIMIT 10
        """)
        examples = rh_cursor.fetchall()
        print(f"\n📋 Приклади категорій та кількість підкатегорій:")
        for ex in examples:
            print(f"   {ex['parent']}: {ex['subcat_count']} підкатегорій")
        
        print("\n🎉 Синхронізація завершена успішно!")

except Exception as e:
    print(f"❌ Помилка: {e}")
    rh_conn.rollback()
finally:
    oc_conn.close()
    rh_conn.close()
