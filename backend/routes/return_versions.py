"""
Return Versions API - ПРОСТИЙ варіант

Коли підтверджується часткове повернення:
1. Змінити order_number на OC-7293(1)
2. Видалити повернуті товари з order_items
3. Залишити тільки неповернені
4. Статус вже partial_return
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional
import re

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/return-versions", tags=["return-versions"])


class FinalizePartialReturnRequest(BaseModel):
    """Запит на фіналізацію часткового повернення"""
    kept_items: List[dict]  # Товари що ЗАЛИШАЮТЬСЯ у клієнта [{product_id, qty, daily_rate}]


def get_next_version_suffix(db: Session, base_order_number: str) -> str:
    """Отримати наступний суфікс версії (1), (2), (3)..."""
    # Видалити існуючий суфікс якщо є
    base = re.sub(r'\(\d+\)$', '', base_order_number).strip()
    
    # Знайти всі версії
    result = db.execute(text("""
        SELECT order_number FROM orders 
        WHERE order_number LIKE :pattern OR order_number = :base
        ORDER BY order_number DESC
    """), {"pattern": f"{base}(%", "base": base}).fetchall()
    
    max_version = 0
    for row in result:
        match = re.search(r'\((\d+)\)$', row[0])
        if match:
            max_version = max(max_version, int(match.group(1)))
    
    return f"{base}({max_version + 1})"


@router.post("/order/{order_id}/finalize")
async def finalize_partial_return(
    order_id: int,
    data: FinalizePartialReturnRequest,
    db: Session = Depends(get_rh_db)
):
    """
    Фіналізувати часткове повернення:
    - Додати суфікс (1) до order_number
    - Оновити order_items - залишити тільки kept_items
    - Оновити суму замовлення
    """
    try:
        # Отримати замовлення
        order = db.execute(text("""
            SELECT order_id, order_number, status FROM orders WHERE order_id = :id
        """), {"id": order_id}).fetchone()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        current_number = order[1]
        
        # Згенерувати новий номер з суфіксом
        new_order_number = get_next_version_suffix(db, current_number)
        
        # Оновити order_number
        db.execute(text("""
            UPDATE orders SET order_number = :new_number, updated_at = NOW()
            WHERE order_id = :id
        """), {"new_number": new_order_number, "id": order_id})
        
        # Оновити issue_card
        db.execute(text("""
            UPDATE issue_cards SET order_number = :new_number, updated_at = NOW()
            WHERE order_id = :id
        """), {"new_number": new_order_number, "id": order_id})
        
        # Видалити ВСІ старі order_items
        db.execute(text("""
            DELETE FROM order_items WHERE order_id = :id
        """), {"id": order_id})
        
        # Додати тільки kept_items (товари що залишаються)
        total_price = 0
        for item in data.kept_items:
            price = item.get('daily_rate', 0)
            qty = item.get('qty', 0)
            total_price += price * qty
            
            db.execute(text("""
                INSERT INTO order_items (order_id, product_id, quantity, price)
                VALUES (:order_id, :product_id, :qty, :price)
            """), {
                "order_id": order_id,
                "product_id": item.get('product_id'),
                "qty": qty,
                "price": price
            })
        
        # Оновити суму замовлення
        db.execute(text("""
            UPDATE orders SET total_price = :total, updated_at = NOW()
            WHERE order_id = :id
        """), {"total": total_price, "id": order_id})
        
        db.commit()
        
        return {
            "success": True,
            "order_id": order_id,
            "old_order_number": current_number,
            "new_order_number": new_order_number,
            "kept_items_count": len(data.kept_items),
            "total_price": total_price
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ReturnVersions] ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/order/{order_id}/info")
async def get_order_version_info(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """Отримати інформацію про версію замовлення"""
    order = db.execute(text("""
        SELECT order_id, order_number, status, rental_end_date,
               DATEDIFF(CURDATE(), rental_end_date) as days_overdue
        FROM orders WHERE order_id = :id
    """), {"id": order_id}).fetchone()
    
    if not order:
        raise HTTPException(status_code=404, detail="Замовлення не знайдено")
    
    # Перевірити чи є суфікс версії
    has_version_suffix = bool(re.search(r'\(\d+\)$', order[1]))
    
    return {
        "order_id": order[0],
        "order_number": order[1],
        "status": order[2],
        "rental_end_date": str(order[3]) if order[3] else None,
        "days_overdue": max(0, order[4] or 0),
        "has_version_suffix": has_version_suffix
    }
