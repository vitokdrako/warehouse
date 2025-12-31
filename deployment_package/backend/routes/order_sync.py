"""
Order Sync API - Синхронізація змін між користувачами
Легкий механізм для оповіщення про зміни в замовленні
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import Optional

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/orders", tags=["order-sync"])


@router.get("/{order_id}/last-modified")
async def get_order_last_modified(
    order_id: str,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати timestamp останньої зміни замовлення.
    Легкий endpoint для polling - повертає тільки timestamp.
    """
    try:
        result = db.execute(text("""
            SELECT updated_at, modified_by 
            FROM orders 
            WHERE order_id = :order_id
        """), {"order_id": str(order_id)})
        
        row = result.fetchone()
        if not row:
            return {"order_id": order_id, "last_modified": None, "modified_by": None}
        
        return {
            "order_id": order_id,
            "last_modified": row[0].isoformat() if row[0] else None,
            "modified_by": row[1]
        }
        
    except Exception as e:
        # Якщо колонки не існують - повертаємо null
        return {"order_id": order_id, "last_modified": None, "modified_by": None}


@router.post("/{order_id}/touch")
async def touch_order(
    order_id: str,
    user_id: Optional[str] = None,
    user_name: Optional[str] = None,
    db: Session = Depends(get_rh_db)
):
    """
    Оновити timestamp замовлення при збереженні.
    Викликається після успішного збереження змін.
    """
    try:
        # Перевіряємо чи існують потрібні колонки
        try:
            db.execute(text("""
                UPDATE orders 
                SET updated_at = NOW(), 
                    modified_by = :modified_by
                WHERE order_id = :order_id
            """), {
                "order_id": str(order_id),
                "modified_by": user_name or user_id or "Невідомий"
            })
            db.commit()
        except:
            # Якщо колонок немає - додаємо їх
            try:
                db.execute(text("""
                    ALTER TABLE orders 
                    ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    ADD COLUMN IF NOT EXISTS modified_by VARCHAR(255)
                """))
                db.commit()
                
                # Повторюємо update
                db.execute(text("""
                    UPDATE orders 
                    SET updated_at = NOW(), 
                        modified_by = :modified_by
                    WHERE order_id = :order_id
                """), {
                    "order_id": str(order_id),
                    "modified_by": user_name or user_id or "Невідомий"
                })
                db.commit()
            except Exception as alter_err:
                print(f"[order_sync] Could not add columns: {alter_err}")
        
        return {
            "success": True,
            "order_id": order_id,
            "touched_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}
