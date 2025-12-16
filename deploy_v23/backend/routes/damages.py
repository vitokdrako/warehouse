"""
Damages API - Управління шкодами
✅ MIGRATED: Using RentalHub DB
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import uuid
import json

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/damages", tags=["damages"])

def parse_damage(row):
    """Parse damage case row"""
    return {
        "id": row[0],
        "case_number": row[1],
        "order_id": row[2],
        "order_number": row[3],
        "customer_id": row[4],
        "customer_name": row[5],
        "customer_phone": row[6],
        "customer_email": row[7],
        "event_name": row[8],
        "return_date": row[9].isoformat() if row[9] else None,
        "case_status": row[10],
        "severity": row[11],
        "source": row[12],
        "from_reaudit_item_id": row[13],
        "finance_status": row[14],
        "fulfillment_status": row[15],
        "claimed_total": float(row[16]) if row[16] else 0.0,
        "paid_total": float(row[17]) if row[17] else 0.0,
        "withheld_total": float(row[18]) if row[18] else 0.0,
        "deposit_available": float(row[19]) if row[19] else 0.0,
        "notes": row[20],
        "payment_policy": row[21],
        "created_by": row[22],
        "assigned_to": row[23],
        "manager_comment": row[24],
        "created_at": row[25].isoformat() if row[25] else None,
        "updated_at": row[26].isoformat() if row[26] else None
    }

@router.get("/cases")
async def get_damage_cases(
    status: str = None,
    order_id: int = None,
    db: Session = Depends(get_rh_db)
):
    """Get all damage cases"""
    sql = "SELECT * FROM damages WHERE 1=1"
    params = {}
    
    if status:
        sql += " AND case_status = :status"
        params['status'] = status
    if order_id:
        sql += " AND order_id = :order_id"
        params['order_id'] = order_id
    
    sql += " ORDER BY created_at DESC"
    
    result = db.execute(text(sql), params)
    return [parse_damage(row) for row in result]

@router.get("/cases/{case_id}")
async def get_damage_case(case_id: str, db: Session = Depends(get_rh_db)):
    """Get single damage case with items"""
    result = db.execute(text("SELECT * FROM damages WHERE id = :id"), {"id": case_id})
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Damage case not found")
    
    damage = parse_damage(row)
    
    # Get damage items
    items_result = db.execute(text("""
        SELECT * FROM damage_items WHERE damage_id = :damage_id
    """), {"damage_id": case_id})
    
    items = []
    for item_row in items_result:
        items.append({
            "id": item_row[0],
            "product_id": item_row[2],
            "barcode": item_row[3],
            "name": item_row[4],
            "image": item_row[5],
            "damage_type": item_row[8],
            "qty": item_row[9],
            "base_value": float(item_row[10]) if item_row[10] else 0.0,
            "estimate_value": float(item_row[11]) if item_row[11] else 0.0,
            "resolution": item_row[12],
            "comment": item_row[13]
        })
    
    damage['items'] = items
    return damage

@router.post("/cases")
async def create_damage_case(data: dict, db: Session = Depends(get_rh_db)):
    """Create new damage case"""
    case_id = str(uuid.uuid4())
    
    db.execute(text("""
        INSERT INTO damages (
            id, order_id, order_number, customer_name, customer_phone,
            case_status, severity, source, notes, created_by, created_at, updated_at
        ) VALUES (
            :id, :order_id, :order_number, :customer_name, :customer_phone,
            'pending', :severity, :source, :notes, :created_by, NOW(), NOW()
        )
    """), {
        "id": case_id,
        "order_id": data.get('order_id'),
        "order_number": data.get('order_number'),
        "customer_name": data.get('customer_name'),
        "customer_phone": data.get('customer_phone'),
        "severity": data.get('severity', 'minor'),
        "source": data.get('source', 'return'),
        "notes": data.get('notes'),
        "created_by": data.get('created_by', 'system')
    })
    
    db.commit()
    return {"id": case_id, "message": "Damage case created"}

@router.put("/cases/{case_id}/status")
async def update_damage_status(
    case_id: str,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """Update damage case status"""
    db.execute(text("""
        UPDATE damages 
        SET case_status = :status, updated_at = NOW()
        WHERE id = :id
    """), {"status": data.get('status'), "id": case_id})
    
    db.commit()
    return {"message": "Status updated"}

@router.post("/cases/{case_id}/lines")
async def add_damage_item(
    case_id: str,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """Add item to damage case"""
    db.execute(text("""
        INSERT INTO damage_items (
            damage_id, product_id, name, damage_type, qty,
            base_value, estimate_value, created_at
        ) VALUES (
            :damage_id, :product_id, :name, :damage_type, :qty,
            :base_value, :estimate_value, NOW()
        )
    """), {
        "damage_id": case_id,
        "product_id": data.get('product_id'),
        "name": data.get('name'),
        "damage_type": data.get('damage_type'),
        "qty": data.get('qty', 1),
        "base_value": data.get('base_value', 0),
        "estimate_value": data.get('estimate_value', 0)
    })
    
    db.commit()
    return {"message": "Damage item added"}

@router.put("/cases/{case_id}")
async def update_damage_case(
    case_id: str,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """Update damage case"""
    set_clauses = []
    params = {"id": case_id}
    
    for field in ['case_status', 'severity', 'finance_status', 'fulfillment_status', 
                  'claimed_total', 'paid_total', 'notes', 'assigned_to']:
        if field in data:
            set_clauses.append(f"{field} = :{field}")
            params[field] = data[field]
    
    if set_clauses:
        set_clauses.append("updated_at = NOW()")
        sql = f"UPDATE damages SET {', '.join(set_clauses)} WHERE id = :id"
        db.execute(text(sql), params)
        db.commit()
    
    return {"message": "Damage case updated"}
