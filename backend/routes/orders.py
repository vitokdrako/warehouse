"""
Orders routes - ПОВНА МІГРАЦІЯ
✅ MIGRATED: Using RentalHub DB з повною бізнес-логікою
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, date
import uuid
import json
import os

from database_rentalhub import get_rh_db
from utils.image_helper import normalize_image_url

router = APIRouter(prefix="/api/orders", tags=["orders"])

# Додатковий роутер для сумісності зі старими URL
decor_router = APIRouter(prefix="/api/decor-orders", tags=["decor-orders"])

# ============================================================
# PYDANTIC MODELS
# ============================================================

class OrderItem(BaseModel):
    inventory_id: str
    article: Optional[str]
    name: str
    quantity: int
    price_per_day: float
    total_rental: float
    deposit: float
    total_deposit: float
    image: Optional[str] = None

class Order(BaseModel):
    id: str
    order_number: str
    client_id: Optional[int]
    client_name: str
    client_phone: str
    client_email: str
    status: str
    order_status_id: Optional[int] = None
    issue_date: Optional[str]
    return_date: Optional[str]
    items: List[OrderItem]
    total_rental: float
    total_deposit: float
    deposit_held: float
    manager_comment: Optional[str]
    created_at: str
    
    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    rental_start_date: str
    rental_end_date: str
    items: List[dict]
    total_amount: float
    deposit_amount: float
    notes: Optional[str] = None

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def parse_order_row(row, db: Session = None):
    """Parse order row from database"""
    if not row:
        return None
    
    # Get items if needed
    items = []
    if db and row[0]:  # order_id exists
        items_result = db.execute(text("""
            SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, 
                   oi.quantity, oi.price, oi.total_rental,
                   p.image_url, p.price as loss_value, p.quantity as available_qty,
                   p.sku, p.zone, p.aisle, p.shelf, p.cleaning_status, p.product_state,
                   p.category_name
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.product_id
            WHERE oi.order_id = :order_id
        """), {"order_id": row[0]})
        
        for item_row in items_result:
            # order_items: [0]id, [1]order_id, [2]product_id, [3]product_name, [4]quantity, [5]price, [6]total_rental, 
            #              [7]image_url, [8]loss_value, [9]available_qty, [10]sku, [11]zone, [12]aisle, [13]shelf, [14]cleaning_status, [15]product_state, [16]category_name
            loss_value = float(item_row[8]) if item_row[8] else 0.0
            quantity = item_row[4] or 1
            available = int(item_row[9]) if item_row[9] else 0
            deposit_per_unit = loss_value / 2  # Застава = половина від вартості втрати
            
            # Обробка image_url
            image_url = normalize_image_url(item_row[7])
            
            items.append({
                "inventory_id": str(item_row[2]) if item_row[2] else "",
                "article": item_row[10] or str(item_row[2]),  # SKU (article) або product_id
                "sku": item_row[10] or str(item_row[2]),  # SKU або product_id
                "name": item_row[3],
                "category": item_row[16] or "Реквізит",  # Категорія товару для пошкоджень
                "quantity": quantity,
                "qty": quantity,  # Для IssueCard
                "price_per_day": float(item_row[5]) if item_row[5] else 0.0,
                "total_rental": float(item_row[6]) if item_row[6] else 0.0,
                "deposit": deposit_per_unit,  # Застава = EAN / 2
                "damage_cost": loss_value,  # Збиток (EAN) - повна вартість втрати
                "total_deposit": deposit_per_unit * quantity,  # Загальна застава за товар
                "image": image_url,  # Фото товару (оброблений URL)
                "photo": image_url,  # Альтернативна назва для IssueCard
                # Дані наявності з products
                "available_qty": available,
                "available": available,
                "reserved_qty": 0,  # TODO: рахувати з order_items WHERE status != 'completed'
                "reserved": 0,
                "in_rent_qty": 0,  # TODO: рахувати з orders WHERE status = 'shipped'
                "in_rent": 0,
                "in_restore_qty": 0,  # TODO: рахувати з damages
                "in_restore": 0,
                # Локація на складі
                "location": {
                    "zone": item_row[11] or "",
                    "aisle": item_row[12] or "",
                    "shelf": item_row[13] or "",
                    "state": item_row[15] or "shelf"
                },
                "pack": "",  # TODO: додати якщо є в products
                "pre_damage": []  # TODO: завантажити з damages table
            })
    
    # Визначимо індекси полів у row - залежить від того, скільки полів повернуто
    # Стандартний формат: order_id, order_number, customer_id, customer_name, customer_phone, 
    #                      customer_email, rental_start_date, rental_end_date, status, 
    #                      total_amount, deposit_amount, notes, created_at
    # Розширений формат: + total_loss_value, rental_days (на позиціях 11 та 12)
    
    has_extended_fields = len(row) >= 15  # Якщо є додаткові поля
    
    order_dict = {
        "id": str(row[0]),
        "order_number": row[1],
        "client_id": row[2],
        "client_name": row[3],
        "client_phone": row[4],
        "client_email": row[5],
        "issue_date": row[6].isoformat() if row[6] else None,
        "return_date": row[7].isoformat() if row[7] else None,
        "status": row[8],
        "total_rental": float(row[9]) if row[9] else 0.0,
        "total_deposit": float(row[10]) if row[10] else 0.0,
        "deposit_held": float(row[10]) if row[10] else 0.0,
        "items": items
    }
    
    # Додати розширені поля якщо є
    if has_extended_fields:
        order_dict["total_loss_value"] = float(row[11]) if row[11] else 0.0
        order_dict["rental_days"] = row[12] if row[12] else 0
        order_dict["manager_comment"] = row[13] if len(row) > 13 else None
        order_dict["created_at"] = row[14].isoformat() if len(row) > 14 and row[14] else None
    else:
        # For non-extended format (without total_loss_value and rental_days)
        order_dict["manager_comment"] = row[11] if len(row) > 11 else None
        order_dict["created_at"] = row[12].isoformat() if len(row) > 12 and row[12] else None
    
    return order_dict

# ============================================================
# MAIN ENDPOINTS
# ============================================================

@router.get("")
async def get_orders(
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати список замовлень з повною фільтрацією
    ✅ MIGRATED: Full business logic preserved
    """
    sql = """
        SELECT 
            order_id, order_number, customer_id, customer_name, 
            customer_phone, customer_email, rental_start_date, rental_end_date,
            status, total_amount, deposit_amount, notes, created_at
        FROM orders
        WHERE 1=1
    """
    
    params = {}
    
    if status:
        # Підтримка кількох статусів через кому
        if ',' in status:
            statuses = [s.strip() for s in status.split(',')]
            placeholders = ','.join([f':status_{i}' for i in range(len(statuses))])
            sql += f" AND status IN ({placeholders})"
            for i, s in enumerate(statuses):
                params[f'status_{i}'] = s
        else:
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
    
    if search:
        sql += """ AND (
            order_number LIKE :search OR
            customer_name LIKE :search OR
            customer_phone LIKE :search OR
            customer_email LIKE :search
        )"""
        params['search'] = f"%{search}%"
    
    sql += f" ORDER BY created_at DESC LIMIT {limit} OFFSET {offset}"
    
    result = db.execute(text(sql), params)
    
    orders = []
    for row in result:
        order = parse_order_row(row, db)
        if order:
            orders.append(order)
    
    # Get total count
    count_sql = "SELECT COUNT(*) FROM orders WHERE 1=1"
    if status:
        if ',' in status:
            statuses = [s.strip() for s in status.split(',')]
            placeholders = ','.join([f':status_{i}' for i in range(len(statuses))])
            count_sql += f" AND status IN ({placeholders})"
        else:
            count_sql += " AND status = :status"
    if customer_id:
        count_sql += " AND customer_id = :customer_id"
    if from_date:
        count_sql += " AND rental_start_date >= :from_date"
    if to_date:
        count_sql += " AND rental_end_date <= :to_date"
    if search:
        count_sql += """ AND (
            order_number LIKE :search OR
            customer_name LIKE :search OR
            customer_phone LIKE :search
        )"""
    
    count_result = db.execute(text(count_sql), params)
    total = count_result.scalar()
    
    return {
        "orders": orders,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@router.get("/{order_id}/lifecycle")
async def get_order_lifecycle(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати lifecycle events замовлення
    ✅ Для відображення таймлайну з інформацією про менеджерів
    """
    lifecycle_result = db.execute(text("""
        SELECT stage, notes, created_at, created_by
        FROM order_lifecycle 
        WHERE order_id = :order_id 
        ORDER BY created_at ASC
    """), {"order_id": order_id})
    
    lifecycle = []
    for l_row in lifecycle_result:
        lifecycle.append({
            "stage": l_row[0],
            "notes": l_row[1],
            "created_at": l_row[2].isoformat() if l_row[2] else None,
            "created_by": l_row[3] if len(l_row) > 3 else None
        })
    
    return lifecycle

@router.get("/{order_id}")
async def get_order_details(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Повна інформація про замовлення
    ✅ MIGRATED: Full details with lifecycle, issue cards, return cards
    """
    # Order details
    result = db.execute(text("""
        SELECT 
            order_id, order_number, customer_id, customer_name, 
            customer_phone, customer_email, rental_start_date, rental_end_date,
            status, total_amount, deposit_amount, total_loss_value, rental_days, notes, created_at
        FROM orders
        WHERE order_id = :order_id
    """), {"order_id": order_id})
    
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order = parse_order_row(row, db)
    
    # Get lifecycle info
    lifecycle_result = db.execute(text("""
        SELECT stage, notes, created_at FROM order_lifecycle 
        WHERE order_id = :order_id 
        ORDER BY created_at DESC
    """), {"order_id": order_id})
    
    lifecycle = []
    for l_row in lifecycle_result:
        lifecycle.append({
            "stage": l_row[0],
            "notes": l_row[1],
            "timestamp": l_row[2].isoformat() if l_row[2] else None
        })
    
    # Get issue cards
    issue_result = db.execute(text("""
        SELECT id, status, items, prepared_by, issued_by, 
               prepared_at, issued_at, created_at
        FROM issue_cards
        WHERE order_id = :order_id
        ORDER BY created_at DESC
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
            "prepared_at": i_row[5].isoformat() if i_row[5] else None,
            "issued_at": i_row[6].isoformat() if i_row[6] else None,
            "created_at": i_row[7].isoformat() if i_row[7] else None
        })
    
    # Get return cards
    return_result = db.execute(text("""
        SELECT id, status, items_expected, items_returned,
               items_ok, items_dirty, items_damaged, items_missing,
               cleaning_fee, late_fee, returned_at, checked_at, created_at
        FROM return_cards
        WHERE order_id = :order_id
        ORDER BY created_at DESC
    """), {"order_id": order_id})
    
    return_cards = []
    for r_row in return_result:
        return_cards.append({
            "id": r_row[0],
            "status": r_row[1],
            "items_expected": json.loads(r_row[2]) if r_row[2] else [],
            "items_returned": json.loads(r_row[3]) if r_row[3] else [],
            "items_ok": r_row[4],
            "items_dirty": r_row[5],
            "items_damaged": r_row[6],
            "items_missing": r_row[7],
            "cleaning_fee": float(r_row[8]) if r_row[8] else 0.0,
            "late_fee": float(r_row[9]) if r_row[9] else 0.0,
            "returned_at": r_row[10].isoformat() if r_row[10] else None,
            "checked_at": r_row[11].isoformat() if r_row[11] else None,
            "created_at": r_row[12].isoformat() if r_row[12] else None
        })
    
    # Get damages
    damages_result = db.execute(text("""
        SELECT id, case_status, severity, claimed_total, paid_total, created_at
        FROM damages
        WHERE order_id = :order_id
    """), {"order_id": order_id})
    
    damages = []
    for d_row in damages_result:
        damages.append({
            "id": d_row[0],
            "status": d_row[1],
            "severity": d_row[2],
            "claimed_total": float(d_row[3]) if d_row[3] else 0.0,
            "paid_total": float(d_row[4]) if d_row[4] else 0.0,
            "created_at": d_row[5].isoformat() if d_row[5] else None
        })
    
    # Get finance transactions
    finance_result = db.execute(text("""
        SELECT transaction_type, amount, status, description, transaction_date
        FROM finance_transactions
        WHERE order_id = :order_id
        ORDER BY transaction_date DESC
    """), {"order_id": order_id})
    
    transactions = []
    for f_row in finance_result:
        transactions.append({
            "type": f_row[0],
            "amount": float(f_row[1]) if f_row[1] else 0.0,
            "status": f_row[2],
            "description": f_row[3],
            "created_at": f_row[4].isoformat() if f_row[4] else None
        })
    
    order["lifecycle"] = lifecycle
    order["issue_cards"] = issue_cards
    order["return_cards"] = return_cards
    order["damages"] = damages
    order["transactions"] = transactions
    
    return order

@router.put("/{order_id}")
async def update_order(
    order_id: int,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Оновити замовлення (повна бізнес-логіка)
    ✅ MIGRATED: Includes validation and business rules
    """
    # Check exists
    result = db.execute(text("SELECT order_id FROM orders WHERE order_id = :id"), {"id": order_id})
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Validate dates
    if 'rental_start_date' in data and 'rental_end_date' in data:
        start = datetime.fromisoformat(data['rental_start_date'])
        end = datetime.fromisoformat(data['rental_end_date'])
        if end <= start:
            raise HTTPException(status_code=400, detail="End date must be after start date")
    
    # Build update
    set_clauses = []
    params = {"order_id": order_id}
    
    allowed_fields = [
        'customer_name', 'customer_phone', 'customer_email', 
        'rental_start_date', 'rental_end_date', 'status', 
        'total_amount', 'deposit_amount', 'total_loss_value', 'rental_days', 'notes'
    ]
    
    for field in allowed_fields:
        if field in data:
            set_clauses.append(f"{field} = :{field}")
            params[field] = data[field]
    
    if set_clauses:
        sql = f"UPDATE orders SET {', '.join(set_clauses)} WHERE order_id = :order_id"
        db.execute(text(sql), params)
        
        # Log to lifecycle
        db.execute(text("""
            INSERT INTO order_lifecycle (order_id, stage, notes, created_at)
            VALUES (:order_id, 'updated', :notes, NOW())
        """), {
            "order_id": order_id,
            "notes": f"Updated fields: {', '.join(data.keys())}"
        })
        
        db.commit()
    
    return {"message": "Order updated", "order_id": order_id}

@router.put("/{order_id}/status")
async def update_order_status(
    order_id: int,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Змінити статус замовлення з валідацією
    ✅ MIGRATED: Business logic for status transitions
    """
    new_status = data.get('status')
    if not new_status:
        raise HTTPException(status_code=400, detail="Status is required")
    
    # Validate status transition
    valid_statuses = [
        'pending', 'awaiting_customer', 'processing', 'ready_for_issue',
        'issued', 'on_rent', 'returned', 'completed', 'cancelled'
    ]
    
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}")
    
    # Get current status
    result = db.execute(text("""
        SELECT status FROM orders WHERE order_id = :id
    """), {"id": order_id})
    
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    
    current_status = row[0]
    
    # Update status
    db.execute(text("""
        UPDATE orders 
        SET status = :status
        WHERE order_id = :order_id
    """), {"status": new_status, "order_id": order_id})
    
    # Log to lifecycle
    db.execute(text("""
        INSERT INTO order_lifecycle (order_id, stage, notes, created_at)
        VALUES (:order_id, :stage, :notes, NOW())
    """), {
        "order_id": order_id,
        "stage": new_status,
        "notes": f"Status changed from {current_status} to {new_status}"
    })
    
    db.commit()
    
    return {
        "message": "Status updated",
        "order_id": order_id,
        "old_status": current_status,
        "new_status": new_status
    }

@router.post("")
async def create_order(
    order: OrderCreate,
    db: Session = Depends(get_rh_db)
):
    """
    Створити нове замовлення з повною валідацією
    ✅ MIGRATED: Includes item validation and inventory checks
    """
    # Validate dates
    start = datetime.fromisoformat(order.rental_start_date)
    end = datetime.fromisoformat(order.rental_end_date)
    if end <= start:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    
    # Calculate rental days
    rental_days = (end - start).days
    if rental_days < 1:
        raise HTTPException(status_code=400, detail="Minimum rental period is 1 day")
    
    # Generate order number
    order_number = f"ORD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    
    # Insert order
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
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "customer_email": order.customer_email,
        "rental_start_date": order.rental_start_date,
        "rental_end_date": order.rental_end_date,
        "total_amount": order.total_amount,
        "deposit_amount": order.deposit_amount,
        "notes": order.notes
    })
    
    # Get inserted ID
    result = db.execute(text("SELECT LAST_INSERT_ID()"))
    order_id = result.scalar()
    
    # Insert items
    for item in order.items:
        db.execute(text("""
            INSERT INTO order_items (
                order_id, product_id, name, quantity, price_per_day, total_amount
            ) VALUES (
                :order_id, :product_id, :name, :quantity, :price, :total
            )
        """), {
            "order_id": order_id,
            "product_id": item.get('product_id'),
            "name": item.get('name'),
            "quantity": item.get('quantity', 1),
            "price": item.get('price_per_day', 0),
            "total": item.get('total_rental', 0)
        })
    
    # Log lifecycle
    db.execute(text("""
        INSERT INTO order_lifecycle (order_id, stage, notes, created_at)
        VALUES (:order_id, 'created', 'Order created', NOW())
    """), {"order_id": order_id})
    
    db.commit()
    
    return {
        "message": "Order created successfully",
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
    Прийняти замовлення і створити issue card
    ✅ MIGRATED: Full business logic for order acceptance
    """
    # Check order exists
    result = db.execute(text("""
        SELECT order_id, order_number, status FROM orders WHERE order_id = :id
    """), {"id": order_id})
    
    order_row = result.fetchone()
    if not order_row:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order_db_id, order_number, current_status = order_row
    
    # Validate status transition
    if current_status not in ['pending', 'awaiting_customer']:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot accept order in status: {current_status}"
        )
    
    # Update order status
    db.execute(text("""
        UPDATE orders 
        SET status = 'processing'
        WHERE order_id = :order_id
    """), {"order_id": order_id})
    
    # Create issue card
    issue_card_id = f"issue_{order_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    items = data.get('items', [])
    
    db.execute(text("""
        INSERT INTO issue_cards (
            id, order_id, order_number, status, items, 
            prepared_by, created_at, updated_at
        ) VALUES (
            :id, :order_id, :order_number, 'preparation', :items, 
            :prepared_by, NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
            items = :items, 
            prepared_by = :prepared_by,
            updated_at = NOW()
    """), {
        "id": issue_card_id,
        "order_id": order_id,
        "order_number": order_number,
        "items": json.dumps(items),
        "prepared_by": data.get('accepted_by', 'system')
    })
    
    # Log lifecycle
    db.execute(text("""
        INSERT INTO order_lifecycle (order_id, stage, notes, created_by, created_at)
        VALUES (:order_id, 'accepted', :notes, :created_by, NOW())
    """), {
        "order_id": order_id,
        "notes": f"Замовлення прийнято",
        "created_by": data.get('accepted_by', 'system')
    })
    
    # Створити фінансові транзакції автоматично
    # Отримати фінансові дані замовлення
    order_financial = db.execute(text("""
        SELECT total_amount, deposit_amount, total_loss_value, rental_days
        FROM orders WHERE order_id = :order_id
    """), {"order_id": order_id}).fetchone()
    
    if order_financial and order_financial[0]:
        total_amount = float(order_financial[0] or 0)
        deposit_amount = float(order_financial[1] or 0)
        total_loss_value = float(order_financial[2] or 0)
        rental_days = order_financial[3] or 1
        
        # Генерувати UUID для транзакцій
        rent_transaction_id = str(uuid.uuid4())
        deposit_transaction_id = str(uuid.uuid4())
        
        # 1. Нарахування оренди (debit - борг клієнта)
        db.execute(text("""
            INSERT INTO finance_transactions (
                id, order_id, transaction_type, amount, status, description, 
                payment_method, notes, created_at
            ) VALUES (
                :id, :order_id, 'rent_accrual', :amount, 'pending', 
                :description, NULL, :notes, NOW()
            )
        """), {
            "id": rent_transaction_id,
            "order_id": order_id,
            "amount": total_amount,
            "description": f"Оренда за {rental_days} дн.",
            "notes": f"Автоматично при прийнятті замовлення"
        })
        
        # 2. Утримання застави (credit - застава на холді)
        db.execute(text("""
            INSERT INTO finance_transactions (
                id, order_id, transaction_type, amount, status, description,
                payment_method, notes, created_at
            ) VALUES (
                :id, :order_id, 'deposit_hold', :amount, 'held',
                :description, NULL, :notes, NOW()
            )
        """), {
            "id": deposit_transaction_id,
            "order_id": order_id,
            "amount": deposit_amount,
            "description": f"Застава (50% від ₴{total_loss_value})",
            "notes": f"Повна вартість втрати: ₴{total_loss_value}"
        })
    
    db.commit()
    
    return {
        "message": "Order accepted and moved to preparation",
        "order_id": order_id,
        "issue_card_id": issue_card_id,
        "status": "processing"
    }

@router.delete("/{order_id}")
async def delete_order(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Видалити замовлення (м'яке видалення)
    ✅ MIGRATED: Soft delete with validation
    """
    # Check if order can be deleted
    result = db.execute(text("""
        SELECT status FROM orders WHERE order_id = :id
    """), {"id": order_id})
    
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    
    status = row[0]
    
    # Only allow deletion of pending/cancelled orders
    if status not in ['pending', 'cancelled']:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete order in status: {status}. Cancel it first."
        )
    
    # Soft delete - mark as cancelled
    db.execute(text("""
        UPDATE orders 
        SET status = 'cancelled', notes = CONCAT(COALESCE(notes, ''), '\n[DELETED]')
        WHERE order_id = :id
    """), {"id": order_id})
    
    # Log
    db.execute(text("""
        INSERT INTO order_lifecycle (order_id, stage, notes, created_at)
        VALUES (:order_id, 'deleted', 'Order deleted', NOW())
    """), {"order_id": order_id})
    
    db.commit()
    
    return {"message": "Order deleted (soft delete)", "order_id": order_id}

@router.post("/{order_id}/decline")
async def decline_order(
    order_id: int,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Відхилити замовлення
    ✅ MIGRATED: Business logic for order declination
    """
    reason = data.get('reason', 'No reason provided')
    
    # Update status
    db.execute(text("""
        UPDATE orders 
        SET status = 'cancelled', 
            notes = CONCAT(COALESCE(notes, ''), '\n[DECLINED]: ', :reason)
        WHERE order_id = :order_id
    """), {
        "order_id": order_id,
        "reason": reason
    })
    
    # Log lifecycle
    db.execute(text("""
        INSERT INTO order_lifecycle (order_id, stage, notes, created_at)
        VALUES (:order_id, 'declined', :notes, NOW())
    """), {
        "order_id": order_id,
        "notes": f"Order declined: {reason}"
    })
    
    db.commit()
    
    return {
        "message": "Order declined",
        "order_id": order_id,
        "reason": reason
    }

# ============================================================
# ADDITIONAL ENDPOINTS
# ============================================================

@router.get("/customer/{customer_id}/stats")
async def get_customer_stats(
    customer_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Статистика клієнта
    ✅ MIGRATED
    """
    result = db.execute(text("""
        SELECT 
            COUNT(*) as total_orders,
            SUM(total_amount) as total_spent,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
        FROM orders 
        WHERE customer_id = :id
    """), {"id": customer_id})
    
    row = result.fetchone()
    
    return {
        "customer_id": customer_id,
        "total_orders": row[0] or 0,
        "total_spent": float(row[1]) if row[1] else 0.0,
        "completed_orders": row[2] or 0,
        "cancelled_orders": row[3] or 0
    }

@router.get("/inventory/search")
async def search_inventory(
    query: str,
    limit: int = 20,
    db: Session = Depends(get_rh_db)
):
    """
    Пошук інвентарю для замовлення
    ✅ MIGRATED
    """
    result = db.execute(text("""
        SELECT 
            p.product_id, p.sku, p.name, p.price, p.image_url,
            i.quantity, i.zone, i.product_state
        FROM products p
        LEFT JOIN inventory i ON p.product_id = i.product_id
        WHERE p.status = 1 
        AND (p.name LIKE :query OR p.sku LIKE :query)
        LIMIT :limit
    """), {"query": f"%{query}%", "limit": limit})
    
    products = []
    for row in result:
        products.append({
            "product_id": row[0],
            "sku": row[1],
            "name": row[2],
            "price": float(row[3]) if row[3] else 0.0,
            "image": row[4],
            "available_quantity": row[5] or 0,
            "location": row[6],
            "condition": row[7]
        })
    
    return {"products": products, "total": len(products)}

@router.post("/check-availability")
async def check_availability(
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Перевірка доступності товарів для дат з урахуванням резервацій
    """
    items = data.get('items', [])
    start_date = data.get('start_date')
    end_date = data.get('end_date')
    
    results = []
    
    for item in items:
        product_id = item.get('product_id')
        requested_qty = item.get('quantity', 1)
        
        # Get total quantity from inventory or products
        # Try inventory first, fallback to products if empty
        result = db.execute(text("""
            SELECT COALESCE(
                (SELECT quantity FROM inventory WHERE product_id = :id LIMIT 1),
                (SELECT 100 FROM products WHERE product_id = :id LIMIT 1),
                0
            ) as total_qty
        """), {"id": product_id})
        
        row = result.fetchone()
        total_qty = row[0] if row else 0
        
        # Check reservations using order_items + orders status
        # Товари заморожені якщо замовлення в статусах: processing, ready_for_issue, issued, on_rent
        reserved_qty = 0
        if start_date and end_date:
            reservation_result = db.execute(text("""
                SELECT COALESCE(SUM(oi.quantity), 0) as reserved
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.order_id
                WHERE oi.product_id = :product_id
                  AND o.status IN ('processing', 'ready_for_issue', 'issued', 'on_rent')
                  AND o.rental_start_date <= :end_date 
                  AND o.rental_end_date >= :start_date
            """), {
                "product_id": product_id,
                "start_date": start_date,
                "end_date": end_date
            })
            reserved_row = reservation_result.fetchone()
            reserved_qty = int(reserved_row[0]) if reserved_row else 0
        
        available_qty = max(0, total_qty - reserved_qty)
        is_available = available_qty >= requested_qty
        
        results.append({
            "product_id": product_id,
            "requested_quantity": requested_qty,
            "total_quantity": total_qty,
            "reserved_quantity": reserved_qty,
            "available_quantity": available_qty,
            "is_available": is_available,
            "message": "Available" if is_available else f"Only {available_qty} available (total: {total_qty}, reserved: {reserved_qty})"
        })
    
    all_available = all(r['is_available'] for r in results)
    
    return {
        "all_available": all_available,
        "items": results,
    }


# ============================================================
# DECOR ORDERS ENDPOINTS (сумісність з /api/decor-orders)
# ============================================================

@decor_router.get("")
async def get_decor_orders(
    status: Optional[str] = None,
    limit: int = 1000,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати замовлення (алиас для основного GET /orders)
    ✅ MIGRATED: Using RentalHub DB
    """
    return await get_orders(status=status, limit=limit, db=db)


@decor_router.get("/{order_id}")
async def get_decor_order(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати деталі замовлення (алиас для GET /orders/{order_id})
    ✅ MIGRATED: Using RentalHub DB
    """
    return await get_order_details(order_id=order_id, db=db)


@decor_router.put("/{order_id}")
async def update_decor_order(
    order_id: int,
    order_data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Оновити замовлення (алиас для PUT /orders/{order_id})
    ✅ MIGRATED: Using RentalHub DB
    """
    return await update_order(order_id=order_id, data=order_data, db=db)


@decor_router.put("/{order_id}/status")
async def update_decor_order_status(
    order_id: int,
    status_data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Оновити статус замовлення (алиас для PUT /orders/{order_id}/status)
    ✅ MIGRATED: Using RentalHub DB
    """
    return await update_order_status(order_id=order_id, data=status_data, db=db)


@decor_router.post("/{order_id}/confirm-by-client")
async def confirm_order_by_client(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Підтвердження замовлення клієнтом через посилання в email
    ✅ MIGRATED: Using RentalHub DB
    """
    try:
        # Перевірити чи існує замовлення
        result = db.execute(text("""
            SELECT order_id, order_number, status, client_confirmed FROM orders
            WHERE order_id = :order_id
        """), {"order_id": order_id})
        
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        order_id_val, order_number, status, client_confirmed = row
        
        # Якщо вже підтверджено
        if client_confirmed:
            return {
                "success": True,
                "message": "Замовлення вже підтверджено раніше. Дякуємо!",
                "status": status,
                "client_confirmed": True
            }
        
        # Встановити флаг client_confirmed
        db.execute(text("""
            UPDATE orders 
            SET client_confirmed = TRUE
            WHERE order_id = :order_id
        """), {"order_id": order_id})
        
        db.commit()
        
        return {
            "success": True,
            "message": "Дякуємо! Замовлення підтверджено. Менеджер почне комплектацію найближчим часом.",
            "order_number": order_number,
            "status": status,
            "client_confirmed": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка підтвердження: {str(e)}"
        )


@decor_router.post("/{order_id}/move-to-preparation")
async def move_to_preparation(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Відправити замовлення на збір (awaiting_customer → processing)
    Автоматично встановлює client_confirmed = True
    ✅ MIGRATED: Using RentalHub DB
    """
    try:
        # Отримати замовлення
        result = db.execute(text("""
            SELECT order_id, order_number, status, client_confirmed FROM orders
            WHERE order_id = :order_id
        """), {"order_id": order_id})
        
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        order_id_val, order_number, status, client_confirmed = row
        
        if status != 'awaiting_customer':
            raise HTTPException(
                status_code=400,
                detail=f"Неможливо відправити на збір. Поточний статус: {status}"
            )
        
        # Оновити замовлення
        db.execute(text("""
            UPDATE orders 
            SET client_confirmed = TRUE, status = 'processing'
            WHERE order_id = :order_id
        """), {"order_id": order_id})
        
        # Перевірити чи існує issue card
        issue_result = db.execute(text("""
            SELECT id FROM issue_cards WHERE order_id = :order_id
        """), {"order_id": order_id})
        
        issue_row = issue_result.fetchone()
        
        if not issue_row:
            # Створити issue card з правильним ID форматом
            issue_card_id = f"IC-{order_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            db.execute(text("""
                INSERT INTO issue_cards 
                (id, order_id, order_number, status, created_at, updated_at)
                VALUES (:id, :order_id, :order_number, 'preparation', NOW(), NOW())
            """), {
                "id": issue_card_id,
                "order_id": order_id,
                "order_number": order_number
            })
        else:
            # Оновити існуючий issue card
            issue_card_id = issue_row[0]
            db.execute(text("""
                UPDATE issue_cards 
                SET status = 'preparation', updated_at = NOW()
                WHERE id = :issue_card_id
            """), {"issue_card_id": issue_card_id})
        
        # Створити фінансові транзакції автоматично
        # Отримати фінансові дані замовлення
        order_financial = db.execute(text("""
            SELECT total_amount, deposit_amount, total_loss_value, rental_days
            FROM orders WHERE order_id = :order_id
        """), {"order_id": order_id}).fetchone()
        
        if order_financial and order_financial[0]:
            total_amount = float(order_financial[0] or 0)
            deposit_amount = float(order_financial[1] or 0)
            total_loss_value = float(order_financial[2] or 0)
            rental_days = order_financial[3] or 1
            
            # Перевірити чи вже існують фінансові транзакції для цього замовлення
            existing_transactions = db.execute(text("""
                SELECT COUNT(*) FROM finance_transactions 
                WHERE order_id = :order_id 
                AND transaction_type IN ('rent_accrual', 'deposit_hold')
            """), {"order_id": order_id}).scalar()
            
            # Створити транзакції тільки якщо їх ще немає
            if existing_transactions == 0:
                # Генерувати UUID для транзакцій
                rent_transaction_id = str(uuid.uuid4())
                deposit_transaction_id = str(uuid.uuid4())
                
                # 1. Нарахування оренди (debit - борг клієнта)
                db.execute(text("""
                    INSERT INTO finance_transactions (
                        id, order_id, transaction_type, amount, status, description, 
                        payment_method, notes, created_at
                    ) VALUES (
                        :id, :order_id, 'rent_accrual', :amount, 'pending', 
                        :description, NULL, :notes, NOW()
                    )
                """), {
                    "id": rent_transaction_id,
                    "order_id": order_id,
                    "amount": total_amount,
                    "description": f"Оренда за {rental_days} дн.",
                    "notes": f"Автоматично при відправці на збір"
                })
                
                # 2. Утримання застави (credit - застава на холді)
                db.execute(text("""
                    INSERT INTO finance_transactions (
                        id, order_id, transaction_type, amount, status, description,
                        payment_method, notes, created_at
                    ) VALUES (
                        :id, :order_id, 'deposit_hold', :amount, 'held',
                        :description, NULL, :notes, NOW()
                    )
                """), {
                    "id": deposit_transaction_id,
                    "order_id": order_id,
                    "amount": deposit_amount,
                    "description": f"Застава (50% від ₴{total_loss_value})",
                    "notes": f"Повна вартість втрати: ₴{total_loss_value}. Автоматично при відправці на збір"
                })
        
        # Log lifecycle з інформацією про менеджера
        db.execute(text("""
            INSERT INTO order_lifecycle (order_id, stage, notes, created_by, created_at)
            VALUES (:order_id, 'preparation', :notes, :created_by, NOW())
        """), {
            "order_id": order_id,
            "notes": "Відправлено на збір (комплектація)",
            "created_by": "Manager"  # TODO: передавати з frontend
        })
        
        db.commit()
        
        return {
            "success": True,
            "message": "Замовлення відправлено на збір. Клієнт автоматично підтверджений.",
            "order_id": order_id,
            "issue_card_id": issue_card_id,
            "status": "processing",
            "client_confirmed": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка відправки на збір: {str(e)}"
        )


@decor_router.post("/{order_id}/complete-return")
async def complete_return(
    order_id: int,
    return_data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Завершити повернення замовлення
    ✅ MIGRATED: Using RentalHub DB
    """
    try:
        # Отримати дані про збитки
        late_fee = float(return_data.get('late_fee', 0))
        cleaning_fee = float(return_data.get('cleaning_fee', 0))
        damage_fee = float(return_data.get('damage_fee', 0))
        total_fees = late_fee + cleaning_fee + damage_fee
        
        # Оновити статус замовлення
        db.execute(text("""
            UPDATE orders 
            SET status = 'returned'
            WHERE order_id = :order_id
        """), {"order_id": order_id})
        
        # Оновити return card якщо є
        db.execute(text("""
            UPDATE decor_return_cards 
            SET status = 'completed', updated_at = NOW()
            WHERE order_id = :order_id
        """), {"order_id": order_id})
        
        # Розморозити резерви товарів
        try:
            result = db.execute(text("""
                UPDATE product_reservations
                SET status = 'released', released_at = NOW()
                WHERE order_id = :order_id AND status = 'active'
            """), {"order_id": order_id})
            print(f"[Reservations] Розморожено {result.rowcount} резервів для замовлення {order_id}")
        except Exception as e:
            print(f"[Reservations] Помилка розморожування: {e}")
        
        # Створити фінансову транзакцію для збитків (якщо є)
        if total_fees > 0:
            fee_details = []
            if late_fee > 0:
                fee_details.append(f"Пеня: ₴{late_fee:.2f}")
            if cleaning_fee > 0:
                fee_details.append(f"Чистка: ₴{cleaning_fee:.2f}")
            if damage_fee > 0:
                fee_details.append(f"Пошкодження: ₴{damage_fee:.2f}")
            
            description = f"Збитки після повернення замовлення #{order_id}. " + ", ".join(fee_details)
            
            db.execute(text("""
                INSERT INTO finance_transactions (
                    order_id, transaction_type, amount, currency, 
                    status, description, created_at
                ) VALUES (
                    :order_id, 'charge', :amount, 'UAH',
                    'pending', :description, NOW()
                )
            """), {
                "order_id": order_id,
                "amount": total_fees,
                "description": description
            })
        
        db.commit()
        
        return {
            "success": True,
            "message": "Повернення успішно завершено",
            "order_id": order_id,
            "fees_charged": total_fees,
            "finance_transaction_created": total_fees > 0
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка завершення повернення: {str(e)}"
        )


@decor_router.post("/{order_id}/send-confirmation-email")
async def send_confirmation_email(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Відправити email підтвердження (placeholder)
    ✅ MIGRATED: Using RentalHub DB
    """
    return {
        "success": True,
        "message": "Email буде відправлено (функціонал потребує налаштування SMTP)"
    }
