"""
Issue Cards routes - Картки видачі
✅ MIGRATED: Using RentalHub DB (Simplified version)
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import uuid
import json

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/issue-cards", tags=["issue-cards"])

# Pydantic Models
class IssueItem(BaseModel):
    sku: str
    name: str
    quantity: int
    status: str = "pending"
    photos: List[str] = []
    notes: Optional[str] = None

class IssueCardCreate(BaseModel):
    order_id: int
    order_number: str
    items: List[IssueItem]
    preparation_notes: Optional[str] = None

class IssueCardUpdate(BaseModel):
    status: Optional[str] = None
    items: Optional[List[dict]] = None
    preparation_notes: Optional[str] = None
    issue_notes: Optional[str] = None
    prepared_by: Optional[str] = None
    issued_by: Optional[str] = None
    checklist: Optional[dict] = None
    manager_notes: Optional[str] = None

# Helper function to parse issue card row
def parse_issue_card(row, db: Session = None):
    """Parse issue card row from database"""
    items = []
    if row[6]:  # items JSON column
        try:
            items = json.loads(row[6]) if isinstance(row[6], str) else row[6]
        except:
            items = []
    
    # Enrich with images AND product statuses if db session provided
    if db:
        for item in items:
            if 'sku' in item:
                # Завантажуємо дані товару (image, price)
                product_result = db.execute(text("""
                    SELECT p.product_id, p.image_url, p.price, p.rental_price
                    FROM products p
                    WHERE p.sku = :sku LIMIT 1
                """), {"sku": item['sku']})
                product_row = product_result.fetchone()
                
                if product_row:
                    product_id = product_row[0]
                    
                    # Оновлюємо image якщо немає
                    if not item.get('image') and product_row[1]:
                        item['image'] = product_row[1]
                    
                    # Додаємо ціни
                    if not item.get('deposit'):
                        item['deposit'] = float(product_row[2]) if product_row[2] else 0
                    if not item.get('damage_cost'):
                        item['damage_cost'] = float(product_row[2]) if product_row[2] else 0
                    
                    # ВАЖЛИВО: Завантажуємо актуальні статуси з inventory
                    # Якщо inventory порожня - залишаємо значення з JSON або ставимо за замовчуванням
                    try:
                        inventory_result = db.execute(text("""
                            SELECT 
                                SUM(CASE WHEN product_state = 'available' THEN quantity ELSE 0 END) as available,
                                SUM(reserved_quantity) as reserved,
                                SUM(CASE WHEN product_state = 'rented' THEN quantity ELSE 0 END) as in_rent,
                                SUM(CASE WHEN product_state = 'maintenance' THEN quantity ELSE 0 END) as in_restore
                            FROM inventory
                            WHERE product_id = :product_id
                        """), {"product_id": product_id})
                        inv_row = inventory_result.fetchone()
                        
                        if inv_row and (inv_row[0] is not None or inv_row[1] is not None):
                            # Є дані в inventory - використовуємо їх
                            item['available'] = int(inv_row[0]) if inv_row[0] is not None else 0
                            item['reserved'] = int(inv_row[1]) if inv_row[1] is not None else 0
                            item['in_rent'] = int(inv_row[2]) if inv_row[2] is not None else 0
                            item['in_restore'] = int(inv_row[3]) if inv_row[3] is not None else 0
                        else:
                            # Немає даних в inventory - залишаємо існуючі значення або 0
                            if 'available' not in item:
                                item['available'] = 0
                            if 'reserved' not in item:
                                item['reserved'] = 0
                            if 'in_rent' not in item:
                                item['in_rent'] = 0
                            if 'in_restore' not in item:
                                item['in_restore'] = 0
                    except Exception as e:
                        # Якщо помилка з inventory - встановлюємо 0
                        item['available'] = item.get('available', 0)
                        item['reserved'] = item.get('reserved', 0)
                        item['in_rent'] = item.get('in_rent', 0)
                        item['in_restore'] = item.get('in_restore', 0)
    
    # Додати фінансові дані з таблиці orders для відображення на dashboard
    order_data = {}
    if db and row[1]:  # order_id
        order_result = db.execute(text("""
            SELECT customer_name, customer_phone, customer_email,
                   total_price, deposit_amount, total_loss_value, rental_days
            FROM orders WHERE order_id = :order_id
        """), {"order_id": row[1]})
        order_row = order_result.fetchone()
        if order_row:
            order_data = {
                "customer_name": order_row[0],
                "customer_phone": order_row[1],
                "customer_email": order_row[2],
                "total_rental": float(order_row[3]) if order_row[3] else 0.0,
                "deposit_amount": float(order_row[4]) if order_row[4] else 0.0,
                "total_loss_value": float(order_row[5]) if order_row[5] else 0.0,
                "rental_days": order_row[6] or 0
            }
    
    # Parse checklist JSON if exists
    checklist = None
    if len(row) > 13 and row[13]:  # checklist column
        try:
            checklist = json.loads(row[13]) if isinstance(row[13], str) else row[13]
        except:
            checklist = None
    
    # Parse manager_notes if exists
    manager_notes = row[14] if len(row) > 14 else None
    
    return {
        "id": row[0],
        "order_id": row[1],
        "order_number": row[2],
        "status": row[3],
        "prepared_by": row[4],
        "issued_by": row[5],
        "items": items,
        "preparation_notes": row[7],
        "issue_notes": row[8],
        "prepared_at": row[9].isoformat() if row[9] else None,
        "issued_at": row[10].isoformat() if row[10] else None,
        "created_at": row[11].isoformat() if row[11] else None,
        "updated_at": row[12].isoformat() if row[12] else None,
        "checklist": checklist,
        "manager_notes": manager_notes,
        **order_data  # Додати всі поля замовлення
    }

@router.get("")
async def get_issue_cards(
    status: Optional[str] = None,
    order_id: Optional[int] = None,
    db: Session = Depends(get_rh_db)
):
    """
    Get all issue cards
    Фільтрує issue cards для cancelled та archived замовлень
    """
    sql = """
        SELECT ic.* 
        FROM issue_cards ic
        JOIN orders o ON ic.order_id = o.order_id
        WHERE o.status != 'cancelled' 
        AND o.is_archived = 0
    """
    params = {}
    
    if status:
        sql += " AND ic.status = :status"
        params['status'] = status
    if order_id:
        sql += " AND ic.order_id = :order_id"
        params['order_id'] = order_id
    
    sql += " ORDER BY ic.created_at DESC"
    
    result = db.execute(text(sql), params)
    return [parse_issue_card(row, db) for row in result]

@router.get("/{card_id}")
async def get_issue_card(card_id: str, db: Session = Depends(get_rh_db)):
    """Get single issue card"""
    result = db.execute(text("SELECT * FROM issue_cards WHERE id = :id"), {"id": card_id})
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Issue card not found")
    
    return parse_issue_card(row, db)

@router.post("")
async def create_issue_card(card: IssueCardCreate, db: Session = Depends(get_rh_db)):
    """Create new issue card"""
    card_id = f"issue_{card.order_id}"
    items_json = json.dumps([item.dict() for item in card.items])
    
    db.execute(text("""
        INSERT INTO issue_cards (
            id, order_id, order_number, status, items, preparation_notes,
            created_at, updated_at
        ) VALUES (
            :id, :order_id, :order_number, 'preparation', :items, :notes,
            NOW(), NOW()
        )
    """), {
        "id": card_id,
        "order_id": card.order_id,
        "order_number": card.order_number,
        "items": items_json,
        "notes": card.preparation_notes
    })
    
    db.commit()
    return {"id": card_id, "message": "Issue card created"}

@router.put("/{card_id}")
async def update_issue_card(
    card_id: str,
    updates: IssueCardUpdate,
    db: Session = Depends(get_rh_db)
):
    """Update issue card"""
    # Check exists
    result = db.execute(text("SELECT id FROM issue_cards WHERE id = :id"), {"id": card_id})
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Issue card not found")
    
    # Build dynamic update
    set_clauses = []
    params = {"id": card_id}
    
    if updates.status is not None:
        set_clauses.append("status = :status")
        params['status'] = updates.status
    if updates.items is not None:
        set_clauses.append("items = :items")
        params['items'] = json.dumps(updates.items)
    if updates.preparation_notes is not None:
        set_clauses.append("preparation_notes = :prep_notes")
        params['prep_notes'] = updates.preparation_notes
    if updates.issue_notes is not None:
        set_clauses.append("issue_notes = :issue_notes")
        params['issue_notes'] = updates.issue_notes
    if updates.prepared_by is not None:
        set_clauses.append("prepared_by = :prepared_by")
        params['prepared_by'] = updates.prepared_by
    if updates.issued_by is not None:
        set_clauses.append("issued_by = :issued_by")
        params['issued_by'] = updates.issued_by
    if updates.checklist is not None:
        set_clauses.append("checklist = :checklist")
        params['checklist'] = json.dumps(updates.checklist)
    if updates.manager_notes is not None:
        set_clauses.append("manager_notes = :manager_notes")
        params['manager_notes'] = updates.manager_notes
    
    if set_clauses:
        set_clauses.append("updated_at = NOW()")
        sql = f"UPDATE issue_cards SET {', '.join(set_clauses)} WHERE id = :id"
        db.execute(text(sql), params)
        db.commit()
    
    # Синхронізувати статус замовлення зі статусом issue_card
    if updates.status is not None:
        # Отримати order_id з issue_card
        result = db.execute(text("SELECT order_id FROM issue_cards WHERE id = :id"), {"id": card_id})
        row = result.fetchone()
        if row:
            order_id = row[0]
            
            # Мапінг статусів issue_card → orders
            status_mapping = {
                'preparation': 'processing',        # На комплектації → В обробці
                'ready': 'ready_for_issue',        # Готово → Готово до видачі
                'issued': 'issued',                # Видано → Видано
                'completed': 'completed'           # Завершено → Завершено
            }
            
            order_status = status_mapping.get(updates.status)
            if order_status:
                db.execute(text("""
                    UPDATE orders 
                    SET status = :status
                    WHERE order_id = :order_id
                """), {"status": order_status, "order_id": order_id})
                
                print(f"[Orders] Замовлення {order_id} → статус '{order_status}' (з issue_card '{updates.status}')")
                db.commit()
    
    return {"message": "Issue card updated"}

@router.post("/{card_id}/complete")
async def complete_issue_card(card_id: str, db: Session = Depends(get_rh_db)):
    """Mark issue card as issued/completed"""
    db.execute(text("""
        UPDATE issue_cards 
        SET status = 'issued', issued_at = NOW(), updated_at = NOW()
        WHERE id = :id
    """), {"id": card_id})
    
    db.commit()
    return {"message": "Issue card completed"}

@router.delete("/{card_id}")
async def delete_issue_card(card_id: str, db: Session = Depends(get_rh_db)):
    """Delete issue card"""
    result = db.execute(text("DELETE FROM issue_cards WHERE id = :id"), {"id": card_id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Issue card not found")
    
    return {"message": "Issue card deleted"}

@router.get("/by-order/{order_id}")
async def get_issue_card_by_order(order_id: int, db: Session = Depends(get_rh_db)):
    """Get issue card by order ID"""
    result = db.execute(text("""
        SELECT * FROM issue_cards WHERE order_id = :order_id ORDER BY created_at DESC LIMIT 1
    """), {"order_id": order_id})
    
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Issue card not found for this order")
    
    return parse_issue_card(row, db)
