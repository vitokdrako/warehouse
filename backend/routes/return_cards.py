"""
Return Cards routes - Картки повернення
✅ MIGRATED: Using RentalHub DB
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

router = APIRouter(prefix="/api/return-cards", tags=["return-cards"])

# Pydantic Models
class ReturnItem(BaseModel):
    sku: str
    name: str
    quantity_expected: int
    quantity_returned: int
    condition: str = "ok"  # ok, dirty, damaged, missing
    photos: List[str] = []
    notes: Optional[str] = None

class ReturnCardCreate(BaseModel):
    order_id: int
    order_number: str
    issue_card_id: str
    items_expected: List[dict]

class ReturnCardUpdate(BaseModel):
    status: Optional[str] = None
    items_returned: Optional[List[dict]] = None
    return_notes: Optional[str] = None
    received_by: Optional[str] = None
    checked_by: Optional[str] = None
    items_ok: Optional[int] = None
    items_dirty: Optional[int] = None
    items_damaged: Optional[int] = None
    items_missing: Optional[int] = None

# Helper to parse return card
def parse_return_card(row):
    """Parse return card row"""
    items_expected = []
    items_returned = []
    
    if row[7]:  # items_expected
        try:
            items_expected = json.loads(row[7]) if isinstance(row[7], str) else row[7]
        except:
            pass
    
    if row[8]:  # items_returned
        try:
            items_returned = json.loads(row[8]) if isinstance(row[8], str) else row[8]
        except:
            pass
    
    return {
        "id": row[0],
        "order_id": row[1],
        "order_number": row[2],
        "issue_card_id": row[3],
        "status": row[4],
        "received_by": row[5],
        "checked_by": row[6],
        "items_expected": items_expected,
        "items_returned": items_returned,
        "total_items_expected": row[9],
        "total_items_returned": row[10],
        "items_ok": row[11],
        "items_dirty": row[12],
        "items_damaged": row[13],
        "items_missing": row[14],
        "cleaning_fee": float(row[15]) if row[15] else 0.0,
        "late_fee": float(row[16]) if row[16] else 0.0,
        "return_notes": row[17],
        "returned_at": row[18].isoformat() if row[18] else None,
        "checked_at": row[19].isoformat() if row[19] else None,
        "created_at": row[20].isoformat() if row[20] else None,
        "updated_at": row[21].isoformat() if row[21] else None
    }

@router.get("")
async def get_return_cards(
    status: Optional[str] = None,
    order_id: Optional[int] = None,
    db: Session = Depends(get_rh_db)
):
    """Get all return cards"""
    sql = "SELECT * FROM return_cards WHERE 1=1"
    params = {}
    
    if status:
        sql += " AND status = :status"
        params['status'] = status
    if order_id:
        sql += " AND order_id = :order_id"
        params['order_id'] = order_id
    
    sql += " ORDER BY created_at DESC"
    
    result = db.execute(text(sql), params)
    return [parse_return_card(row) for row in result]

@router.get("/{card_id}")
async def get_return_card(card_id: str, db: Session = Depends(get_rh_db)):
    """Get single return card"""
    result = db.execute(text("SELECT * FROM return_cards WHERE id = :id"), {"id": card_id})
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Return card not found")
    
    return parse_return_card(row)

@router.post("")
async def create_return_card(
    card: ReturnCardCreate,
    current_user: dict = Depends(get_current_user_dependency),
    db: Session = Depends(get_rh_db)
):
    """Create new return card"""
    card_id = f"RETURN-{uuid.uuid4().hex[:8].upper()}"
    items_json = json.dumps(card.items_expected)
    
    db.execute(text("""
        INSERT INTO return_cards (
            id, order_id, order_number, issue_card_id, status, 
            items_expected, total_items_expected, 
            created_by_id, created_at, updated_at
        ) VALUES (
            :id, :order_id, :order_number, :issue_card_id, 'pending',
            :items, :total, :created_by_id, NOW(), NOW()
        )
    """), {
        "id": card_id,
        "order_id": card.order_id,
        "order_number": card.order_number,
        "issue_card_id": card.issue_card_id,
        "items": items_json,
        "total": len(card.items_expected),
        "created_by_id": current_user["id"]
    })
    
    db.commit()
    return {"id": card_id, "message": "Return card created"}

@router.put("/{card_id}")
async def update_return_card(
    card_id: str,
    updates: ReturnCardUpdate,
    db: Session = Depends(get_rh_db)
):
    """Update return card"""
    result = db.execute(text("SELECT id FROM return_cards WHERE id = :id"), {"id": card_id})
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Return card not found")
    
    set_clauses = []
    params = {"id": card_id}
    
    if updates.status is not None:
        set_clauses.append("status = :status")
        params['status'] = updates.status
    if updates.items_returned is not None:
        set_clauses.append("items_returned = :items")
        params['items'] = json.dumps(updates.items_returned)
    if updates.return_notes is not None:
        set_clauses.append("return_notes = :notes")
        params['notes'] = updates.return_notes
    if updates.received_by is not None:
        set_clauses.append("received_by = :received_by")
        params['received_by'] = updates.received_by
    if updates.checked_by is not None:
        set_clauses.append("checked_by = :checked_by")
        params['checked_by'] = updates.checked_by
    if updates.items_ok is not None:
        set_clauses.append("items_ok = :items_ok")
        params['items_ok'] = updates.items_ok
    if updates.items_dirty is not None:
        set_clauses.append("items_dirty = :items_dirty")
        params['items_dirty'] = updates.items_dirty
    if updates.items_damaged is not None:
        set_clauses.append("items_damaged = :items_damaged")
        params['items_damaged'] = updates.items_damaged
    if updates.items_missing is not None:
        set_clauses.append("items_missing = :items_missing")
        params['items_missing'] = updates.items_missing
    
    if set_clauses:
        set_clauses.append("updated_at = NOW()")
        sql = f"UPDATE return_cards SET {', '.join(set_clauses)} WHERE id = :id"
        db.execute(text(sql), params)
        db.commit()
    
    return {"message": "Return card updated"}

@router.post("/{card_id}/complete")
async def complete_return_card(card_id: str, db: Session = Depends(get_rh_db)):
    """Mark return card as completed"""
    db.execute(text("""
        UPDATE return_cards 
        SET status = 'resolved', checked_at = NOW(), updated_at = NOW()
        WHERE id = :id
    """), {"id": card_id})
    
    db.commit()
    return {"message": "Return card completed"}

@router.delete("/{card_id}")
async def delete_return_card(card_id: str, db: Session = Depends(get_rh_db)):
    """Delete return card"""
    result = db.execute(text("DELETE FROM return_cards WHERE id = :id"), {"id": card_id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Return card not found")
    
    return {"message": "Return card deleted"}

@router.get("/by-order/{order_id}")
async def get_return_card_by_order(order_id: int, db: Session = Depends(get_rh_db)):
    """Get return card by order ID"""
    result = db.execute(text("""
        SELECT * FROM return_cards WHERE order_id = :order_id ORDER BY created_at DESC LIMIT 1
    """), {"order_id": order_id})
    
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Return card not found for this order")
    
    return parse_return_card(row)
