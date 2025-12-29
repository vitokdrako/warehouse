"""
Order Internal Notes API - Внутрішній месенджер для команди
Нотатки по замовленню, видимі всім департаментам
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/orders", tags=["order-internal-notes"])


class NoteCreate(BaseModel):
    message: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None


class NoteResponse(BaseModel):
    id: int
    order_id: str
    user_id: Optional[str]
    user_name: Optional[str]
    message: str
    created_at: str


@router.get("/{order_id}/internal-notes")
async def get_internal_notes(
    order_id: str,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати всі внутрішні нотатки по замовленню.
    Сортування: від старих до нових (як у чаті)
    """
    try:
        result = db.execute(text("""
            SELECT id, order_id, user_id, user_name, message, created_at
            FROM order_internal_notes
            WHERE order_id = :order_id
            ORDER BY created_at ASC
        """), {"order_id": str(order_id)})
        
        notes = []
        for row in result:
            notes.append({
                "id": row[0],
                "order_id": row[1],
                "user_id": row[2],
                "user_name": row[3] or "Невідомий",
                "message": row[4],
                "created_at": row[5].strftime("%d.%m.%Y %H:%M") if row[5] else ""
            })
        
        return {
            "success": True,
            "notes": notes,
            "count": len(notes)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.post("/{order_id}/internal-notes")
async def add_internal_note(
    order_id: str,
    note: NoteCreate,
    db: Session = Depends(get_rh_db)
):
    """
    Додати внутрішню нотатку до замовлення.
    """
    if not note.message or not note.message.strip():
        raise HTTPException(status_code=400, detail="Повідомлення не може бути порожнім")
    
    try:
        db.execute(text("""
            INSERT INTO order_internal_notes (order_id, user_id, user_name, message, created_at)
            VALUES (:order_id, :user_id, :user_name, :message, NOW())
        """), {
            "order_id": str(order_id),
            "user_id": note.user_id,
            "user_name": note.user_name or "Невідомий",
            "message": note.message.strip()
        })
        db.commit()
        
        # Отримати створену нотатку
        result = db.execute(text("""
            SELECT id, order_id, user_id, user_name, message, created_at
            FROM order_internal_notes
            WHERE order_id = :order_id
            ORDER BY id DESC
            LIMIT 1
        """), {"order_id": str(order_id)})
        
        row = result.fetchone()
        
        return {
            "success": True,
            "note": {
                "id": row[0],
                "order_id": row[1],
                "user_id": row[2],
                "user_name": row[3],
                "message": row[4],
                "created_at": row[5].strftime("%d.%m.%Y %H:%M") if row[5] else ""
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.delete("/{order_id}/internal-notes/{note_id}")
async def delete_internal_note(
    order_id: str,
    note_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Видалити внутрішню нотатку (тільки свою або адмін)
    """
    try:
        db.execute(text("""
            DELETE FROM order_internal_notes
            WHERE id = :note_id AND order_id = :order_id
        """), {"note_id": note_id, "order_id": str(order_id)})
        db.commit()
        
        return {"success": True, "message": "Нотатку видалено"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")
