"""
Finance API - Фінансові операції
✅ MIGRATED: Using RentalHub DB
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from datetime import datetime
import uuid

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/finance", tags=["finance"])

# Додатковий роутер для сумісності зі старими URL
manager_router = APIRouter(prefix="/api/manager/finance", tags=["finance"])

@router.get("/transactions")
@manager_router.get("/transactions")
@manager_router.get("/ledger")  # Алиас для сумісності
async def get_transactions(
    order_id: Optional[int] = None,
    transaction_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати фінансові транзакції з іменами клієнтів
    ✅ MIGRATED: Using RentalHub DB
    """
    # Join with orders table to get client name, expected deposit, manager comment and damage fee
    # ВАЖЛИВО: Беремо manager_notes з issue_cards (внутрішні нотатки менеджера), а не з orders!
    sql = """
        SELECT 
            ft.id, ft.transaction_type, ft.order_id, ft.amount,
            ft.currency, ft.status, ft.description, ft.created_at, ft.payment_method,
            ft.notes, ft.created_by,
            o.customer_name, o.deposit_amount, o.manager_comment, o.damage_fee, o.status as order_status,
            ic.manager_notes
        FROM finance_transactions ft
        LEFT JOIN orders o ON ft.order_id = o.order_id
        LEFT JOIN issue_cards ic ON ic.order_id = o.order_id
        WHERE 1=1
    """
    params = {}
    
    if order_id:
        sql += " AND ft.order_id = :order_id"
        params['order_id'] = order_id
    
    if transaction_type:
        sql += " AND ft.transaction_type = :type"
        params['type'] = transaction_type
    
    if status:
        sql += " AND ft.status = :status"
        params['status'] = status
    
    sql += f" ORDER BY ft.created_at DESC LIMIT {limit}"
    
    result = db.execute(text(sql), params)
    
    transactions = []
    for row in result:
        # Нові індекси після зміни SELECT:
        # 0: id, 1: transaction_type, 2: order_id, 3: amount,
        # 4: currency, 5: status, 6: description, 7: created_at, 8: payment_method,
        # 9: notes, 10: created_by, 11: customer_name, 12: deposit_amount (expected)
        # 13: manager_comment (orders - коментар клієнта), 14: damage_fee, 15: order_status
        # 16: manager_notes (issue_cards - внутрішні нотатки менеджера)
        
        transaction_type = row[1]  # transaction_type
        amount = float(row[3]) if row[3] else 0.0  # amount (index 3)
        description = row[6] or transaction_type.replace('_', ' ').title()
        
        # ВАЖЛИВО: Використовуємо manager_notes з issue_cards (внутрішні нотатки)
        # а не manager_comment з orders (коментар клієнта)!
        manager_notes = row[16] or row[13] or ""  # Пріоритет: issue_cards.manager_notes, потім orders.manager_comment
        damage_fee = float(row[14]) if row[14] else 0.0  # damage_fee з orders
        order_status = row[15] if len(row) > 15 else None  # order status
        
        # Determine debit/credit based on transaction type
        debit = 0.0
        credit = 0.0
        
        if transaction_type in ['rent', 'rent_accrual', 'balance_due', 'damage', 'charge']:
            debit = amount
        elif transaction_type in ['payment', 'prepayment']:
            credit = amount
        elif transaction_type == 'deposit_hold':
            credit = amount
        elif transaction_type in ['deposit_release', 'deposit_writeoff']:
            # These reduce held amount
            pass
        elif transaction_type == 'refund':
            # Refund - повернення оплати (зворотна транзакція payment)
            debit = amount  # Зменшуємо кредит (повертаємо те що було оплачено)
        
        transactions.append({
            "id": row[0],
            "date": row[7].isoformat() if row[7] else None,  # created_at
            "order_id": row[2],
            "type": transaction_type,
            "title": description,  # description
            "payment_method": row[8],  # payment_method
            "debit": debit,
            "credit": credit,
            "amount": amount,
            "currency": row[4] or 'UAH',  # currency
            "status": row[5],  # status
            "counterparty": f"Order #{row[2]}" if row[2] else "N/A",
            "notes": row[9],  # notes
            "created_by": row[10] if len(row) > 10 else None,  # created_by
            "client_name": row[11] if len(row) > 11 else None,  # customer_name
            "expected_deposit": float(row[12]) if len(row) > 12 and row[12] else 0.0,  # deposit_amount from orders
            "manager_comment": manager_comment,  # з orders.manager_comment
            "damage_fee": damage_fee,  # з orders.damage_fee
            "order_status": order_status  # статус замовлення (cancelled, processing, etc)
        })
    
    return transactions

@router.get("/summary")
@manager_router.get("/summary")
async def get_finance_summary(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_rh_db)
):
    """
    Фінансовий підсумок
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
    
    # Total revenue (ОПЛАЧЕНО) - виключаємо cancelled замовлення
    revenue_result = db.execute(text(f"""
        SELECT SUM(ft.amount) 
        FROM finance_transactions ft
        LEFT JOIN orders o ON ft.order_id = o.order_id
        WHERE ft.transaction_type IN ('payment', 'prepayment') 
        AND ft.status = 'completed'
        AND (o.status IS NULL OR o.status != 'cancelled')
        {date_filter}
    """), params)
    total_revenue = revenue_result.scalar() or 0.0
    
    # Total rent accrued (НАРАХОВАНО) - виключаємо cancelled замовлення
    accrued_result = db.execute(text(f"""
        SELECT SUM(ft.amount) 
        FROM finance_transactions ft
        LEFT JOIN orders o ON ft.order_id = o.order_id
        WHERE ft.transaction_type IN ('rent', 'rent_accrual')
        AND (o.status IS NULL OR o.status != 'cancelled')
        {date_filter}
    """), params)
    total_accrued = accrued_result.scalar() or 0.0
    
    # Total deposits held (кількість замовлень з заставами на холді) - виключаємо cancelled
    deposits_result = db.execute(text(f"""
        SELECT COUNT(DISTINCT ft.order_id) 
        FROM finance_transactions ft
        LEFT JOIN orders o ON ft.order_id = o.order_id
        WHERE ft.transaction_type = 'deposit_hold' 
        AND ft.status = 'held'
        AND (o.status IS NULL OR o.status != 'cancelled')
        {date_filter}
    """), params)
    total_deposits = deposits_result.scalar() or 0
    
    # Pending payments - виключаємо cancelled замовлення
    pending_result = db.execute(text(f"""
        SELECT SUM(ft.amount) 
        FROM finance_transactions ft
        LEFT JOIN orders o ON ft.order_id = o.order_id
        WHERE ft.status = 'pending'
        AND (o.status IS NULL OR o.status != 'cancelled')
        {date_filter}
    """), params)
    pending_amount = pending_result.scalar() or 0.0
    
    return {
        "total_revenue": float(total_revenue),  # Оплачено
        "total_accrued": float(total_accrued),  # Нараховано
        "deposits_count": int(total_deposits),  # Кількість замовлень з заставами
        "pending_payments": float(pending_amount),
        "period": {
            "from": from_date,
            "to": to_date
        }
    }

@router.post("/transactions")
@manager_router.post("/transactions")
async def create_transaction(
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Створити транзакцію
    ✅ MIGRATED: Using RentalHub DB
    """
    transaction_id = str(uuid.uuid4())
    
    order_id = data.get('order_id')
    transaction_type = data.get('transaction_type', 'payment')
    
    db.execute(text("""
        INSERT INTO finance_transactions (
            id, order_id, transaction_type, amount, currency, status, 
            description, payment_method, notes, created_by, created_at
        ) VALUES (
            :id, :order_id, :type, :amount, :currency, :status, 
            :description, :method, :notes, :created_by, NOW()
        )
    """), {
        "id": transaction_id,
        "order_id": order_id,
        "type": transaction_type,
        "amount": data.get('amount', 0),
        "currency": data.get('currency', 'UAH'),
        "status": data.get('status', 'pending'),
        "description": data.get('description', ''),
        "method": data.get('payment_method'),
        "notes": data.get('notes'),
        "created_by": data.get('created_by', 'Manager')
    })
    
    # Якщо це повернення застави - архівуємо замовлення автоматично
    if transaction_type == 'deposit_release' and order_id:
        # Перевірити чи залишився холд
        held_check = db.execute(text("""
            SELECT 
                COALESCE(SUM(CASE WHEN transaction_type = 'deposit_hold' THEN amount ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN transaction_type IN ('deposit_release', 'deposit_writeoff') THEN amount ELSE 0 END), 0) as held
            FROM finance_transactions
            WHERE order_id = :order_id
        """), {"order_id": order_id}).scalar()
        
        # Якщо холду не залишилось - архівуємо
        if held_check <= 0:
            db.execute(text("""
                UPDATE orders 
                SET is_archived = 1, updated_at = NOW()
                WHERE order_id = :order_id AND is_archived = 0
            """), {"order_id": order_id})
            
            # Додати запис в lifecycle
            db.execute(text("""
                INSERT INTO order_lifecycle (order_id, stage, notes, created_by, created_at)
                VALUES (:order_id, 'auto_archived', 'Автоматично архівовано (заставу повернуто)', 'System', NOW())
            """), {"order_id": order_id})
    
    db.commit()
    return {"message": "Transaction created", "transaction_id": transaction_id}

@router.post("/mark-paid/{transaction_id}")
@manager_router.post("/mark-paid/{transaction_id}")
async def mark_transaction_paid(
    transaction_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Позначити транзакцію оплаченою
    ✅ MIGRATED: Using RentalHub DB
    """
    db.execute(text("""
        UPDATE finance_transactions 
        SET status = 'completed', updated_at = NOW()
        WHERE id = :id
    """), {"id": transaction_id})
    
    db.commit()
    return {"message": "Transaction marked as paid"}

@router.get("/deposits")
@manager_router.get("/deposits")
async def get_deposits(
    status: Optional[str] = "held",
    db: Session = Depends(get_rh_db)
):
    """
    Отримати депозити
    ✅ MIGRATED: Using RentalHub DB
    """
    sql = """
        SELECT * FROM finance_transactions 
        WHERE transaction_type = 'deposit'
    """
    
    params = {}
    if status:
        sql += " AND status = :status"
        params['status'] = status
    
    sql += " ORDER BY created_at DESC"
    
    result = db.execute(text(sql), params)
    
    deposits = []
    for row in result:
        deposits.append({
            "id": row[0],
            "order_id": row[1],
            "amount": float(row[3]) if row[3] else 0.0,
            "status": row[4],
            "created_at": row[7].isoformat() if row[7] else None
        })
    
    return deposits

@router.post("/receive-payment")
@manager_router.post("/receive-payment")
async def receive_payment(
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Прийняти платіж
    ✅ MIGRATED: Using RentalHub DB
    """
    db.execute(text("""
        INSERT INTO finance_transactions (
            order_id, transaction_type, amount, status, payment_method, notes, created_at
        ) VALUES (
            :order_id, 'payment', :amount, 'completed', :method, :notes, NOW()
        )
    """), {
        "order_id": data.get('order_id'),
        "amount": data.get('amount'),
        "method": data.get('payment_method', 'cash'),
        "notes": data.get('notes', 'Payment received')
    })
    
    db.commit()
    return {"message": "Payment received", "amount": data.get('amount')}

@router.post("/return-deposit/{transaction_id}")
@manager_router.post("/return-deposit/{transaction_id}")
async def return_deposit(
    transaction_id: int,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Повернути депозит
    ✅ MIGRATED: Using RentalHub DB
    """
    # Update deposit status
    db.execute(text("""
        UPDATE finance_transactions 
        SET status = 'returned', notes = :notes, updated_at = NOW()
        WHERE id = :id AND transaction_type = 'deposit'
    """), {
        "id": transaction_id,
        "notes": data.get('notes', 'Deposit returned')
    })
    
    db.commit()
    return {"message": "Deposit returned"}

# Placeholder endpoints (можна додати пізніше)
@router.get("/report/{order_id}/pdf")
@manager_router.get("/report/{order_id}/pdf")
async def generate_pdf_report(order_id: int):
    """PDF звіт - TODO"""
    return {"message": "PDF generation not implemented yet"}

@router.post("/report/{order_id}/email")
@manager_router.post("/report/{order_id}/email")
async def email_report(order_id: int, data: dict):
    """Email звіт - TODO"""
    return {"message": "Email sending not implemented yet"}
