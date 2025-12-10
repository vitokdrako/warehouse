#!/usr/bin/env python3
"""
Тестування User Tracking Backend
"""
import sys
sys.path.append('/app/backend')

from database_rentalhub import get_rh_db
from sqlalchemy import text
from datetime import datetime, date
import uuid

# Тестові дані
test_user_id = 1  # vitok

def test_order_creation_with_user():
    """Тест створення замовлення з user tracking"""
    db = next(get_rh_db())
    
    try:
        order_number = f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Створити замовлення
        result = db.execute(text("""
            INSERT INTO orders (
                order_number, customer_name, customer_phone, customer_email,
                rental_start_date, rental_end_date, status, total_price, deposit_amount,
                notes, created_by_id, created_at
            ) VALUES (
                :order_number, :customer_name, :customer_phone, :customer_email,
                :rental_start_date, :rental_end_date, 'pending', :total_price, :deposit_amount,
                :notes, :created_by_id, NOW()
            )
        """), {
            "order_number": order_number,
            "customer_name": "Test User Tracking",
            "customer_phone": "+380501234567",
            "customer_email": "test@test.com",
            "rental_start_date": "2025-01-15",
            "rental_end_date": "2025-01-20",
            "total_price": 1000,
            "deposit_amount": 500,
            "notes": "Test order for user tracking",
            "created_by_id": test_user_id
        })
        
        # Отримати ID замовлення
        order_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        db.commit()
        
        # Перевірити created_by_id
        check = db.execute(text("""
            SELECT order_id, order_number, created_by_id, created_at 
            FROM orders 
            WHERE order_id = :order_id
        """), {"order_id": order_id}).fetchone()
        
        print(f"✅ Замовлення створено успішно!")
        print(f"   Order ID: {check[0]}")
        print(f"   Order Number: {check[1]}")
        print(f"   Created By ID: {check[2]}")
        print(f"   Created At: {check[3]}")
        
        return order_id
        
    except Exception as e:
        print(f"❌ Помилка створення замовлення: {e}")
        db.rollback()
        return None

def test_order_update_with_user():
    """Тест оновлення замовлення з user tracking"""
    db = next(get_rh_db())
    
    # Знайти перше тестове замовлення
    result = db.execute(text("""
        SELECT order_id FROM orders 
        WHERE order_number LIKE 'TEST-%' 
        ORDER BY created_at DESC 
        LIMIT 1
    """))
    row = result.fetchone()
    
    if not row:
        print("❌ Тестове замовлення не знайдено")
        return
    
    order_id = row[0]
    
    try:
        # Оновити замовлення
        db.execute(text("""
            UPDATE orders 
            SET customer_name = :name,
                updated_by_id = :updated_by_id,
                updated_at = NOW()
            WHERE order_id = :order_id
        """), {
            "order_id": order_id,
            "name": "Test User Tracking UPDATED",
            "updated_by_id": test_user_id
        })
        
        db.commit()
        
        # Перевірити оновлення
        check = db.execute(text("""
            SELECT order_id, customer_name, updated_by_id, updated_at 
            FROM orders 
            WHERE order_id = :order_id
        """), {"order_id": order_id}).fetchone()
        
        print(f"✅ Замовлення оновлено успішно!")
        print(f"   Order ID: {check[0]}")
        print(f"   Customer Name: {check[1]}")
        print(f"   Updated By ID: {check[2]}")
        print(f"   Updated At: {check[3]}")
        
    except Exception as e:
        print(f"❌ Помилка оновлення замовлення: {e}")
        db.rollback()

def test_issue_card_with_user():
    """Тест створення issue card з user tracking"""
    db = next(get_rh_db())
    
    # Знайти перше тестове замовлення
    result = db.execute(text("""
        SELECT order_id, order_number FROM orders 
        WHERE order_number LIKE 'TEST-%' 
        ORDER BY created_at DESC 
        LIMIT 1
    """))
    row = result.fetchone()
    
    if not row:
        print("❌ Тестове замовлення не знайдено")
        return
    
    order_id, order_number = row[0], row[1]
    
    try:
        card_id = f"issue_{order_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Створити issue card
        db.execute(text("""
            INSERT INTO issue_cards (
                id, order_id, order_number, status, items, 
                created_by_id, created_at, updated_at
            ) VALUES (
                :id, :order_id, :order_number, 'preparation', '[]',
                :created_by_id, NOW(), NOW()
            )
        """), {
            "id": card_id,
            "order_id": order_id,
            "order_number": order_number,
            "created_by_id": test_user_id
        })
        
        db.commit()
        
        # Перевірити
        check = db.execute(text("""
            SELECT id, order_id, created_by_id, status 
            FROM issue_cards 
            WHERE id = :id
        """), {"id": card_id}).fetchone()
        
        print(f"✅ Issue Card створено успішно!")
        print(f"   Card ID: {check[0]}")
        print(f"   Order ID: {check[1]}")
        print(f"   Created By ID: {check[2]}")
        print(f"   Status: {check[3]}")
        
        return card_id
        
    except Exception as e:
        print(f"❌ Помилка створення issue card: {e}")
        db.rollback()
        return None

def test_issue_card_status_update():
    """Тест оновлення статусу issue card (prepared_by_id, issued_by_id)"""
    db = next(get_rh_db())
    
    # Знайти issue card
    result = db.execute(text("""
        SELECT id FROM issue_cards 
        WHERE id LIKE 'issue_%' 
        ORDER BY created_at DESC 
        LIMIT 1
    """))
    row = result.fetchone()
    
    if not row:
        print("❌ Issue card не знайдено")
        return
    
    card_id = row[0]
    
    try:
        # Оновити на 'ready' (підготовлено)
        db.execute(text("""
            UPDATE issue_cards 
            SET status = 'ready',
                prepared_by_id = :user_id,
                prepared_at = NOW(),
                updated_at = NOW()
            WHERE id = :id
        """), {"id": card_id, "user_id": test_user_id})
        
        db.commit()
        
        # Перевірити
        check = db.execute(text("""
            SELECT id, status, prepared_by_id, prepared_at 
            FROM issue_cards 
            WHERE id = :id
        """), {"id": card_id}).fetchone()
        
        print(f"✅ Issue Card оновлено (prepared)!")
        print(f"   Card ID: {check[0]}")
        print(f"   Status: {check[1]}")
        print(f"   Prepared By ID: {check[2]}")
        print(f"   Prepared At: {check[3]}")
        
    except Exception as e:
        print(f"❌ Помилка оновлення issue card: {e}")
        db.rollback()

if __name__ == "__main__":
    print("=" * 60)
    print("ТЕСТУВАННЯ USER TRACKING")
    print("=" * 60)
    print()
    
    print("1. Тест створення замовлення з user tracking")
    print("-" * 60)
    test_order_creation_with_user()
    print()
    
    print("2. Тест оновлення замовлення з user tracking")
    print("-" * 60)
    test_order_update_with_user()
    print()
    
    print("3. Тест створення Issue Card з user tracking")
    print("-" * 60)
    test_issue_card_with_user()
    print()
    
    print("4. Тест оновлення статусу Issue Card")
    print("-" * 60)
    test_issue_card_status_update()
    print()
    
    print("=" * 60)
    print("ТЕСТУВАННЯ ЗАВЕРШЕНО")
    print("=" * 60)
