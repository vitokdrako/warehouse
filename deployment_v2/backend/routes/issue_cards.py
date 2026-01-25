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
from utils.user_tracking_helper import get_current_user_dependency

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
    requisitors: Optional[List] = None  # Комплектувальники [{user_id, name}] або [id]

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
                # Завантажуємо дані товару (image, price, quantity, location)
                product_result = db.execute(text("""
                    SELECT p.product_id, p.image_url, p.price, p.rental_price, p.quantity,
                           p.zone, p.aisle, p.shelf
                    FROM products p
                    WHERE p.sku = :sku LIMIT 1
                """), {"sku": item['sku']})
                product_row = product_result.fetchone()
                
                if product_row:
                    product_id = product_row[0]
                    total_quantity = int(product_row[4]) if product_row[4] else 0
                    
                    # Оновлюємо image якщо немає
                    if not item.get('image') and product_row[1]:
                        item['image'] = product_row[1]
                    
                    # Додаємо ціни
                    if not item.get('deposit'):
                        item['deposit'] = float(product_row[2]) if product_row[2] else 0
                    if not item.get('damage_cost'):
                        item['damage_cost'] = float(product_row[2]) if product_row[2] else 0
                    
                    # Додаємо локацію на складі
                    zone = product_row[5]
                    aisle = product_row[6]
                    shelf = product_row[7]
                    if zone or aisle or shelf:
                        item['location'] = {
                            'zone': zone,
                            'aisle': aisle,
                            'shelf': shelf
                        }
                    
                    # ВАЖЛИВО: Рахуємо статуси з order_items (так само як availability_checker)
                    # Зарезервовано (заморожено) - статуси processing, ready_for_issue, issued, on_rent
                    reserved_result = db.execute(text("""
                        SELECT COALESCE(SUM(oi.quantity), 0) as reserved
                        FROM order_items oi
                        JOIN orders o ON oi.order_id = o.order_id
                        WHERE oi.product_id = :product_id
                        AND o.status IN ('processing', 'ready_for_issue', 'issued', 'on_rent')
                        AND o.is_archived = 0
                    """), {"product_id": product_id})
                    reserved_qty = int(reserved_result.fetchone()[0])
                    
                    # В оренді зараз - статуси issued, on_rent
                    in_rent_result = db.execute(text("""
                        SELECT COALESCE(SUM(oi.quantity), 0) as in_rent
                        FROM order_items oi
                        JOIN orders o ON oi.order_id = o.order_id
                        WHERE oi.product_id = :product_id
                        AND o.status IN ('issued', 'on_rent')
                        AND o.is_archived = 0
                    """), {"product_id": product_id})
                    in_rent_qty = int(in_rent_result.fetchone()[0])
                    
                    # Доступно = Всього - Зарезервовано
                    available_qty = total_quantity - reserved_qty
                    
                    # Встановлюємо актуальні статуси
                    item['available'] = available_qty if available_qty >= 0 else 0
                    item['reserved'] = reserved_qty
                    item['in_rent'] = in_rent_qty
                    item['in_restore'] = 0  # TODO: рахувати з damages коли буде реалізовано
                    
                    # Завантажуємо pre_damage (шкода зафіксована при видачі)
                    try:
                        order_id = row[1]  # order_id from issue_card row
                        if order_id:
                            damage_result = db.execute(text("""
                                SELECT damage_type, note, severity, photo_url, created_by,
                                       DATE_FORMAT(created_at, '%d.%m.%Y %H:%i') as created_at
                                FROM product_damage_history
                                WHERE order_id = :order_id 
                                AND product_id = :product_id 
                                AND stage = 'pre_issue'
                                ORDER BY created_at
                            """), {"order_id": order_id, "product_id": product_id})
                            
                            pre_damage = []
                            for d_row in damage_result:
                                pre_damage.append({
                                    "damage_type": d_row[0],
                                    "type": d_row[0],
                                    "note": d_row[1] or "",
                                    "severity": d_row[2] or "low",
                                    "photo_url": d_row[3],
                                    "created_by": d_row[4],
                                    "created_at": d_row[5]
                                })
                            
                            if pre_damage:
                                item['pre_damage'] = pre_damage
                                item['has_pre_damage'] = True
                    except Exception as e:
                        print(f"Warning: Could not load pre_damage: {e}")
    
    # Додати фінансові дані з таблиці orders для відображення на dashboard
    order_data = {}
    if db and row[1]:  # order_id
        order_result = db.execute(text("""
            SELECT customer_name, customer_phone, customer_email,
                   total_price, deposit_amount, total_loss_value, rental_days,
                   rental_start_date, rental_end_date
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
                "rental_days": order_row[6] or 0,
                "rental_start_date": order_row[7].strftime('%Y-%m-%d') if order_row[7] else None,
                "rental_end_date": order_row[8].strftime('%Y-%m-%d') if order_row[8] else None
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
    
    # Parse requisitors (колонка 21 - requisitors)
    requisitors = []
    if len(row) > 21 and row[21]:
        try:
            requisitors = json.loads(row[21]) if isinstance(row[21], str) else row[21]
        except:
            requisitors = []
    
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
        "requisitors": requisitors,
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
async def create_issue_card(
    card: IssueCardCreate,
    current_user: dict = Depends(get_current_user_dependency),
    db: Session = Depends(get_rh_db)
):
    """Create new issue card"""
    card_id = f"issue_{card.order_id}"
    items_json = json.dumps([item.dict() for item in card.items])
    
    db.execute(text("""
        INSERT INTO issue_cards (
            id, order_id, order_number, status, items, preparation_notes,
            created_by_id, created_at, updated_at
        ) VALUES (
            :id, :order_id, :order_number, 'preparation', :items, :notes,
            :created_by_id, NOW(), NOW()
        )
    """), {
        "id": card_id,
        "order_id": card.order_id,
        "order_number": card.order_number,
        "items": items_json,
        "notes": card.preparation_notes,
        "created_by_id": current_user["id"]
    })
    
    db.commit()
    return {"id": card_id, "message": "Issue card created"}

@router.put("/{card_id}")
async def update_issue_card(
    card_id: str,
    updates: IssueCardUpdate,
    current_user: dict = Depends(get_current_user_dependency),
    db: Session = Depends(get_rh_db)
):
    """Update issue card"""
    # Check exists and get order_id
    result = db.execute(text("SELECT id, order_id, status FROM issue_cards WHERE id = :id"), {"id": card_id})
    card_row = result.fetchone()
    if not card_row:
        raise HTTPException(status_code=404, detail="Issue card not found")
    
    order_id = card_row[1]
    old_status = card_row[2]
    user_id = current_user.get("id")
    user_name = f"{current_user.get('firstname', '')} {current_user.get('lastname', '')}".strip() or current_user.get('email', 'System')
    
    # Build dynamic update
    set_clauses = []
    params = {"id": card_id}
    
    if updates.status is not None:
        set_clauses.append("status = :status")
        params['status'] = updates.status
        
        # Track user based on status change
        if updates.status == 'ready':
            # Товар підготовлено
            set_clauses.append("prepared_by_id = :prepared_by_id")
            set_clauses.append("prepared_at = NOW()")
            params['prepared_by_id'] = current_user["id"]
        elif updates.status == 'issued':
            # Товар видано клієнту
            set_clauses.append("issued_by_id = :issued_by_id")
            set_clauses.append("issued_at = NOW()")
            params['issued_by_id'] = current_user["id"]
    
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
    if updates.requisitors is not None:
        set_clauses.append("requisitors = :requisitors")
        params['requisitors'] = json.dumps(updates.requisitors)
    
    if set_clauses:
        set_clauses.append("updated_at = NOW()")
        sql = f"UPDATE issue_cards SET {', '.join(set_clauses)} WHERE id = :id"
        db.execute(text(sql), params)
        db.commit()
    
    # ✅ ЛОГУВАННЯ В ORDER_LIFECYCLE при зміні статусу
    if updates.status is not None and updates.status != old_status and order_id:
        lifecycle_stages = {
            'preparation': ('packing_started', f'🔧 Комплектація розпочата'),
            'ready': ('packing_completed', f'✅ Комплектація завершена'),
            'issued': ('issued_to_client', f'📦 Видано клієнту'),
        }
        
        if updates.status in lifecycle_stages:
            stage, notes = lifecycle_stages[updates.status]
            db.execute(text("""
                INSERT INTO order_lifecycle (order_id, stage, notes, created_by, created_at, created_by_id, created_by_name)
                VALUES (:order_id, :stage, :notes, :created_by, NOW(), :user_id, :user_name)
            """), {
                "order_id": order_id,
                "stage": stage,
                "notes": notes,
                "created_by": current_user.get('email', 'System'),
                "user_id": user_id,
                "user_name": user_name
            })
            db.commit()
            print(f"[Lifecycle] Order {order_id}: {stage} by {user_name}")
    
    # Синхронізувати статус замовлення зі статусом issue_card
    if updates.status is not None and order_id:
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
                SET status = :status, updated_by_id = :user_id, updated_at = NOW()
                WHERE order_id = :order_id
            """), {"status": order_status, "order_id": order_id, "user_id": user_id})
            
            print(f"[Orders] Замовлення {order_id} → статус '{order_status}' (з issue_card '{updates.status}')")
            db.commit()
    
    return {"message": "Issue card updated"}

@router.post("/{card_id}/complete")
async def complete_issue_card(
    card_id: str,
    current_user: dict = Depends(get_current_user_dependency),
    db: Session = Depends(get_rh_db)
):
    """Mark issue card as issued/completed"""
    user_id = current_user.get("id")
    user_name = f"{current_user.get('firstname', '')} {current_user.get('lastname', '')}".strip() or current_user.get('email', 'System')
    
    # Оновити issue_card
    db.execute(text("""
        UPDATE issue_cards 
        SET status = 'issued', 
            issued_by_id = :issued_by_id,
            issued_at = NOW(), 
            updated_at = NOW()
        WHERE id = :id
    """), {"id": card_id, "issued_by_id": user_id})
    
    # ✅ FIXED: Синхронізувати статус замовлення
    result = db.execute(text("SELECT order_id FROM issue_cards WHERE id = :id"), {"id": card_id})
    row = result.fetchone()
    if row:
        order_id = row[0]
        db.execute(text("""
            UPDATE orders 
            SET status = 'issued', 
                updated_by_id = :user_id,
                updated_at = NOW()
            WHERE order_id = :order_id
        """), {"order_id": order_id, "user_id": user_id})
        
        # ✅ ЛОГУВАННЯ В ORDER_LIFECYCLE
        db.execute(text("""
            INSERT INTO order_lifecycle (order_id, stage, notes, created_by, created_at, created_by_id, created_by_name)
            VALUES (:order_id, 'issued_to_client', '📦 Видано клієнту', :created_by, NOW(), :user_id, :user_name)
        """), {
            "order_id": order_id,
            "created_by": current_user.get('email', 'System'),
            "user_id": user_id,
            "user_name": user_name
        })
        
        print(f"[Orders] Замовлення {order_id} → статус 'issued' (complete endpoint) by {user_name}")
    
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
