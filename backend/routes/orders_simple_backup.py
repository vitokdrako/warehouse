"""
Orders API - Управління замовленнями
✅ MIGRATED: Using RentalHub DB
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from datetime import datetime
import uuid
import json

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/orders", tags=["orders"])

@router.get("")
async def get_orders(
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати список замовлень
    ✅ MIGRATED: Using RentalHub DB
    """
    sql = """
        SELECT 
            order_id, order_number, customer_id, customer_name, customer_phone, customer_email,
            rental_start_date, rental_end_date, status, total_amount, deposit_amount, created_at
        FROM orders
        WHERE 1=1
    """
    
    params = {}
    
    if status:
        sql += " AND status = :status"
        params['status'] = status
    
    if customer_id:
        sql += " AND customer_id = :customer_id"
        params['customer_id'] = customer_id
    
    if from_date:
        sql += " AND rental_start_date >= :from_date"
        params['from_date'] = from_date
    
    if to_date:
        sql += " AND rental_end_date <= :to_date"
        params['to_date'] = to_date
    
    sql += f" ORDER BY created_at DESC LIMIT {limit}"
    
    result = db.execute(text(sql), params)
    
    orders = []
    for row in result:
        orders.append({
            "order_id": row[0],
            "order_number": row[1],
            "customer_id": row[2],
            "customer_name": row[3],
            "customer_phone": row[4],
            "customer_email": row[5],
            "rental_start_date": row[6].isoformat() if row[6] else None,
            "rental_end_date": row[7].isoformat() if row[7] else None,
            "status": row[8],
            "total_amount": float(row[9]) if row[9] else 0.0,
            "deposit_amount": float(row[10]) if row[10] else 0.0,
            "created_at": row[11].isoformat() if row[11] else None
        })
    
    return orders

@router.get("/{order_id}")
async def get_order_details(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Деталі замовлення
    ✅ MIGRATED: Using RentalHub DB
    """
    # Order details
    result = db.execute(text("""
        SELECT 
            order_id, order_number, customer_id, customer_name, customer_phone, customer_email,
            rental_start_date, rental_end_date, status, total_amount, deposit_amount, 
            notes, created_at
        FROM orders
        WHERE order_id = :order_id
    """), {"order_id": order_id})
    
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get issue cards
    issue_result = db.execute(text("""
        SELECT id, status, items, prepared_by, issued_by, created_at
        FROM issue_cards
        WHERE order_id = :order_id
    """), {"order_id": order_id})
    
    issue_cards = []
    for i_row in issue_result:
        items = []
        if i_row[2]:
            try:
                items = json.loads(i_row[2]) if isinstance(i_row[2], str) else i_row[2]
            except:
                pass
        
        issue_cards.append({
            "id": i_row[0],
            "status": i_row[1],
            "items": items,
            "prepared_by": i_row[3],
            "issued_by": i_row[4],
            "created_at": i_row[5].isoformat() if i_row[5] else None
        })
    
    return {
        "order_id": row[0],
        "order_number": row[1],
        "customer_id": row[2],
        "customer_name": row[3],
        "customer_phone": row[4],
        "customer_email": row[5],
        "rental_start_date": row[6].isoformat() if row[6] else None,
        "rental_end_date": row[7].isoformat() if row[7] else None,
        "status": row[8],
        "total_amount": float(row[9]) if row[9] else 0.0,
        "deposit_amount": float(row[10]) if row[10] else 0.0,
        "notes": row[11],
        "created_at": row[12].isoformat() if row[12] else None,
        "issue_cards": issue_cards
    }

@router.put("/{order_id}")
async def update_order(
    order_id: int,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Оновити замовлення
    ✅ MIGRATED: Using RentalHub DB
    """
    # Check exists
    result = db.execute(text("SELECT order_id FROM orders WHERE order_id = :id"), {"id": order_id})
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Build update
    set_clauses = []
    params = {"order_id": order_id}
    
    for field in ['customer_name', 'customer_phone', 'customer_email', 'rental_start_date', 
                  'rental_end_date', 'status', 'total_amount', 'deposit_amount', 'notes']:
        if field in data:
            set_clauses.append(f"{field} = :{field}")
            params[field] = data[field]
    
    if set_clauses:
        sql = f"UPDATE orders SET {', '.join(set_clauses)} WHERE order_id = :order_id"
        db.execute(text(sql), params)
        db.commit()
    
    return {"message": "Order updated", "order_id": order_id}

@router.put("/{order_id}/status")
async def update_order_status(
    order_id: int,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Змінити статус замовлення
    ✅ MIGRATED: Using RentalHub DB
    """
    new_status = data.get('status')
    if not new_status:
        raise HTTPException(status_code=400, detail="Status is required")
    
    db.execute(text("""
        UPDATE orders 
        SET status = :status
        WHERE order_id = :order_id
    """), {"status": new_status, "order_id": order_id})
    
    db.commit()
    
    return {"message": "Status updated", "order_id": order_id, "status": new_status}

@router.post("")
async def create_order(
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Створити нове замовлення
    ✅ MIGRATED: Using RentalHub DB
    """
    # Generate order number
    order_number = f"ORD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    
    db.execute(text("""
        INSERT INTO orders (
            order_number, customer_name, customer_phone, customer_email,
            rental_start_date, rental_end_date, status, total_amount, deposit_amount,
            notes, created_at
        ) VALUES (
            :order_number, :customer_name, :customer_phone, :customer_email,
            :rental_start_date, :rental_end_date, 'pending', :total_amount, :deposit_amount,
            :notes, NOW()
        )
    """), {
        "order_number": order_number,
        "customer_name": data.get('customer_name'),
        "customer_phone": data.get('customer_phone'),
        "customer_email": data.get('customer_email'),
        "rental_start_date": data.get('rental_start_date'),
        "rental_end_date": data.get('rental_end_date'),
        "total_amount": data.get('total_amount', 0),
        "deposit_amount": data.get('deposit_amount', 0),
        "notes": data.get('notes')
    })
    
    # Get inserted ID
    result = db.execute(text("SELECT LAST_INSERT_ID()"))
    order_id = result.scalar()
    
    db.commit()
    
    return {
        "message": "Order created",
        "order_id": order_id,
        "order_number": order_number
    }

@router.post("/{order_id}/accept")
async def accept_order(
    order_id: int,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Прийняти замовлення і перевести в комплектацію
    ✅ MIGRATED: Using RentalHub DB
    """
    # Check order exists
    result = db.execute(text("""
        SELECT order_id, order_number FROM orders WHERE order_id = :id
    """), {"id": order_id})
    
    order_row = result.fetchone()
    if not order_row:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order_db_id, order_number = order_row
    
    # Update order status
    db.execute(text("""
        UPDATE orders 
        SET status = 'processing'
        WHERE order_id = :order_id
    """), {"order_id": order_id})
    
    # Create issue card
    issue_card_id = f"issue_{order_id}"
    items = data.get('items', [])
    
    db.execute(text("""
        INSERT INTO issue_cards (
            id, order_id, order_number, status, items, created_at, updated_at
        ) VALUES (
            :id, :order_id, :order_number, 'preparation', :items, NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
            items = :items, updated_at = NOW()
    """), {
        "id": issue_card_id,
        "order_id": order_id,
        "order_number": order_number,
        "items": json.dumps(items)
    })
    
    db.commit()
    
    return {
        "message": "Order accepted and moved to preparation",
        "order_id": order_id,
        "issue_card_id": issue_card_id
    }

@router.delete("/{order_id}")
async def delete_order(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Видалити замовлення
    ✅ MIGRATED: Using RentalHub DB
    """
    result = db.execute(text("DELETE FROM orders WHERE order_id = :id"), {"id": order_id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"message": "Order deleted"}

@router.post("/{order_id}/decline")
async def decline_order(
    order_id: int,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Відхилити замовлення
    ✅ MIGRATED: Using RentalHub DB
    """
    db.execute(text("""
        UPDATE orders 
        SET status = 'cancelled', notes = :notes
        WHERE order_id = :order_id
    """), {
        "order_id": order_id,
        "notes": data.get('reason', 'Order declined')
    })
    
    db.commit()
    
    return {"message": "Order declined", "order_id": order_id}

# Simplified endpoints
@router.get("/customer/{customer_id}/stats")
async def get_customer_stats(customer_id: int, db: Session = Depends(get_rh_db)):
    """Статистика клієнта"""
    result = db.execute(text("""
        SELECT COUNT(*), SUM(total_amount) FROM orders WHERE customer_id = :id
    """), {"id": customer_id})
    row = result.fetchone()
    return {"total_orders": row[0] or 0, "total_spent": float(row[1]) if row[1] else 0.0}

@router.get("/inventory/search")
async def search_inventory(query: str, db: Session = Depends(get_rh_db)):
    """Пошук інвентарю"""
    result = db.execute(text("""
        SELECT product_id, sku, name, quantity FROM products 
        WHERE name LIKE :query OR sku LIKE :query LIMIT 20
    """), {"query": f"%{query}%"})
    return [{"product_id": r[0], "sku": r[1], "name": r[2], "quantity": r[3]} for r in result]

@router.post("/check-availability")
async def check_availability(data: dict, db: Session = Depends(get_rh_db)):
    """Перевірка доступності товарів"""
    items = data.get('items', [])
    results = []
    for item in items:
        result = db.execute(text("""
            SELECT quantity FROM products WHERE product_id = :id
        """), {"id": item.get('product_id')})
        row = result.fetchone()
        results.append({
            "product_id": item.get('product_id'),
            "available": (row[0] if row else 0) >= item.get('quantity', 1)
        })
    return {"items": results}
