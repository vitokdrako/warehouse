"""
Laundry Management Routes - Управління Хімчисткою Текстилю
Відстеження текстилю відправленого в хімчистку
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, date
import uuid
import json

from database_rentalhub import get_rh_db
from utils.user_tracking_helper import get_current_user_dependency

router = APIRouter(prefix="/api/laundry", tags=["laundry"])

# ==================== Pydantic Models ====================

class LaundryItemCreate(BaseModel):
    product_id: int
    product_name: str
    sku: str
    category: str
    quantity: int
    condition_before: Optional[str] = "dirty"
    photo_before: Optional[str] = None
    notes: Optional[str] = None

class LaundryBatchCreate(BaseModel):
    laundry_company: str
    expected_return_date: str
    items: List[LaundryItemCreate]
    cost: Optional[float] = None
    notes: Optional[str] = None

class LaundryBatchUpdate(BaseModel):
    status: Optional[str] = None
    actual_return_date: Optional[str] = None
    received_by_id: Optional[int] = None
    received_by_name: Optional[str] = None
    notes: Optional[str] = None

class LaundryItemReturn(BaseModel):
    item_id: str
    returned_quantity: int
    condition_after: str
    photo_after: Optional[str] = None
    notes: Optional[str] = None

# ==================== Helper Functions ====================

def parse_batch(row):
    """Parse laundry batch row"""
    return {
        "id": row[0],
        "batch_number": row[1],
        "status": row[2],
        "laundry_company": row[3],
        "sent_date": row[4].isoformat() if row[4] else None,
        "expected_return_date": row[5].isoformat() if row[5] else None,
        "actual_return_date": row[6].isoformat() if row[6] else None,
        "total_items": row[7],
        "returned_items": row[8],
        "cost": float(row[9]) if row[9] else 0.0,
        "notes": row[10],
        "sent_by_id": row[11],
        "sent_by_name": row[12],
        "received_by_id": row[13],
        "received_by_name": row[14],
        "created_at": row[15].isoformat() if row[15] else None,
        "updated_at": row[16].isoformat() if row[16] else None
    }

def parse_item(row):
    """Parse laundry item row"""
    return {
        "id": row[0],
        "batch_id": row[1],
        "product_id": row[2],
        "product_name": row[3],
        "sku": row[4],
        "category": row[5],
        "quantity": row[6],
        "returned_quantity": row[7] if row[7] else 0,
        "condition_before": row[8],
        "condition_after": row[9],
        "photo_before": row[10],
        "photo_after": row[11],
        "notes": row[12],
        "created_at": row[13].isoformat() if row[13] else None
    }

# ==================== Batch Endpoints ====================

@router.get("/batches")
async def get_laundry_batches(
    status: Optional[str] = None,
    laundry_company: Optional[str] = None,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати список партій
    Status: sent, partial_return, returned, completed
    """
    sql = "SELECT * FROM laundry_batches WHERE 1=1"
    params = {}
    
    if status:
        sql += " AND status = :status"
        params['status'] = status
    if laundry_company:
        sql += " AND laundry_company = :company"
        params['company'] = laundry_company
    
    sql += " ORDER BY sent_date DESC"
    
    result = db.execute(text(sql), params)
    batches = [parse_batch(row) for row in result]
    
    # Додати інформацію про товари для кожної партії
    for batch in batches:
        items_result = db.execute(
            text("SELECT * FROM laundry_items WHERE batch_id = :batch_id"),
            {"batch_id": batch["id"]}
        )
        batch["items"] = [parse_item(row) for row in items_result]
    
    return batches

@router.get("/batches/{batch_id}")
async def get_laundry_batch(
    batch_id: str,
    db: Session = Depends(get_rh_db)
):
    """Отримати деталі партії"""
    result = db.execute(
        text("SELECT * FROM laundry_batches WHERE id = :id"),
        {"id": batch_id}
    )
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Партію не знайдено")
    
    batch = parse_batch(row)
    
    # Отримати товари в партії
    items_result = db.execute(
        text("SELECT * FROM laundry_items WHERE batch_id = :batch_id"),
        {"batch_id": batch_id}
    )
    batch["items"] = [parse_item(row) for row in items_result]
    
    return batch

@router.post("/batches")
async def create_laundry_batch(
    batch_data: LaundryBatchCreate,
    current_user: dict = Depends(get_current_user_dependency),
    db: Session = Depends(get_rh_db)
):
    """
    Створити нову партію відправлення в хімчистку
    Автоматично "заморожує" кількість товарів на складі
    """
    try:
        batch_id = str(uuid.uuid4())
        
        # Генерувати номер партії
        result = db.execute(text("SELECT COUNT(*) as count FROM laundry_batches"))
        count = result.fetchone()[0]
        batch_number = f"LAUNDRY-{count + 1:05d}"
        
        total_items = sum(item.quantity for item in batch_data.items)
        
        # Створити партію
        db.execute(text("""
            INSERT INTO laundry_batches (
                id, batch_number, status, laundry_company,
                sent_date, expected_return_date, total_items, returned_items,
                cost, notes, sent_by_id, sent_by_name, created_at, updated_at
            ) VALUES (
                :id, :batch_number, 'sent', :company,
                :sent_date, :expected_date, :total_items, 0,
                :cost, :notes, :user_id, :user_name, NOW(), NOW()
            )
        """), {
            "id": batch_id,
            "batch_number": batch_number,
            "company": batch_data.laundry_company,
            "sent_date": date.today(),
            "expected_date": batch_data.expected_return_date,
            "total_items": total_items,
            "cost": batch_data.cost or 0.0,
            "notes": batch_data.notes,
            "user_id": current_user["id"],
            "user_name": current_user["name"]
        })
        
        # Додати товари до партії
        for item in batch_data.items:
            item_id = str(uuid.uuid4())
            
            db.execute(text("""
                INSERT INTO laundry_items (
                    id, batch_id, product_id, product_name, sku, category,
                    quantity, returned_quantity, condition_before, photo_before,
                    notes, created_at
                ) VALUES (
                    :id, :batch_id, :product_id, :product_name, :sku, :category,
                    :quantity, 0, :condition, :photo, :notes, NOW()
                )
            """), {
                "id": item_id,
                "batch_id": batch_id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "sku": item.sku,
                "category": item.category,
                "quantity": item.quantity,
                "condition": item.condition_before,
                "photo": item.photo_before,
                "notes": item.notes
            })
            
            # "Заморожування" кількості на складі
            # Зменшуємо available_quantity, але не зменшуємо total_quantity
            db.execute(text("""
                UPDATE products 
                SET quantity = GREATEST(0, quantity - :qty)
                WHERE product_id = :product_id
            """), {
                "qty": item.quantity,
                "product_id": item.product_id
            })
        
        db.commit()
        
        return {
            "id": batch_id,
            "batch_number": batch_number,
            "message": f"Партію {batch_number} створено. Відправлено {total_items} од. текстилю."
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка створення партії: {str(e)}")

@router.put("/batches/{batch_id}")
async def update_laundry_batch(
    batch_id: str,
    updates: LaundryBatchUpdate,
    db: Session = Depends(get_rh_db)
):
    """Оновити інформацію про партію"""
    result = db.execute(
        text("SELECT id FROM laundry_batches WHERE id = :id"),
        {"id": batch_id}
    )
    
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Партію не знайдено")
    
    set_clauses = []
    params = {"id": batch_id}
    
    if updates.status is not None:
        set_clauses.append("status = :status")
        params['status'] = updates.status
    if updates.actual_return_date is not None:
        set_clauses.append("actual_return_date = :return_date")
        params['return_date'] = updates.actual_return_date
    if updates.received_by_id is not None:
        set_clauses.append("received_by_id = :received_by_id")
        params['received_by_id'] = updates.received_by_id
    if updates.received_by_name is not None:
        set_clauses.append("received_by_name = :received_by_name")
        params['received_by_name'] = updates.received_by_name
    if updates.notes is not None:
        set_clauses.append("notes = :notes")
        params['notes'] = updates.notes
    
    if set_clauses:
        set_clauses.append("updated_at = NOW()")
        sql = f"UPDATE laundry_batches SET {', '.join(set_clauses)} WHERE id = :id"
        db.execute(text(sql), params)
        db.commit()
    
    return {"message": "Партію оновлено"}

@router.post("/batches/{batch_id}/return-items")
async def return_laundry_items(
    batch_id: str,
    items: List[LaundryItemReturn],
    current_user: dict = Depends(get_current_user_dependency),
    db: Session = Depends(get_rh_db)
):
    """
    Прийняти повернення товарів з хімчистки (часткове або повне)
    Автоматично повертає товари на склад
    """
    try:
        # Перевірити чи існує партія
        batch_result = db.execute(
            text("SELECT * FROM laundry_batches WHERE id = :id"),
            {"id": batch_id}
        )
        batch_row = batch_result.fetchone()
        
        if not batch_row:
            raise HTTPException(status_code=404, detail="Партію не знайдено")
        
        batch = parse_batch(batch_row)
        
        total_returned = 0
        
        for item_return in items:
            # Оновити інформацію про повернення товару
            db.execute(text("""
                UPDATE laundry_items
                SET 
                    returned_quantity = returned_quantity + :qty,
                    condition_after = :condition,
                    photo_after = :photo,
                    notes = CONCAT(COALESCE(notes, ''), '\n', COALESCE(:notes, ''))
                WHERE id = :item_id
            """), {
                "item_id": item_return.item_id,
                "qty": item_return.returned_quantity,
                "condition": item_return.condition_after,
                "photo": item_return.photo_after,
                "notes": item_return.notes or ""
            })
            
            # Отримати інформацію про товар
            item_result = db.execute(
                text("SELECT * FROM laundry_items WHERE id = :id"),
                {"id": item_return.item_id}
            )
            item_row = item_result.fetchone()
            item = parse_item(item_row)
            
            # Повернути товар на склад (розморозити)
            db.execute(text("""
                UPDATE products 
                SET quantity = quantity + :qty
                WHERE product_id = :product_id
            """), {
                "qty": item_return.returned_quantity,
                "product_id": item["product_id"]
            })
            
            total_returned += item_return.returned_quantity
        
        # Оновити загальну кількість повернених товарів у партії
        db.execute(text("""
            UPDATE laundry_batches
            SET 
                returned_items = returned_items + :qty,
                status = CASE 
                    WHEN returned_items + :qty >= total_items THEN 'returned'
                    ELSE 'partial_return'
                END,
                received_by_id = :user_id,
                received_by_name = :user_name,
                actual_return_date = CASE 
                    WHEN actual_return_date IS NULL THEN :today
                    ELSE actual_return_date
                END,
                updated_at = NOW()
            WHERE id = :batch_id
        """), {
            "batch_id": batch_id,
            "qty": total_returned,
            "user_id": current_user["id"],
            "user_name": current_user["name"],
            "today": date.today()
        })
        
        db.commit()
        
        return {
            "message": f"Прийнято {total_returned} од. текстилю",
            "returned_items": total_returned,
            "batch_status": "returned" if (batch["returned_items"] + total_returned) >= batch["total_items"] else "partial_return"
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка прийому товарів: {str(e)}")

@router.post("/batches/{batch_id}/complete")
async def complete_laundry_batch(
    batch_id: str,
    db: Session = Depends(get_rh_db)
):
    """Закрити партію (всі товари повернуті та перевірені)"""
    db.execute(text("""
        UPDATE laundry_batches
        SET status = 'completed', updated_at = NOW()
        WHERE id = :id
    """), {"id": batch_id})
    
    db.commit()
    return {"message": "Партію закрито"}

@router.delete("/batches/{batch_id}")
async def delete_laundry_batch(
    batch_id: str,
    db: Session = Depends(get_rh_db)
):
    """
    Видалити партію (тільки якщо статус 'sent' і не було повернень)
    Автоматично розморозити товари
    """
    try:
        # Перевірити статус партії
        result = db.execute(
            text("SELECT status, returned_items FROM laundry_batches WHERE id = :id"),
            {"id": batch_id}
        )
        row = result.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="Партію не знайдено")
        
        if row[0] != 'sent' or row[1] > 0:
            raise HTTPException(
                status_code=400,
                detail="Можна видалити тільки партії зі статусом 'sent' без повернень"
            )
        
        # Отримати товари партії
        items_result = db.execute(
            text("SELECT product_id, quantity FROM laundry_items WHERE batch_id = :batch_id"),
            {"batch_id": batch_id}
        )
        
        # Повернути товари на склад
        for item_row in items_result:
            db.execute(text("""
                UPDATE products
                SET quantity = quantity + :qty
                WHERE product_id = :product_id
            """), {
                "qty": item_row[1],
                "product_id": item_row[0]
            })
        
        # Видалити товари партії
        db.execute(text("DELETE FROM laundry_items WHERE batch_id = :batch_id"), {"batch_id": batch_id})
        
        # Видалити партію
        db.execute(text("DELETE FROM laundry_batches WHERE id = :id"), {"id": batch_id})
        
        db.commit()
        return {"message": "Партію видалено, товари повернуті на склад"}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Statistics Endpoints ====================

@router.get("/statistics")
async def get_laundry_statistics(db: Session = Depends(get_rh_db)):
    """Отримати загальну статистику по хімчистці"""
    result = db.execute(text("""
        SELECT 
            COUNT(*) as total_batches,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as active_batches,
            SUM(total_items) as total_items_sent,
            SUM(returned_items) as total_items_returned,
            SUM(cost) as total_cost
        FROM laundry_batches
    """))
    
    row = result.fetchone()
    
    return {
        "total_batches": row[0] or 0,
        "active_batches": row[1] or 0,
        "total_items_sent": row[2] or 0,
        "total_items_returned": row[3] or 0,
        "total_cost": float(row[4]) if row[4] else 0.0
    }

@router.get("/companies")
async def get_laundry_companies(db: Session = Depends(get_rh_db)):
    """Отримати список компаній-пралень"""
    result = db.execute(text("""
        SELECT DISTINCT laundry_company
        FROM laundry_batches
        WHERE laundry_company IS NOT NULL
        ORDER BY laundry_company
    """))
    
    companies = [row[0] for row in result]
    return {"companies": companies}
