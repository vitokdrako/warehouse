"""
Скрипт для очищення тестових даних з RentalHub БД
Залишає тільки замовлення зі статусом 'awaiting_customer'
"""
import sys
from database_rentalhub import rh_engine
from sqlalchemy import text

# Use existing engine
engine = rh_engine

print("=" * 60)
print("🧹 ОЧИЩЕННЯ ТЕСТОВИХ ДАНИХ З RENTALHUB БД")
print("=" * 60)

with engine.connect() as conn:
    # Спочатку порахуємо що видалимо
    print("\n📊 Підрахунок даних для видалення...")
    
    # 1. Замовлення (крім awaiting_customer)
    result = conn.execute(text("""
        SELECT COUNT(*) as count, status 
        FROM orders 
        WHERE status != 'awaiting_customer'
        GROUP BY status
    """))
    
    total_orders = 0
    for row in result:
        print(f"   - Замовлення ({row[1]}): {row[0]}")
        total_orders += row[0]
    
    # 2. Фінансові транзакції
    result = conn.execute(text("SELECT COUNT(*) FROM finance_transactions"))
    finance_count = result.fetchone()[0]
    print(f"   - Фінансові транзакції: {finance_count}")
    
    # 3. Пошкодження
    result = conn.execute(text("SELECT COUNT(*) FROM product_damage_history"))
    damage_count = result.fetchone()[0]
    print(f"   - Кейси пошкоджень: {damage_count}")
    
    # 4. Картки видачі
    result = conn.execute(text("SELECT COUNT(*) FROM issue_cards"))
    issue_count = result.fetchone()[0]
    print(f"   - Картки видачі: {issue_count}")
    
    # 5. Позиції замовлень
    result = conn.execute(text("""
        SELECT COUNT(*) FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        WHERE o.status != 'awaiting_customer'
    """))
    items_count = result.fetchone()[0]
    print(f"   - Позиції замовлень: {items_count}")
    
    # 6. Статуси чистки
    result = conn.execute(text("SELECT COUNT(*) FROM product_cleaning_status"))
    cleaning_count = result.fetchone()[0]
    print(f"   - Статуси чистки товарів: {cleaning_count}")
    
    print("\n" + "=" * 60)
    print(f"📝 ПІДСУМОК: буде видалено {total_orders + finance_count + damage_count + issue_count + items_count + cleaning_count} записів")
    print("=" * 60)
    
    # Підтвердження
    print("\n⚠️  Почати видалення? (введіть YES для підтвердження)")
    confirmation = input("> ")
    
    if confirmation != "YES":
        print("❌ Видалення скасовано")
        sys.exit(0)
    
    print("\n🔄 Починаємо очищення...")
    
    # ВИДАЛЕННЯ (в правильному порядку через foreign keys)
    
    # 1. Issue Cards
    if issue_count > 0:
        conn.execute(text("DELETE FROM issue_cards"))
        conn.commit()
        print(f"✅ Видалено {issue_count} карток видачі")
    
    # 2. Order Items (тільки для замовлень що не awaiting_customer)
    if items_count > 0:
        conn.execute(text("""
            DELETE oi FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            WHERE o.status != 'awaiting_customer'
        """))
        conn.commit()
        print(f"✅ Видалено {items_count} позицій замовлень")
    
    # 3. Finance Transactions
    if finance_count > 0:
        conn.execute(text("DELETE FROM finance_transactions"))
        conn.commit()
        print(f"✅ Видалено {finance_count} фінансових транзакцій")
    
    # 4. Product Damage History
    if damage_count > 0:
        conn.execute(text("DELETE FROM product_damage_history"))
        conn.commit()
        print(f"✅ Видалено {damage_count} кейсів пошкоджень")
    
    # 5. Product Cleaning Status
    if cleaning_count > 0:
        conn.execute(text("DELETE FROM product_cleaning_status"))
        conn.commit()
        print(f"✅ Видалено {cleaning_count} статусів чистки")
    
    # 6. Orders (крім awaiting_customer)
    if total_orders > 0:
        conn.execute(text("""
            DELETE FROM orders 
            WHERE status != 'awaiting_customer'
        """))
        conn.commit()
        print(f"✅ Видалено {total_orders} замовлень")
    
    # Перевірка залишку
    result = conn.execute(text("SELECT COUNT(*) FROM orders WHERE status = 'awaiting_customer'"))
    remaining = result.fetchone()[0]
    
    print("\n" + "=" * 60)
    print(f"✨ ОЧИЩЕННЯ ЗАВЕРШЕНО!")
    print(f"📦 Залишилося замовлень (awaiting_customer): {remaining}")
    print("=" * 60)

print("\n🎉 База даних готова до чистого старту!")
