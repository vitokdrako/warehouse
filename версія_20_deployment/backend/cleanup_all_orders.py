"""
Повне очищення ВСІХ замовлень та синхронізація з OpenCart
"""
import sys
from database_rentalhub import rh_engine
from sqlalchemy import text

engine = rh_engine

print("=" * 60)
print("🧹 ПОВНЕ ОЧИЩЕННЯ ВСІХ ЗАМОВЛЕНЬ")
print("=" * 60)

with engine.connect() as conn:
    # Підрахунок
    print("\n📊 Підрахунок всіх даних для видалення...")
    
    result = conn.execute(text("SELECT COUNT(*) FROM orders"))
    orders_count = result.fetchone()[0]
    print(f"   - Замовлення (ВСІ): {orders_count}")
    
    result = conn.execute(text("SELECT COUNT(*) FROM order_items"))
    items_count = result.fetchone()[0]
    print(f"   - Позиції замовлень: {items_count}")
    
    result = conn.execute(text("SELECT COUNT(*) FROM finance_transactions"))
    finance_count = result.fetchone()[0]
    print(f"   - Фінансові транзакції: {finance_count}")
    
    result = conn.execute(text("SELECT COUNT(*) FROM product_damage_history"))
    damage_count = result.fetchone()[0]
    print(f"   - Кейси пошкоджень: {damage_count}")
    
    result = conn.execute(text("SELECT COUNT(*) FROM issue_cards"))
    issue_count = result.fetchone()[0]
    print(f"   - Картки видачі: {issue_count}")
    
    result = conn.execute(text("SELECT COUNT(*) FROM product_cleaning_status"))
    cleaning_count = result.fetchone()[0]
    print(f"   - Статуси чистки: {cleaning_count}")
    
    total = orders_count + items_count + finance_count + damage_count + issue_count + cleaning_count
    
    print("\n" + "=" * 60)
    print(f"📝 ПІДСУМОК: буде видалено {total} записів")
    print("=" * 60)
    
    # Підтвердження
    print("\n⚠️  ВИДАЛИТИ ВСІ ЗАМОВЛЕННЯ? (введіть YES)")
    confirmation = input("> ")
    
    if confirmation != "YES":
        print("❌ Скасовано")
        sys.exit(0)
    
    print("\n🔄 Очищення...")
    
    # Видалення в правильному порядку
    if issue_count > 0:
        conn.execute(text("DELETE FROM issue_cards"))
        conn.commit()
        print(f"✅ Видалено {issue_count} карток видачі")
    
    if items_count > 0:
        conn.execute(text("DELETE FROM order_items"))
        conn.commit()
        print(f"✅ Видалено {items_count} позицій")
    
    if finance_count > 0:
        conn.execute(text("DELETE FROM finance_transactions"))
        conn.commit()
        print(f"✅ Видалено {finance_count} транзакцій")
    
    if damage_count > 0:
        conn.execute(text("DELETE FROM product_damage_history"))
        conn.commit()
        print(f"✅ Видалено {damage_count} пошкоджень")
    
    if cleaning_count > 0:
        conn.execute(text("DELETE FROM product_cleaning_status"))
        conn.commit()
        print(f"✅ Видалено {cleaning_count} статусів чистки")
    
    if orders_count > 0:
        conn.execute(text("DELETE FROM orders"))
        conn.commit()
        print(f"✅ Видалено {orders_count} замовлень")
    
    print("\n" + "=" * 60)
    print("✨ БАЗА ПОВНІСТЮ ОЧИЩЕНА!")
    print("=" * 60)

print("\n🔄 Запуск синхронізації з OpenCart...")
print("=" * 60)

# Імпортуємо і запускаємо sync
try:
    import sys
    import os
    sys.path.insert(0, '/app/backend')
    
    # Запускаємо sync_all.py
    import subprocess
    result = subprocess.run(['python3', '/app/backend/sync_all.py'], 
                          capture_output=True, 
                          text=True,
                          timeout=120)
    
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    
    if result.returncode == 0:
        print("\n✅ Синхронізація завершена успішно!")
    else:
        print(f"\n⚠️ Синхронізація завершилась з кодом {result.returncode}")
        
except Exception as e:
    print(f"⚠️ Помилка синхронізації: {e}")
    print("Запустіть синхронізацію вручну через /sync або:")
    print("   curl -X POST http://localhost:8001/api/sync/run")

print("\n🎉 ГОТОВО! База очищена і синхронізована з OpenCart!")
