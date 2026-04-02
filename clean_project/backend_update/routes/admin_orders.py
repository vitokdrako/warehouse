"""
Admin Orders Management API
Full financial CRUD for orders
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/admin/orders-management", tags=["admin-orders"])


@router.get("")
async def get_orders_management(
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_rh_db)
):
    """All orders with full financial data for admin table"""
    
    where_clauses = ["1=1"]
    params = {}
    
    if search:
        where_clauses.append(
            "(o.order_number LIKE :search OR o.customer_name LIKE :search OR o.customer_phone LIKE :search)"
        )
        params["search"] = f"%{search}%"
    
    if status and status != "all":
        where_clauses.append("o.status = :status")
        params["status"] = status

    where_sql = " AND ".join(where_clauses)

    rows = db.execute(text(f"""
        SELECT 
            o.order_id,
            o.order_number,
            o.customer_name,
            o.customer_phone,
            o.status,
            o.rental_start_date,
            o.rental_end_date,
            o.rental_days,
            o.total_price,
            o.discount_percent,
            o.discount_amount,
            o.service_fee,
            o.service_fee_name,
            o.deposit_amount,
            o.manager_id,
            CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, '')) as manager_name,
            o.created_at,
            o.client_user_id
        FROM orders o
        LEFT JOIN users u ON o.manager_id = u.user_id
        WHERE {where_sql}
        ORDER BY o.order_id DESC
    """), params).fetchall()

    order_ids = [r[0] for r in rows]
    if not order_ids:
        return {"orders": [], "total": 0}

    # Batch: paid_rent & paid_deposit per order
    ids_str = ",".join(str(i) for i in order_ids)
    pay_rows = db.execute(text(f"""
        SELECT entity_id as order_id,
            COALESCE(SUM(CASE WHEN tx_type IN ('rent_payment','additional_payment') THEN amount ELSE 0 END),0) as paid_rent,
            COALESCE(SUM(CASE WHEN tx_type = 'deposit_payment' THEN amount ELSE 0 END),0) as paid_deposit
        FROM fin_transactions
        WHERE entity_type='order' AND entity_id IN ({ids_str}) AND status != 'voided'
        GROUP BY entity_id
    """)).fetchall()
    pay_map = {int(r[0]): {"paid_rent": float(r[1]), "paid_deposit": float(r[2])} for r in pay_rows}

    # Batch: deposit hold status per order
    dep_rows = db.execute(text(f"""
        SELECT order_id, status, held_amount, refunded_amount, used_amount
        FROM fin_deposit_holds
        WHERE order_id IN ({ids_str})
    """)).fetchall()
    dep_map = {}
    for d in dep_rows:
        dep_map[int(d[0])] = {
            "deposit_status": d[1],
            "deposit_held": float(d[2] or 0),
            "deposit_refunded": float(d[3] or 0),
            "deposit_used": float(d[4] or 0),
        }

    # Batch: client_user payer info
    client_ids = list(set(r[17] for r in rows if r[17]))
    client_map = {}
    if client_ids:
        cids = ",".join(str(c) for c in client_ids)
        cl_rows = db.execute(text(f"""
            SELECT id, payer_type, company
            FROM client_users WHERE id IN ({cids})
        """)).fetchall()
        for c in cl_rows:
            client_map[c[0]] = {"payer_type": c[1], "company_name": c[2]}

    orders = []
    for r in rows:
        oid = r[0]
        total_price = float(r[8] or 0)
        discount_amount = float(r[10] or 0)
        service_fee = float(r[11] or 0)
        total_to_pay = round(max(0, total_price - discount_amount + service_fee), 2)
        
        pm = pay_map.get(oid, {"paid_rent": 0, "paid_deposit": 0})
        debt = round(max(0, total_to_pay - pm["paid_rent"]), 2)
        
        dm = dep_map.get(oid, {})
        cl = client_map.get(r[17], {})

        orders.append({
            "order_id": oid,
            "order_number": r[1],
            "customer_name": r[2],
            "customer_phone": r[3],
            "status": r[4],
            "rental_start": r[5].isoformat() if r[5] else None,
            "rental_end": r[6].isoformat() if r[6] else None,
            "rental_days": r[7] or 0,
            "total_price": total_price,
            "discount_percent": float(r[9] or 0),
            "discount_amount": discount_amount,
            "service_fee": service_fee,
            "service_fee_name": r[12] or "",
            "deposit_amount": float(r[13] or 0),
            "manager_id": r[14],
            "manager_name": (r[15] or "").strip(),
            "created_at": r[16].isoformat() if r[16] else None,
            "total_to_pay": total_to_pay,
            "paid_rent": pm["paid_rent"],
            "paid_deposit": pm["paid_deposit"],
            "debt": debt,
            "deposit_status": dm.get("deposit_status", "—"),
            "deposit_held": dm.get("deposit_held", 0),
            "deposit_refunded": dm.get("deposit_refunded", 0),
            "payer_type": cl.get("payer_type", "individual"),
            "company_name": cl.get("company_name", ""),
            "is_event_manager_client": bool(r[17]),
        })

    return {"orders": orders, "total": len(orders)}


class OrderFinanceUpdate(BaseModel):
    total_price: Optional[float] = None
    discount_percent: Optional[float] = None
    discount_amount: Optional[float] = None
    service_fee: Optional[float] = None
    service_fee_name: Optional[str] = None
    deposit_amount: Optional[float] = None
    status: Optional[str] = None
    manager_id: Optional[int] = None


@router.put("/{order_id}")
async def update_order_finance(
    order_id: int,
    data: OrderFinanceUpdate,
    db: Session = Depends(get_rh_db)
):
    """Update order financial fields"""
    fields = []
    params = {"order_id": order_id}
    
    for field in ["total_price", "discount_percent", "discount_amount", 
                  "service_fee", "service_fee_name", "deposit_amount", "status", "manager_id"]:
        val = getattr(data, field, None)
        if val is not None:
            fields.append(f"{field} = :{field}")
            params[field] = val
    
    if not fields:
        raise HTTPException(400, "No fields to update")
    
    fields.append("updated_at = NOW()")
    db.execute(text(f"UPDATE orders SET {', '.join(fields)} WHERE order_id = :order_id"), params)
    db.commit()
    return {"ok": True}


@router.get("/{order_id}/payments")
async def get_order_payments(order_id: int, db: Session = Depends(get_rh_db)):
    """Get all payments for an order"""
    rows = db.execute(text("""
        SELECT fp.id, fp.payment_type, fp.method, fp.amount, fp.occurred_at, fp.note, fp.status,
               fp.tx_id, fp.currency
        FROM fin_payments fp
        WHERE fp.order_id = :oid
        ORDER BY fp.occurred_at DESC
    """), {"oid": order_id}).fetchall()
    
    return {"payments": [{
        "id": r[0], "payment_type": r[1], "method": r[2],
        "amount": float(r[3]), "occurred_at": r[4].isoformat() if r[4] else None,
        "note": r[5], "status": r[6], "tx_id": r[7], "currency": r[8]
    } for r in rows]}


class PaymentCreate(BaseModel):
    payment_type: str  # rent, deposit, damage, additional
    method: str  # cash, bank
    amount: float
    occurred_at: Optional[str] = None
    note: Optional[str] = ""


@router.post("/{order_id}/payments")
async def add_payment(order_id: int, data: PaymentCreate, db: Session = Depends(get_rh_db)):
    """Add a payment to an order"""
    occurred = datetime.fromisoformat(data.occurred_at) if data.occurred_at else datetime.now()
    
    # Create fin_transaction first
    tx_type_map = {"rent": "rent_payment", "additional": "additional_payment", 
                   "deposit": "deposit_payment", "damage": "damage_payment"}
    tx_type = tx_type_map.get(data.payment_type, "rent_payment")
    
    db.execute(text("""
        INSERT INTO fin_transactions (tx_type, status, currency, amount, occurred_at, note, entity_type, entity_id, created_at)
        VALUES (:tx_type, 'completed', 'UAH', :amount, :occurred_at, :note, 'order', :order_id, NOW())
    """), {"tx_type": tx_type, "amount": data.amount, "occurred_at": occurred, 
           "note": data.note, "order_id": order_id})
    
    tx_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
    
    db.execute(text("""
        INSERT INTO fin_payments (payment_type, method, amount, currency, occurred_at, order_id, tx_id, status, note, created_at)
        VALUES (:ptype, :method, :amount, 'UAH', :occurred_at, :order_id, :tx_id, 'confirmed', :note, NOW())
    """), {"ptype": data.payment_type, "method": data.method, "amount": data.amount,
           "occurred_at": occurred, "order_id": order_id, "tx_id": tx_id, "note": data.note})
    
    db.commit()
    return {"ok": True, "tx_id": tx_id}


@router.delete("/{order_id}/payments/{payment_id}")
async def delete_payment(order_id: int, payment_id: int, db: Session = Depends(get_rh_db)):
    """Delete a payment and its transaction"""
    row = db.execute(text(
        "SELECT tx_id FROM fin_payments WHERE id = :pid AND order_id = :oid"
    ), {"pid": payment_id, "oid": order_id}).fetchone()
    
    if not row:
        raise HTTPException(404, "Payment not found")
    
    tx_id = row[0]
    if tx_id:
        db.execute(text("DELETE FROM fin_ledger_entries WHERE tx_id = :tx_id"), {"tx_id": tx_id})
        db.execute(text("DELETE FROM fin_transactions WHERE id = :tx_id"), {"tx_id": tx_id})
    
    db.execute(text("DELETE FROM fin_payments WHERE id = :pid"), {"pid": payment_id})
    db.commit()
    return {"ok": True}


class PaymentUpdate(BaseModel):
    amount: Optional[float] = None
    method: Optional[str] = None
    occurred_at: Optional[str] = None
    note: Optional[str] = None
    payment_type: Optional[str] = None


@router.put("/{order_id}/payments/{payment_id}")
async def update_payment(order_id: int, payment_id: int, data: PaymentUpdate, db: Session = Depends(get_rh_db)):
    """Update a payment"""
    row = db.execute(text(
        "SELECT tx_id FROM fin_payments WHERE id = :pid AND order_id = :oid"
    ), {"pid": payment_id, "oid": order_id}).fetchone()
    if not row:
        raise HTTPException(404, "Payment not found")
    
    fields_fp = []
    fields_tx = []
    params = {"pid": payment_id, "tx_id": row[0]}
    
    if data.amount is not None:
        fields_fp.append("amount = :amount")
        fields_tx.append("amount = :amount")
        params["amount"] = data.amount
    if data.method is not None:
        fields_fp.append("method = :method")
        params["method"] = data.method
    if data.occurred_at is not None:
        fields_fp.append("occurred_at = :occurred_at")
        fields_tx.append("occurred_at = :occurred_at")
        params["occurred_at"] = data.occurred_at
    if data.note is not None:
        fields_fp.append("note = :note")
        fields_tx.append("note = :note")
        params["note"] = data.note
    if data.payment_type is not None:
        fields_fp.append("payment_type = :payment_type")
        params["payment_type"] = data.payment_type
    
    if fields_fp:
        db.execute(text(f"UPDATE fin_payments SET {', '.join(fields_fp)} WHERE id = :pid"), params)
    if fields_tx and row[0]:
        db.execute(text(f"UPDATE fin_transactions SET {', '.join(fields_tx)} WHERE id = :tx_id"), params)
    
    db.commit()
    return {"ok": True}
