"""
Finance API - Rental Finance Engine
Buckets, Ledger, Payments, Deposits, Expenses, Payroll
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel
from decimal import Decimal
import json

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/finance", tags=["finance"])


# ============================================================
# PYDANTIC MODELS
# ============================================================

class PaymentCreate(BaseModel):
    payment_type: str  # rent | deposit | damage | refund
    method: str  # cash | card | iban | online | p2p
    amount: float
    order_id: Optional[int] = None
    damage_case_id: Optional[int] = None
    payer_name: Optional[str] = None
    payer_contact: Optional[str] = None
    occurred_at: Optional[str] = None
    note: Optional[str] = None

class ExpenseCreate(BaseModel):
    expense_type: str = "expense"  # expense | investment
    category_code: str
    amount: float
    method: str  # cash | card | iban
    vendor_id: Optional[int] = None
    order_id: Optional[int] = None
    employee_id: Optional[int] = None
    occurred_at: Optional[str] = None
    note: Optional[str] = None
    receipt_file_key: Optional[str] = None

class DepositCreate(BaseModel):
    order_id: int
    expected_amount: float
    actual_amount: float
    currency: str = "UAH"  # UAH | USD | EUR
    exchange_rate: Optional[float] = None
    method: str = "cash"  # cash | card | bank
    note: Optional[str] = None

class VendorCreate(BaseModel):
    name: str
    vendor_type: str = "service"  # service | cleaning | repair | delivery
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    iban: Optional[str] = None
    note: Optional[str] = None

class EmployeeCreate(BaseModel):
    name: str
    role: str  # manager | courier | cleaner | assistant
    phone: Optional[str] = None
    email: Optional[str] = None
    base_salary: float = 0
    hire_date: Optional[str] = None
    note: Optional[str] = None

class PayrollCreate(BaseModel):
    employee_id: int
    period_start: str
    period_end: str
    base_amount: float
    bonus: float = 0
    deduction: float = 0
    method: str = "cash"
    note: Optional[str] = None


# ============================================================
# HELPER: LEDGER POSTING
# ============================================================

def get_account_id(db: Session, code: str) -> int:
    """Get account ID by code"""
    result = db.execute(text("SELECT id FROM fin_accounts WHERE code = :code"), {"code": code})
    row = result.fetchone()
    if not row:
        raise ValueError(f"Account not found: {code}")
    return row[0]

def post_transaction(
    db: Session,
    tx_type: str,
    amount: float,
    debit_account: str,
    credit_account: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    category_id: Optional[int] = None,
    order_id: Optional[int] = None,
    damage_case_id: Optional[int] = None,
    vendor_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    note: Optional[str] = None,
    occurred_at: Optional[datetime] = None
) -> int:
    """Create a ledger transaction with double-entry bookkeeping."""
    if occurred_at is None:
        occurred_at = datetime.now()
    
    db.execute(text("""
        INSERT INTO fin_transactions (tx_type, amount, occurred_at, entity_type, entity_id, category_id, note)
        VALUES (:tx_type, :amount, :occurred_at, :entity_type, :entity_id, :category_id, :note)
    """), {
        "tx_type": tx_type, "amount": amount, "occurred_at": occurred_at,
        "entity_type": entity_type, "entity_id": entity_id, "category_id": category_id, "note": note
    })
    
    result = db.execute(text("SELECT LAST_INSERT_ID()"))
    tx_id = result.fetchone()[0]
    
    debit_acc_id = get_account_id(db, debit_account)
    credit_acc_id = get_account_id(db, credit_account)
    
    # Debit entry
    db.execute(text("""
        INSERT INTO fin_ledger_entries (tx_id, account_id, direction, amount, order_id, damage_case_id, vendor_id, employee_id)
        VALUES (:tx_id, :account_id, 'D', :amount, :order_id, :damage_case_id, :vendor_id, :employee_id)
    """), {"tx_id": tx_id, "account_id": debit_acc_id, "amount": amount,
           "order_id": order_id, "damage_case_id": damage_case_id, "vendor_id": vendor_id, "employee_id": employee_id})
    
    # Credit entry
    db.execute(text("""
        INSERT INTO fin_ledger_entries (tx_id, account_id, direction, amount, order_id, damage_case_id, vendor_id, employee_id)
        VALUES (:tx_id, :account_id, 'C', :amount, :order_id, :damage_case_id, :vendor_id, :employee_id)
    """), {"tx_id": tx_id, "account_id": credit_acc_id, "amount": amount,
           "order_id": order_id, "damage_case_id": damage_case_id, "vendor_id": vendor_id, "employee_id": employee_id})
    
    return tx_id


# ============================================================
# ACCOUNTS & CATEGORIES
# ============================================================

@router.get("/accounts")
async def list_accounts(db: Session = Depends(get_rh_db)):
    """List all financial accounts/buckets with balances"""
    result = db.execute(text("""
        SELECT a.id, a.code, a.name, a.kind, a.currency, a.is_active,
            COALESCE((SELECT SUM(CASE WHEN direction = 'D' THEN amount ELSE -amount END) 
                      FROM fin_ledger_entries WHERE account_id = a.id), 0) as balance
        FROM fin_accounts a WHERE a.is_active = 1
        ORDER BY CASE a.kind WHEN 'asset' THEN 1 WHEN 'income' THEN 2 WHEN 'expense' THEN 3 ELSE 4 END, a.code
    """))
    return [{"id": r[0], "code": r[1], "name": r[2], "kind": r[3], "currency": r[4], 
             "is_active": bool(r[5]), "balance": float(r[6] or 0)} for r in result]

@router.get("/categories")
async def list_categories(type: Optional[str] = None, db: Session = Depends(get_rh_db)):
    """List expense/income categories"""
    query = "SELECT id, type, code, name, is_active FROM fin_categories WHERE is_active = 1"
    params = {}
    if type:
        query += " AND type = :type"
        params["type"] = type
    query += " ORDER BY type, name"
    result = db.execute(text(query), params)
    return [{"id": r[0], "type": r[1], "code": r[2], "name": r[3], "is_active": bool(r[4])} for r in result]


# ============================================================
# DASHBOARD / OVERVIEW
# ============================================================

@router.get("/dashboard")
async def get_dashboard(period: str = "month", db: Session = Depends(get_rh_db)):
    """Financial dashboard overview."""
    
    date_filter = ""
    if period == "day": date_filter = "AND t.occurred_at >= CURDATE()"
    elif period == "week": date_filter = "AND t.occurred_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
    elif period == "month": date_filter = "AND t.occurred_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)"
    elif period == "year": date_filter = "AND t.occurred_at >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)"
    
    # Rent revenue
    rent = db.execute(text(f"""
        SELECT COALESCE(SUM(e.amount), 0) FROM fin_ledger_entries e
        JOIN fin_accounts a ON a.id = e.account_id JOIN fin_transactions t ON t.id = e.tx_id
        WHERE a.code = 'RENT_REV' AND e.direction = 'C' AND t.status = 'posted' {date_filter}
    """)).fetchone()[0]
    
    # Damage compensation
    damage = db.execute(text(f"""
        SELECT COALESCE(SUM(e.amount), 0) FROM fin_ledger_entries e
        JOIN fin_accounts a ON a.id = e.account_id JOIN fin_transactions t ON t.id = e.tx_id
        WHERE a.code = 'DMG_COMP' AND e.direction = 'C' AND t.status = 'posted' {date_filter}
    """)).fetchone()[0]
    
    # Expenses
    expenses = db.execute(text(f"""
        SELECT COALESCE(SUM(e.amount), 0) FROM fin_ledger_entries e
        JOIN fin_accounts a ON a.id = e.account_id JOIN fin_transactions t ON t.id = e.tx_id
        WHERE a.kind = 'expense' AND e.direction = 'D' AND t.status = 'posted' {date_filter}
    """)).fetchone()[0]
    
    # Deposits
    dep = db.execute(text("""
        SELECT COALESCE(SUM(held_amount), 0), COALESCE(SUM(used_amount), 0), COALESCE(SUM(refunded_amount), 0)
        FROM fin_deposit_holds WHERE status IN ('holding', 'partially_used')
    """)).fetchone()
    
    # Cash balance
    cash = db.execute(text("""
        SELECT COALESCE(SUM(CASE WHEN direction = 'D' THEN amount ELSE -amount END), 0)
        FROM fin_ledger_entries e JOIN fin_accounts a ON a.id = e.account_id WHERE a.code IN ('CASH', 'BANK')
    """)).fetchone()[0]
    
    return {
        "period": period,
        "metrics": {
            "net_profit": float(rent or 0) + float(damage or 0) - float(expenses or 0),
            "rent_revenue": float(rent or 0),
            "damage_compensation": float(damage or 0),
            "operating_expenses": float(expenses or 0),
            "cash_balance": float(cash or 0),
        },
        "deposits": {
            "held": float(dep[0] or 0),
            "used": float(dep[1] or 0),
            "refunded": float(dep[2] or 0),
            "available_to_refund": float(dep[0] or 0) - float(dep[1] or 0) - float(dep[2] or 0)
        }
    }


# ============================================================
# PAYMENTS
# ============================================================

@router.get("/payments")
async def list_payments(payment_type: Optional[str] = None, order_id: Optional[int] = None,
                        limit: int = 50, offset: int = 0, db: Session = Depends(get_rh_db)):
    query = "SELECT id, payment_type, method, amount, currency, payer_name, occurred_at, order_id, damage_case_id, status, note FROM fin_payments WHERE 1=1"
    params = {"limit": limit, "offset": offset}
    if payment_type: query += " AND payment_type = :payment_type"; params["payment_type"] = payment_type
    if order_id: query += " AND order_id = :order_id"; params["order_id"] = order_id
    query += " ORDER BY occurred_at DESC LIMIT :limit OFFSET :offset"
    result = db.execute(text(query), params)
    return {"payments": [{"id": r[0], "payment_type": r[1], "method": r[2], "amount": float(r[3]),
                          "currency": r[4], "payer_name": r[5], "occurred_at": r[6].isoformat() if r[6] else None,
                          "order_id": r[7], "damage_case_id": r[8], "status": r[9], "note": r[10]} for r in result]}

@router.post("/payments")
async def create_payment(data: PaymentCreate, db: Session = Depends(get_rh_db)):
    """Record a new payment with ledger entries."""
    occurred_at = datetime.fromisoformat(data.occurred_at) if data.occurred_at else datetime.now()
    
    mapping = {
        "rent": ("CASH" if data.method == "cash" else "BANK", "RENT_REV"),
        "deposit": ("CASH" if data.method == "cash" else "BANK", "DEP_HOLD"),
        "damage": ("CASH" if data.method == "cash" else "BANK", "DMG_COMP"),
        "refund": ("DEP_HOLD", "CASH" if data.method == "cash" else "BANK"),
    }
    if data.payment_type not in mapping:
        raise HTTPException(status_code=400, detail=f"Invalid payment_type: {data.payment_type}")
    
    debit_acc, credit_acc = mapping[data.payment_type]
    
    try:
        tx_id = post_transaction(db, f"{data.payment_type}_payment", data.amount, debit_acc, credit_acc,
                                 "order" if data.order_id else None, data.order_id or data.damage_case_id,
                                 order_id=data.order_id, damage_case_id=data.damage_case_id, note=data.note, occurred_at=occurred_at)
        
        db.execute(text("""
            INSERT INTO fin_payments (payment_type, method, amount, payer_name, payer_contact, occurred_at, order_id, damage_case_id, tx_id, note)
            VALUES (:payment_type, :method, :amount, :payer_name, :payer_contact, :occurred_at, :order_id, :damage_case_id, :tx_id, :note)
        """), {"payment_type": data.payment_type, "method": data.method, "amount": data.amount,
               "payer_name": data.payer_name, "payer_contact": data.payer_contact, "occurred_at": occurred_at,
               "order_id": data.order_id, "damage_case_id": data.damage_case_id, "tx_id": tx_id, "note": data.note})
        payment_id = db.execute(text("SELECT LAST_INSERT_ID()")).fetchone()[0]
        
        # Handle deposit creation/update
        if data.payment_type == "deposit" and data.order_id:
            existing = db.execute(text("SELECT id FROM fin_deposit_holds WHERE order_id = :order_id"), {"order_id": data.order_id}).fetchone()
            if existing:
                db.execute(text("UPDATE fin_deposit_holds SET held_amount = held_amount + :amount WHERE order_id = :order_id"),
                          {"amount": data.amount, "order_id": data.order_id})
                deposit_id = existing[0]
            else:
                db.execute(text("INSERT INTO fin_deposit_holds (order_id, held_amount, opened_at, note) VALUES (:order_id, :amount, :occurred_at, :note)"),
                          {"order_id": data.order_id, "amount": data.amount, "occurred_at": occurred_at, "note": data.note})
                deposit_id = db.execute(text("SELECT LAST_INSERT_ID()")).fetchone()[0]
            db.execute(text("INSERT INTO fin_deposit_events (deposit_id, event_type, amount, occurred_at, tx_id) VALUES (:deposit_id, 'received', :amount, :occurred_at, :tx_id)"),
                      {"deposit_id": deposit_id, "amount": data.amount, "occurred_at": occurred_at, "tx_id": tx_id})
        
        db.commit()
        return {"success": True, "payment_id": payment_id, "tx_id": tx_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# EXPENSES
# ============================================================

@router.get("/expenses")
async def list_expenses(category_code: Optional[str] = None, expense_type: Optional[str] = None,
                        limit: int = 50, offset: int = 0, db: Session = Depends(get_rh_db)):
    query = """SELECT e.id, e.expense_type, c.code, c.name, e.amount, e.currency, e.method, e.occurred_at, e.note, e.order_id, e.employee_id, e.vendor_id, e.status
               FROM fin_expenses e JOIN fin_categories c ON c.id = e.category_id WHERE 1=1"""
    params = {"limit": limit, "offset": offset}
    if category_code: query += " AND c.code = :category_code"; params["category_code"] = category_code
    if expense_type: query += " AND e.expense_type = :expense_type"; params["expense_type"] = expense_type
    query += " ORDER BY e.occurred_at DESC LIMIT :limit OFFSET :offset"
    result = db.execute(text(query), params)
    return {"expenses": [{"id": r[0], "expense_type": r[1], "category_code": r[2], "category_name": r[3],
                          "amount": float(r[4]), "currency": r[5], "method": r[6],
                          "occurred_at": r[7].isoformat() if r[7] else None, "note": r[8],
                          "order_id": r[9], "employee_id": r[10], "vendor_id": r[11], "status": r[12]} for r in result]}

@router.post("/expenses")
async def create_expense(data: ExpenseCreate, db: Session = Depends(get_rh_db)):
    """Record a new expense with ledger entries."""
    occurred_at = datetime.fromisoformat(data.occurred_at) if data.occurred_at else datetime.now()
    
    cat = db.execute(text("SELECT id, type FROM fin_categories WHERE code = :code"), {"code": data.category_code}).fetchone()
    if not cat:
        raise HTTPException(status_code=400, detail=f"Category not found: {data.category_code}")
    
    debit_acc = "INV_ASSETS" if data.expense_type == "investment" else ("VENDORS" if data.vendor_id else "OPEX")
    credit_acc = "CASH" if data.method == "cash" else "BANK"
    
    try:
        tx_id = post_transaction(db, "expense" if data.expense_type == "expense" else "investment_purchase",
                                 data.amount, debit_acc, credit_acc, "order" if data.order_id else None, data.order_id,
                                 category_id=cat[0], order_id=data.order_id, vendor_id=data.vendor_id,
                                 employee_id=data.employee_id, note=data.note, occurred_at=occurred_at)
        
        db.execute(text("""
            INSERT INTO fin_expenses (expense_type, category_id, amount, method, vendor_id, occurred_at, note, order_id, employee_id, receipt_file_key, tx_id)
            VALUES (:expense_type, :category_id, :amount, :method, :vendor_id, :occurred_at, :note, :order_id, :employee_id, :receipt_file_key, :tx_id)
        """), {"expense_type": data.expense_type, "category_id": cat[0], "amount": data.amount, "method": data.method,
               "vendor_id": data.vendor_id, "occurred_at": occurred_at, "note": data.note, "order_id": data.order_id,
               "employee_id": data.employee_id, "receipt_file_key": data.receipt_file_key, "tx_id": tx_id})
        expense_id = db.execute(text("SELECT LAST_INSERT_ID()")).fetchone()[0]
        
        db.commit()
        return {"success": True, "expense_id": expense_id, "tx_id": tx_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# DEPOSITS
# ============================================================

@router.get("/deposits")
async def list_deposits(status: Optional[str] = None, db: Session = Depends(get_rh_db)):
    """List deposit holds with order info"""
    query = """SELECT d.id, d.order_id, d.held_amount, d.used_amount, d.refunded_amount, d.status, d.opened_at, d.closed_at, d.note, o.order_number, o.customer_name
               FROM fin_deposit_holds d LEFT JOIN orders o ON o.order_id = d.order_id WHERE 1=1"""
    params = {}
    if status: query += " AND d.status = :status"; params["status"] = status
    query += " ORDER BY d.opened_at DESC"
    result = db.execute(text(query), params)
    return [{"id": r[0], "order_id": r[1], "held_amount": float(r[2]), "used_amount": float(r[3]),
             "refunded_amount": float(r[4]), "available": float(r[2]) - float(r[3]) - float(r[4]),
             "status": r[5], "opened_at": r[6].isoformat() if r[6] else None,
             "closed_at": r[7].isoformat() if r[7] else None, "note": r[8],
             "order_number": r[9], "customer_name": r[10]} for r in result]

@router.post("/deposits/{deposit_id}/use")
async def use_deposit(deposit_id: int, amount: float, damage_case_id: Optional[int] = None,
                      note: Optional[str] = None, db: Session = Depends(get_rh_db)):
    """Use deposit for damage compensation"""
    dep = db.execute(text("SELECT order_id, held_amount, used_amount, refunded_amount FROM fin_deposit_holds WHERE id = :id"), {"id": deposit_id}).fetchone()
    if not dep: raise HTTPException(status_code=404, detail="Deposit not found")
    
    available = float(dep[1]) - float(dep[2]) - float(dep[3])
    if amount > available: raise HTTPException(status_code=400, detail=f"Not enough deposit. Available: {available}")
    
    try:
        tx_id = post_transaction(db, "deposit_hold_used", amount, "DEP_HOLD", "DMG_COMP",
                                 "damage_case" if damage_case_id else "order", damage_case_id or dep[0],
                                 order_id=dep[0], damage_case_id=damage_case_id, note=note or "Утримання із застави")
        
        new_used = float(dep[2]) + amount
        new_status = "partially_used" if (float(dep[1]) - new_used - float(dep[3])) > 0 else "fully_used"
        db.execute(text("UPDATE fin_deposit_holds SET used_amount = :used, status = :status WHERE id = :id"),
                  {"used": new_used, "status": new_status, "id": deposit_id})
        
        db.execute(text("INSERT INTO fin_deposit_events (deposit_id, event_type, amount, occurred_at, damage_case_id, tx_id, note) VALUES (:deposit_id, 'used_for_damage', :amount, NOW(), :damage_case_id, :tx_id, :note)"),
                  {"deposit_id": deposit_id, "amount": amount, "damage_case_id": damage_case_id, "tx_id": tx_id, "note": note})
        
        db.commit()
        return {"success": True, "tx_id": tx_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/deposits/{deposit_id}/refund")
async def refund_deposit(deposit_id: int, amount: float, method: str = "cash",
                         note: Optional[str] = None, db: Session = Depends(get_rh_db)):
    """Refund deposit to customer"""
    dep = db.execute(text("SELECT order_id, held_amount, used_amount, refunded_amount FROM fin_deposit_holds WHERE id = :id"), {"id": deposit_id}).fetchone()
    if not dep: raise HTTPException(status_code=404, detail="Deposit not found")
    
    available = float(dep[1]) - float(dep[2]) - float(dep[3])
    if amount > available: raise HTTPException(status_code=400, detail=f"Not enough to refund. Available: {available}")
    
    try:
        credit_acc = "CASH" if method == "cash" else "BANK"
        tx_id = post_transaction(db, "deposit_refund", amount, "DEP_HOLD", credit_acc, "order", dep[0],
                                 order_id=dep[0], note=note or "Повернення застави")
        
        new_refunded = float(dep[3]) + amount
        remaining = float(dep[1]) - float(dep[2]) - new_refunded
        new_status = "refunded" if remaining <= 0 else "partially_used"
        db.execute(text("UPDATE fin_deposit_holds SET refunded_amount = :refunded, status = :status, closed_at = CASE WHEN :remaining <= 0 THEN NOW() ELSE closed_at END WHERE id = :id"),
                  {"refunded": new_refunded, "status": new_status, "remaining": remaining, "id": deposit_id})
        
        db.execute(text("INSERT INTO fin_deposit_events (deposit_id, event_type, amount, occurred_at, tx_id, note) VALUES (:deposit_id, 'refunded', :amount, NOW(), :tx_id, :note)"),
                  {"deposit_id": deposit_id, "amount": amount, "tx_id": tx_id, "note": note})
        
        db.commit()
        return {"success": True, "tx_id": tx_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# LEDGER
# ============================================================

@router.get("/ledger")
async def list_transactions(tx_type: Optional[str] = None, account_code: Optional[str] = None,
                            date_from: Optional[str] = None, date_to: Optional[str] = None,
                            limit: int = 50, offset: int = 0, db: Session = Depends(get_rh_db)):
    """List ledger transactions"""
    query = """SELECT DISTINCT t.id, t.tx_type, t.amount, t.currency, t.occurred_at, t.entity_type, t.entity_id, t.note, t.status
               FROM fin_transactions t LEFT JOIN fin_ledger_entries e ON e.tx_id = t.id LEFT JOIN fin_accounts a ON a.id = e.account_id
               WHERE t.status = 'posted'"""
    params = {"limit": limit, "offset": offset}
    if tx_type: query += " AND t.tx_type = :tx_type"; params["tx_type"] = tx_type
    if account_code: query += " AND a.code = :account_code"; params["account_code"] = account_code
    if date_from: query += " AND t.occurred_at >= :date_from"; params["date_from"] = date_from
    if date_to: query += " AND t.occurred_at <= :date_to"; params["date_to"] = date_to
    query += " ORDER BY t.occurred_at DESC LIMIT :limit OFFSET :offset"
    
    result = db.execute(text(query), params)
    transactions = []
    for row in result:
        entries = db.execute(text("SELECT a.code, a.name, e.direction, e.amount FROM fin_ledger_entries e JOIN fin_accounts a ON a.id = e.account_id WHERE e.tx_id = :tx_id"), {"tx_id": row[0]})
        transactions.append({
            "id": row[0], "tx_type": row[1], "amount": float(row[2]), "currency": row[3],
            "occurred_at": row[4].isoformat() if row[4] else None, "entity_type": row[5],
            "entity_id": row[6], "note": row[7], "status": row[8],
            "entries": [{"account_code": e[0], "account_name": e[1], "direction": e[2], "amount": float(e[3])} for e in entries]
        })
    return {"transactions": transactions}


@router.post("/migrate-tables")
async def migrate_tables(db: Session = Depends(get_rh_db)):
    """Migrate tables to correct structure"""
    results = []
    
    try:
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        
        # Drop and recreate hr_employees
        db.execute(text("DROP TABLE IF EXISTS hr_payroll"))
        db.execute(text("DROP TABLE IF EXISTS hr_employees"))
        db.execute(text("""
            CREATE TABLE hr_employees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                role VARCHAR(50) DEFAULT 'other',
                phone VARCHAR(50),
                email VARCHAR(100),
                base_salary DECIMAL(12,2) DEFAULT 0,
                hire_date DATE,
                note TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """))
        results.append("hr_employees: OK")
        
        # Recreate hr_payroll
        db.execute(text("""
            CREATE TABLE hr_payroll (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT NOT NULL,
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                base_amount DECIMAL(12,2) NOT NULL,
                bonus DECIMAL(12,2) DEFAULT 0,
                deduction DECIMAL(12,2) DEFAULT 0,
                total_amount DECIMAL(12,2) DEFAULT 0,
                status VARCHAR(20) DEFAULT 'pending',
                method VARCHAR(20) DEFAULT 'cash',
                paid_at TIMESTAMP NULL,
                tx_id INT NULL,
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        results.append("hr_payroll: OK")
        
        # Drop and recreate fin_vendors
        db.execute(text("DROP TABLE IF EXISTS fin_vendors"))
        db.execute(text("""
            CREATE TABLE fin_vendors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                vendor_type VARCHAR(50) DEFAULT 'service',
                contact_name VARCHAR(100),
                phone VARCHAR(50),
                email VARCHAR(100),
                address TEXT,
                iban VARCHAR(50),
                balance DECIMAL(12,2) DEFAULT 0,
                note TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        results.append("fin_vendors: OK")
        
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        db.commit()
        return {"success": True, "results": results}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}



# ============================================================
# VENDORS
# ============================================================

@router.get("/vendors")
async def list_vendors(vendor_type: Optional[str] = None, db: Session = Depends(get_rh_db)):
    """List all vendors"""
    try:
        # Ensure table has proper structure
        db.execute(text("DROP TABLE IF EXISTS fin_vendors_old"))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS fin_vendors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                vendor_type VARCHAR(50) DEFAULT 'service',
                contact_name VARCHAR(100),
                phone VARCHAR(50),
                email VARCHAR(100),
                address TEXT,
                iban VARCHAR(50),
                balance DECIMAL(12,2) DEFAULT 0,
                note TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.commit()
    except Exception as e:
        print(f"Vendors table setup: {e}")
    
    try:
        result = db.execute(text("SELECT id, name, vendor_type, contact_name, phone, email, address, iban, balance, note, is_active, created_at FROM fin_vendors WHERE is_active = TRUE ORDER BY name"))
        vendors = [{"id": r[0], "name": r[1], "vendor_type": r[2] or 'service', "contact_name": r[3],
                    "phone": r[4], "email": r[5], "address": r[6], "iban": r[7],
                    "balance": float(r[8] or 0), "note": r[9], "is_active": r[10],
                    "created_at": r[11].isoformat() if r[11] else None} for r in result]
    except Exception as e:
        # Table might exist with different structure - try simpler query
        try:
            result = db.execute(text("SELECT id, name FROM fin_vendors"))
            vendors = [{"id": r[0], "name": r[1], "vendor_type": 'service', "contact_name": None,
                        "phone": None, "email": None, "address": None, "iban": None,
                        "balance": 0, "note": None, "is_active": True, "created_at": None} for r in result]
        except:
            vendors = []
    return {"vendors": vendors}

@router.post("/vendors")
async def create_vendor(data: VendorCreate, db: Session = Depends(get_rh_db)):
    """Create a new vendor"""
    try:
        # Ensure table has correct structure
        db.execute(text("DROP TABLE IF EXISTS fin_vendors"))
        db.execute(text("""
            CREATE TABLE fin_vendors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                vendor_type VARCHAR(50) DEFAULT 'service',
                contact_name VARCHAR(100),
                phone VARCHAR(50),
                email VARCHAR(100),
                address TEXT,
                iban VARCHAR(50),
                balance DECIMAL(12,2) DEFAULT 0,
                note TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.commit()
    except Exception as e:
        print(f"Create vendors table: {e}")
    
    try:
        db.execute(text("""
            INSERT INTO fin_vendors (name, vendor_type, contact_name, phone, email, address, iban, note)
            VALUES (:name, :vendor_type, :contact_name, :phone, :email, :address, :iban, :note)
        """), {"name": data.name, "vendor_type": data.vendor_type, "contact_name": data.contact_name,
               "phone": data.phone, "email": data.email, "address": data.address,
               "iban": data.iban, "note": data.note})
        vendor_id = db.execute(text("SELECT LAST_INSERT_ID()")).fetchone()[0]
        db.commit()
        return {"success": True, "vendor_id": vendor_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/vendors/{vendor_id}")
async def update_vendor(vendor_id: int, data: VendorCreate, db: Session = Depends(get_rh_db)):
    """Update vendor"""
    try:
        db.execute(text("""
            UPDATE fin_vendors SET name = :name, vendor_type = :vendor_type, contact_name = :contact_name,
            phone = :phone, email = :email, address = :address, iban = :iban, note = :note WHERE id = :id
        """), {"id": vendor_id, **data.dict()})
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# EMPLOYEES & PAYROLL
# ============================================================

@router.get("/employees")
async def list_employees(role: Optional[str] = None, db: Session = Depends(get_rh_db)):
    """List all employees"""
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS hr_employees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                role VARCHAR(50) DEFAULT 'other',
                phone VARCHAR(50),
                email VARCHAR(100),
                base_salary DECIMAL(12,2) DEFAULT 0,
                hire_date DATE,
                note TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.commit()
    except Exception as e:
        print(f"Employees table setup: {e}")
    
    try:
        result = db.execute(text("SELECT id, name, role, phone, email, base_salary, hire_date, note, is_active, created_at FROM hr_employees WHERE is_active = TRUE ORDER BY name"))
        employees = [{"id": r[0], "name": r[1], "role": r[2] or 'other', "phone": r[3], "email": r[4],
                      "base_salary": float(r[5] or 0), "hire_date": r[6].isoformat() if r[6] else None,
                      "note": r[7], "is_active": r[8], "created_at": r[9].isoformat() if r[9] else None} for r in result]
    except:
        employees = []
    return {"employees": employees}

@router.post("/employees")
async def create_employee(data: EmployeeCreate, db: Session = Depends(get_rh_db)):
    """Create a new employee"""
    try:
        # Ensure table has correct structure
        db.execute(text("DROP TABLE IF EXISTS hr_employees"))
        db.execute(text("""
            CREATE TABLE hr_employees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                role VARCHAR(50) DEFAULT 'other',
                phone VARCHAR(50),
                email VARCHAR(100),
                base_salary DECIMAL(12,2) DEFAULT 0,
                hire_date DATE,
                note TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.commit()
    except Exception as e:
        print(f"Create employees table: {e}")
    
    try:
        hire_date = datetime.fromisoformat(data.hire_date).date() if data.hire_date else date.today()
        db.execute(text("""
            INSERT INTO hr_employees (name, role, phone, email, base_salary, hire_date, note)
            VALUES (:name, :role, :phone, :email, :base_salary, :hire_date, :note)
        """), {"name": data.name, "role": data.role, "phone": data.phone, "email": data.email,
               "base_salary": data.base_salary, "hire_date": hire_date, "note": data.note})
        employee_id = db.execute(text("SELECT LAST_INSERT_ID()")).fetchone()[0]
        db.commit()
        return {"success": True, "employee_id": employee_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/payroll")
async def list_payroll(employee_id: Optional[int] = None, status: Optional[str] = None,
                       period: Optional[str] = None, db: Session = Depends(get_rh_db)):
    """List payroll records"""
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS hr_payroll (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id INT NOT NULL,
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                base_amount DECIMAL(12,2) NOT NULL,
                bonus DECIMAL(12,2) DEFAULT 0,
                deduction DECIMAL(12,2) DEFAULT 0,
                total_amount DECIMAL(12,2) DEFAULT 0,
                status VARCHAR(20) DEFAULT 'pending',
                method VARCHAR(20) DEFAULT 'cash',
                paid_at TIMESTAMP NULL,
                tx_id INT NULL,
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.commit()
    except Exception as e:
        print(f"Payroll table setup: {e}")
    
    try:
        result = db.execute(text("""
            SELECT p.id, p.employee_id, e.name, p.period_start, p.period_end, p.base_amount, p.bonus, p.deduction, 
                   (p.base_amount + COALESCE(p.bonus, 0) - COALESCE(p.deduction, 0)) as total_amount, 
                   p.status, p.method, p.paid_at, p.note, p.created_at
            FROM hr_payroll p LEFT JOIN hr_employees e ON e.id = p.employee_id 
            ORDER BY p.period_start DESC
        """))
        payroll = [{"id": r[0], "employee_id": r[1], "employee_name": r[2],
                    "period_start": r[3].isoformat() if r[3] else None,
                    "period_end": r[4].isoformat() if r[4] else None,
                    "base_amount": float(r[5] or 0), "bonus": float(r[6] or 0),
                    "deduction": float(r[7] or 0), "total_amount": float(r[8] or 0),
                    "status": r[9] or 'pending', "method": r[10] or 'cash',
                    "paid_at": r[11].isoformat() if r[11] else None,
                    "note": r[12], "created_at": r[13].isoformat() if r[13] else None} for r in result]
    except:
        payroll = []
    return {"payroll": payroll}

@router.post("/payroll")
async def create_payroll(data: PayrollCreate, db: Session = Depends(get_rh_db)):
    """Create payroll record"""
    try:
        period_start = datetime.fromisoformat(data.period_start).date()
        period_end = datetime.fromisoformat(data.period_end).date()
        db.execute(text("""
            INSERT INTO hr_payroll (employee_id, period_start, period_end, base_amount, bonus, deduction, method, note)
            VALUES (:employee_id, :period_start, :period_end, :base_amount, :bonus, :deduction, :method, :note)
        """), {"employee_id": data.employee_id, "period_start": period_start, "period_end": period_end,
               "base_amount": data.base_amount, "bonus": data.bonus, "deduction": data.deduction,
               "method": data.method, "note": data.note})
        payroll_id = db.execute(text("SELECT LAST_INSERT_ID()")).fetchone()[0]
        db.commit()
        return {"success": True, "payroll_id": payroll_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/payroll/{payroll_id}/pay")
async def pay_payroll(payroll_id: int, db: Session = Depends(get_rh_db)):
    """Process payroll payment with ledger entry"""
    rec = db.execute(text("SELECT employee_id, total_amount, method, status FROM hr_payroll WHERE id = :id"), {"id": payroll_id}).fetchone()
    if not rec:
        raise HTTPException(status_code=404, detail="Payroll record not found")
    if rec[3] == "paid":
        raise HTTPException(status_code=400, detail="Already paid")
    
    try:
        credit_acc = "CASH" if rec[2] == "cash" else "BANK"
        tx_id = post_transaction(db, "payroll_payment", float(rec[1]), "PAYROLL_EXP", credit_acc,
                                 "employee", rec[0], employee_id=rec[0], note=f"Зарплата #{payroll_id}")
        
        db.execute(text("UPDATE hr_payroll SET status = 'paid', paid_at = NOW(), tx_id = :tx_id WHERE id = :id"),
                  {"tx_id": tx_id, "id": payroll_id})
        db.commit()
        return {"success": True, "tx_id": tx_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# DEPOSIT WITH CURRENCY
# ============================================================

@router.post("/deposits/create")
async def create_deposit_with_currency(data: DepositCreate, db: Session = Depends(get_rh_db)):
    """Create deposit with multi-currency support"""
    occurred_at = datetime.now()
    
    # Convert foreign currency to UAH equivalent
    uah_amount = data.actual_amount
    if data.currency != "UAH" and data.exchange_rate:
        uah_amount = data.actual_amount * data.exchange_rate
    
    try:
        # Check if PAYROLL_EXP account exists, create if not
        acc = db.execute(text("SELECT id FROM fin_accounts WHERE code = 'PAYROLL_EXP'")).fetchone()
        if not acc:
            db.execute(text("INSERT INTO fin_accounts (code, name, kind) VALUES ('PAYROLL_EXP', 'Payroll Expenses', 'expense')"))
            db.commit()
        
        # Determine credit account
        credit_acc = "CASH" if data.method == "cash" else "BANK"
        
        # Post ledger transaction
        tx_id = post_transaction(db, "deposit_payment", uah_amount, credit_acc, "DEP_HOLD",
                                 "order", data.order_id, order_id=data.order_id,
                                 note=data.note or f"Застава {data.currency}")
        
        # Add currency info to deposit_holds table
        try:
            db.execute(text("ALTER TABLE fin_deposit_holds ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'UAH'"))
            db.execute(text("ALTER TABLE fin_deposit_holds ADD COLUMN IF NOT EXISTS actual_amount DECIMAL(12,2)"))
            db.execute(text("ALTER TABLE fin_deposit_holds ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10,4)"))
            db.execute(text("ALTER TABLE fin_deposit_holds ADD COLUMN IF NOT EXISTS expected_amount DECIMAL(12,2)"))
        except:
            pass
        
        # Check existing deposit for order
        existing = db.execute(text("SELECT id FROM fin_deposit_holds WHERE order_id = :order_id"), {"order_id": data.order_id}).fetchone()
        if existing:
            db.execute(text("""
                UPDATE fin_deposit_holds 
                SET held_amount = held_amount + :uah_amount, 
                    actual_amount = :actual_amount,
                    currency = :currency,
                    exchange_rate = :exchange_rate,
                    expected_amount = :expected_amount
                WHERE order_id = :order_id
            """), {"uah_amount": uah_amount, "actual_amount": data.actual_amount, "currency": data.currency,
                   "exchange_rate": data.exchange_rate, "expected_amount": data.expected_amount, "order_id": data.order_id})
            deposit_id = existing[0]
        else:
            db.execute(text("""
                INSERT INTO fin_deposit_holds (order_id, held_amount, actual_amount, currency, exchange_rate, expected_amount, opened_at, note)
                VALUES (:order_id, :uah_amount, :actual_amount, :currency, :exchange_rate, :expected_amount, :occurred_at, :note)
            """), {"order_id": data.order_id, "uah_amount": uah_amount, "actual_amount": data.actual_amount,
                   "currency": data.currency, "exchange_rate": data.exchange_rate,
                   "expected_amount": data.expected_amount, "occurred_at": occurred_at, "note": data.note})
            deposit_id = db.execute(text("SELECT LAST_INSERT_ID()")).fetchone()[0]
        
        # Record deposit event
        db.execute(text("""
            INSERT INTO fin_deposit_events (deposit_id, event_type, amount, occurred_at, tx_id, note) 
            VALUES (:deposit_id, 'received', :amount, :occurred_at, :tx_id, :note)
        """), {"deposit_id": deposit_id, "amount": uah_amount, "occurred_at": occurred_at, "tx_id": tx_id,
               "note": f"{data.actual_amount} {data.currency}" if data.currency != "UAH" else None})
        
        # Create payment record
        db.execute(text("""
            INSERT INTO fin_payments (payment_type, method, amount, currency, order_id, occurred_at, note, tx_id)
            VALUES ('deposit', :method, :amount, :currency, :order_id, :occurred_at, :note, :tx_id)
        """), {"method": data.method, "amount": uah_amount, "currency": data.currency,
               "order_id": data.order_id, "occurred_at": occurred_at, "note": data.note, "tx_id": tx_id})
        
        db.commit()
        return {"success": True, "deposit_id": deposit_id, "tx_id": tx_id, "uah_amount": uah_amount}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

