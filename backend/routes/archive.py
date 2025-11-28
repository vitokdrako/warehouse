"""
Archive API - Архів замовлень
✅ MIGRATED: Using RentalHub DB
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from datetime import datetime, timedelta

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/archive", tags=["archive"])

@router.get("")
async def get_archived_orders(
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати архівні замовлення
    ✅ MIGRATED: Using RentalHub DB
    """
    sql = """
        SELECT 
            order_id, order_number, customer_name, customer_phone,
            rental_start_date, rental_end_date, status, total_price,
            created_at
        FROM orders
        WHERE status IN ('returned', 'cancelled', 'completed')
    """
    
    params = {}
    
    if status:
        sql += " AND status = :status"
        params['status'] = status
    
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
            "customer_name": row[2],
            "customer_phone": row[3],
            "rental_start_date": row[4].isoformat() if row[4] else None,
            "rental_end_date": row[5].isoformat() if row[5] else None,
            "status": row[6],
            "total_amount": float(row[7]) if row[7] else 0.0,
            "created_at": row[8].isoformat() if row[8] else None
        })
    
    return orders

@router.get("/{order_id}/full-history")
async def get_order_full_history(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Повна історія замовлення
    ✅ MIGRATED: Using RentalHub DB
    """
    # Order details
    order_result = db.execute(text("""
        SELECT 
            order_id, order_number, customer_name, customer_phone, customer_email,
            rental_start_date, rental_end_date, status, total_price, deposit_amount,
            created_at
        FROM orders
        WHERE order_id = :order_id
    """), {"order_id": order_id})
    
    order_row = order_result.fetchone()
    if not order_row:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Issue cards
    issue_result = db.execute(text("""
        SELECT id, status, prepared_by, issued_by, prepared_at, issued_at, created_at
        FROM issue_cards
        WHERE order_id = :order_id
        ORDER BY created_at DESC
    """), {"order_id": order_id})
    
    issue_cards = []
    for i_row in issue_result:
        issue_cards.append({
            "id": i_row[0],
            "status": i_row[1],
            "prepared_by": i_row[2],
            "issued_by": i_row[3],
            "prepared_at": i_row[4].isoformat() if i_row[4] else None,
            "issued_at": i_row[5].isoformat() if i_row[5] else None,
            "created_at": i_row[6].isoformat() if i_row[6] else None
        })
    
    # Return cards
    return_result = db.execute(text("""
        SELECT id, status, received_by, checked_by, items_ok, items_damaged, 
               items_missing, cleaning_fee, late_fee, returned_at, checked_at, created_at
        FROM return_cards
        WHERE order_id = :order_id
        ORDER BY created_at DESC
    """), {"order_id": order_id})
    
    return_cards = []
    for r_row in return_result:
        return_cards.append({
            "id": r_row[0],
            "status": r_row[1],
            "received_by": r_row[2],
            "checked_by": r_row[3],
            "items_ok": r_row[4],
            "items_damaged": r_row[5],
            "items_missing": r_row[6],
            "cleaning_fee": float(r_row[7]) if r_row[7] else 0.0,
            "late_fee": float(r_row[8]) if r_row[8] else 0.0,
            "returned_at": r_row[9].isoformat() if r_row[9] else None,
            "checked_at": r_row[10].isoformat() if r_row[10] else None,
            "created_at": r_row[11].isoformat() if r_row[11] else None
        })
    
    # Damages
    damages_result = db.execute(text("""
        SELECT id, case_status, severity, claimed_total, paid_total, created_at
        FROM damages
        WHERE order_id = :order_id
        ORDER BY created_at DESC
    """), {"order_id": order_id})
    
    damages = []
    for d_row in damages_result:
        damages.append({
            "id": d_row[0],
            "case_status": d_row[1],
            "severity": d_row[2],
            "claimed_total": float(d_row[3]) if d_row[3] else 0.0,
            "paid_total": float(d_row[4]) if d_row[4] else 0.0,
            "created_at": d_row[5].isoformat() if d_row[5] else None
        })
    
    # Tasks
    tasks_result = db.execute(text("""
        SELECT id, title, status, priority, assigned_to, due_date, completed_at, created_at
        FROM tasks
        WHERE order_id = :order_id
        ORDER BY created_at DESC
    """), {"order_id": order_id})
    
    tasks = []
    for t_row in tasks_result:
        tasks.append({
            "id": t_row[0],
            "title": t_row[1],
            "status": t_row[2],
            "priority": t_row[3],
            "assigned_to": t_row[4],
            "due_date": t_row[5].isoformat() if t_row[5] else None,
            "completed_at": t_row[6].isoformat() if t_row[6] else None,
            "created_at": t_row[7].isoformat() if t_row[7] else None
        })
    
    return {
        "order": {
            "order_id": order_row[0],
            "order_number": order_row[1],
            "customer_name": order_row[2],
            "customer_phone": order_row[3],
            "customer_email": order_row[4],
            "rental_start_date": order_row[5].isoformat() if order_row[5] else None,
            "rental_end_date": order_row[6].isoformat() if order_row[6] else None,
            "status": order_row[7],
            "total_amount": float(order_row[8]) if order_row[8] else 0.0,
            "deposit_amount": float(order_row[9]) if order_row[9] else 0.0,
            "created_at": order_row[10].isoformat() if order_row[10] else None
        },
        "issue_cards": issue_cards,
        "return_cards": return_cards,
        "damages": damages,
        "tasks": tasks
    }

@router.get("/stats")
async def get_archive_stats(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_rh_db)
):
    """
    Статистика архіву
    ✅ MIGRATED: Using RentalHub DB
    """
    params = {}
    date_filter = ""
    
    if from_date:
        date_filter += " AND created_at >= :from_date"
        params['from_date'] = from_date
    
    if to_date:
        date_filter += " AND created_at <= :to_date"
        params['to_date'] = to_date
    
    # Total orders
    total_result = db.execute(text(f"""
        SELECT COUNT(*) FROM orders WHERE status IN ('returned', 'cancelled', 'completed') {date_filter}
    """), params)
    total_orders = total_result.scalar() or 0
    
    # By status
    status_result = db.execute(text(f"""
        SELECT status, COUNT(*) as count
        FROM orders
        WHERE status IN ('returned', 'cancelled', 'completed') {date_filter}
        GROUP BY status
    """), params)
    
    by_status = {}
    for s_row in status_result:
        by_status[s_row[0]] = s_row[1]
    
    # Revenue
    revenue_result = db.execute(text(f"""
        SELECT SUM(total_price) FROM orders 
        WHERE status IN ('returned', 'completed') {date_filter}
    """), params)
    total_revenue = revenue_result.scalar() or 0.0
    
    return {
        "total_orders": total_orders,
        "by_status": by_status,
        "total_revenue": float(total_revenue),
        "period": {
            "from": from_date,
            "to": to_date
        }
    }
