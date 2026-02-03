"""
Return Versions API - Створення версії часткового повернення

При підтвердженні часткового повернення:
1. Оригінальне OC-7293 → статус 'returned' → архів (всі товари залишаються)
2. Створюється НОВЕ замовлення OC-7293(1) з неповерненими товарами
3. Нове замовлення має статус 'partial_return'
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from pydantic import BaseModel
from typing import List
import re

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/return-versions", tags=["return-versions"])


class CreateVersionRequest(BaseModel):
    """Товари що НЕ повернулись - підуть в нову версію"""
    not_returned_items: List[dict]  # [{product_id, sku, name, qty, daily_rate}]


def get_next_version_number(db: Session, base_order_number: str) -> str:
    """Отримати номер для нової версії: OC-7293 → OC-7293(1)"""
    # Видалити існуючий суфікс
    base = re.sub(r'\(\d+\)$', '', base_order_number).strip()
    
    # Знайти максимальну версію
    result = db.execute(text("""
        SELECT order_number FROM orders 
        WHERE order_number LIKE :pattern
    """), {"pattern": f"{base}(%"}).fetchall()
    
    max_v = 0
    for row in result:
        match = re.search(r'\((\d+)\)$', row[0])
        if match:
            max_v = max(max_v, int(match.group(1)))
    
    return f"{base}({max_v + 1})"


@router.post("/order/{order_id}/create-version")
async def create_partial_return_version(
    order_id: int,
    data: CreateVersionRequest,
    db: Session = Depends(get_rh_db)
):
    """
    Створити версію часткового повернення:
    1. Закрити оригінальне замовлення (returned)
    2. Створити нове з неповерненими товарами (partial_return)
    """
    try:
        # Отримати оригінальне замовлення
        parent = db.execute(text("""
            SELECT order_id, order_number, customer_name, customer_phone, customer_email,
                   rental_start_date, rental_end_date, deposit_amount, source
            FROM orders WHERE order_id = :id
        """), {"id": order_id}).fetchone()
        
        if not parent:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        # Генеруємо номер версії
        new_order_number = get_next_version_number(db, parent[1])
        
        # Рахуємо суму нового замовлення
        total = sum(item.get('qty', 0) * item.get('daily_rate', 0) for item in data.not_returned_items)
        
        # === 1. Закриваємо оригінальне замовлення ===
        db.execute(text("""
            UPDATE orders 
            SET status = 'returned', updated_at = NOW()
            WHERE order_id = :id
        """), {"id": order_id})
        
        db.execute(text("""
            UPDATE issue_cards 
            SET status = 'returned', updated_at = NOW()
            WHERE order_id = :id
        """), {"id": order_id})
        
        # === 2. Створюємо НОВЕ замовлення з неповерненими товарами ===
        result = db.execute(text("""
            INSERT INTO orders (
                order_number, customer_name, customer_phone, customer_email,
                rental_start_date, rental_end_date,
                total_price, deposit_amount,
                status, source,
                created_at, updated_at
            ) VALUES (
                :order_number, :name, :phone, :email,
                CURDATE(), :end_date,
                :total, 0,
                'partial_return', :source,
                NOW(), NOW()
            )
        """), {
            "order_number": new_order_number,
            "name": parent[2],
            "phone": parent[3],
            "email": parent[4],
            "end_date": parent[6],
            "total": total,
            "source": parent[8] or 'rentalhub'
        })
        
        new_order_id = result.lastrowid
        if not new_order_id:
            new_order_id = db.execute(text("SELECT MAX(order_id) FROM orders")).scalar()
        
        # === 3. Додаємо товари до нового замовлення ===
        for item in data.not_returned_items:
            db.execute(text("""
                INSERT INTO order_items (order_id, product_id, quantity, price)
                VALUES (:order_id, :product_id, :qty, :price)
            """), {
                "order_id": new_order_id,
                "product_id": item.get('product_id'),
                "qty": item.get('qty'),
                "price": item.get('daily_rate', 0)
            })
        
        # === 4. Створюємо issue_card для нового замовлення ===
        db.execute(text("""
            INSERT INTO issue_cards (order_id, order_number, status, created_at, updated_at)
            VALUES (:order_id, :order_number, 'partial_return', NOW(), NOW())
        """), {
            "order_id": new_order_id,
            "order_number": new_order_number
        })
        
        db.commit()
        
        return {
            "success": True,
            "original_order_id": order_id,
            "original_order_number": parent[1],
            "original_status": "returned",
            "new_order_id": new_order_id,
            "new_order_number": new_order_number,
            "new_status": "partial_return",
            "items_count": len(data.not_returned_items),
            "total_price": total,
            "redirect_url": f"/return/{new_order_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ReturnVersions] ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
