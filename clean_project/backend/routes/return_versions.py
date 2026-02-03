"""
Return Versions API - Версії повернення замовлень
Замість "заморожування" товарів створюємо окремі версії-замовлення
з префіксом #OC-7280(1), (2), (3)...

Логіка:
1. При частковому поверненні - батьківське закривається, створюється версія
2. Версія містить ТІЛЬКИ неповернені товари
3. Кожен день нараховується прострочення (автоматично)
4. Менеджер вручну підтверджує нарахування
5. При поверненні товарів з версії - можна створити наступну версію або закрити
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, date
from pydantic import BaseModel
from typing import List, Optional
import json

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/return-versions", tags=["return-versions"])


# === PYDANTIC MODELS ===

class ReturnVersionItem(BaseModel):
    """Товар у версії повернення"""
    product_id: int
    sku: str
    name: str
    qty: int
    daily_rate: float = 0


class CreateVersionRequest(BaseModel):
    """Запит на створення версії"""
    items: List[ReturnVersionItem]
    notes: Optional[str] = None


class AcceptItemsRequest(BaseModel):
    """Запит на прийняття товарів"""
    items: List[dict]  # [{sku, returned_qty}]
    notes: Optional[str] = None


class ChargeFeeRequest(BaseModel):
    """Запит на нарахування прострочення"""
    amount: float
    notes: Optional[str] = None


# === HELPER FUNCTIONS ===

def ensure_tables_exist(db: Session):
    """Створити таблиці якщо не існують"""
    
    # Головна таблиця версій
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS order_return_versions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            parent_order_id INT NOT NULL,
            version_number INT DEFAULT 1,
            order_number VARCHAR(50),
            
            customer_name VARCHAR(255),
            customer_phone VARCHAR(50),
            customer_email VARCHAR(255),
            
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            original_return_date DATE,
            
            calculated_daily_fee DECIMAL(10,2) DEFAULT 0,
            days_overdue INT DEFAULT 0,
            calculated_total_fee DECIMAL(10,2) DEFAULT 0,
            manager_fee DECIMAL(10,2) DEFAULT NULL,
            fee_status ENUM('pending', 'charged', 'waived') DEFAULT 'pending',
            
            status ENUM('active', 'returned') DEFAULT 'active',
            returned_at DATETIME,
            
            created_by_id INT,
            created_by_name VARCHAR(100),
            notes TEXT,
            
            INDEX idx_parent (parent_order_id),
            INDEX idx_status (status),
            INDEX idx_order_number (order_number)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """))
    
    # Таблиця товарів версії
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS order_return_version_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            version_id INT NOT NULL,
            product_id INT NOT NULL,
            sku VARCHAR(50),
            name VARCHAR(255),
            qty INT DEFAULT 1,
            daily_rate DECIMAL(10,2) DEFAULT 0,
            returned_qty INT DEFAULT 0,
            
            INDEX idx_version (version_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """))
    
    db.commit()


def calculate_days_overdue(original_date: date) -> int:
    """Розрахувати дні прострочення"""
    if not original_date:
        return 0
    today = datetime.now().date()
    days = (today - original_date).days
    return max(0, days)


def calculate_version_fees(db: Session, version_id: int) -> dict:
    """Розрахувати суми для версії"""
    # Отримати версію
    version = db.execute(text("""
        SELECT original_return_date FROM order_return_versions WHERE id = :id
    """), {"id": version_id}).fetchone()
    
    if not version:
        return {"daily_fee": 0, "days": 0, "total": 0}
    
    days = calculate_days_overdue(version[0])
    
    # Отримати товари
    items = db.execute(text("""
        SELECT qty, daily_rate, returned_qty 
        FROM order_return_version_items 
        WHERE version_id = :id
    """), {"id": version_id}).fetchall()
    
    daily_fee = 0
    for item in items:
        remaining_qty = item[0] - (item[2] or 0)
        if remaining_qty > 0:
            daily_fee += remaining_qty * float(item[1] or 0)
    
    return {
        "daily_fee": daily_fee,
        "days": days,
        "total": daily_fee * days
    }


# === API ENDPOINTS ===

@router.get("")
async def get_active_versions(
    db: Session = Depends(get_rh_db)
):
    """
    Отримати всі активні версії повернення (для дашборду)
    """
    ensure_tables_exist(db)
    
    result = db.execute(text("""
        SELECT 
            v.id, v.parent_order_id, v.version_number, v.order_number,
            v.customer_name, v.customer_phone, v.customer_email,
            v.started_at, v.original_return_date,
            v.calculated_daily_fee, v.days_overdue, v.calculated_total_fee,
            v.manager_fee, v.fee_status, v.status, v.notes,
            o.total_price as parent_total,
            o.deposit_amount as parent_deposit
        FROM order_return_versions v
        LEFT JOIN orders o ON v.parent_order_id = o.order_id
        WHERE v.status = 'active'
        ORDER BY v.started_at DESC
    """))
    
    versions = []
    for row in result:
        version_id = row[0]
        
        # Отримати товари
        items_result = db.execute(text("""
            SELECT product_id, sku, name, qty, daily_rate, returned_qty
            FROM order_return_version_items
            WHERE version_id = :id
        """), {"id": version_id})
        
        items = []
        total_items = 0
        remaining_items = 0
        daily_fee = 0
        
        for item in items_result:
            qty = item[3] or 0
            returned = item[5] or 0
            remaining = qty - returned
            rate = float(item[4] or 0)
            
            total_items += qty
            remaining_items += remaining
            daily_fee += remaining * rate
            
            items.append({
                "product_id": item[0],
                "sku": item[1] or "",
                "name": item[2] or "",
                "qty": qty,
                "returned_qty": returned,
                "remaining_qty": remaining,
                "daily_rate": rate
            })
        
        # Розрахувати дні прострочення
        days = calculate_days_overdue(row[8])
        total_fee = daily_fee * days
        
        versions.append({
            "id": version_id,
            "parent_order_id": row[1],
            "version_number": row[2],
            "order_number": row[3],
            "customer_name": row[4] or "",
            "customer_phone": row[5] or "",
            "customer_email": row[6] or "",
            "started_at": row[7].isoformat() if row[7] else None,
            "original_return_date": str(row[8]) if row[8] else None,
            "days_overdue": days,
            "daily_fee": daily_fee,
            "calculated_total_fee": total_fee,
            "manager_fee": float(row[12]) if row[12] else None,
            "fee_status": row[13] or "pending",
            "status": row[14] or "active",
            "notes": row[15],
            "parent_total": float(row[16]) if row[16] else 0,
            "parent_deposit": float(row[17]) if row[17] else 0,
            "items": items,
            "total_items": total_items,
            "remaining_items": remaining_items
        })
    
    return {"versions": versions, "count": len(versions)}


@router.get("/{version_id}")
async def get_version_details(
    version_id: int,
    db: Session = Depends(get_rh_db)
):
    """Отримати деталі версії"""
    ensure_tables_exist(db)
    
    result = db.execute(text("""
        SELECT 
            v.id, v.parent_order_id, v.version_number, v.order_number,
            v.customer_name, v.customer_phone, v.customer_email,
            v.started_at, v.original_return_date,
            v.calculated_daily_fee, v.days_overdue, v.calculated_total_fee,
            v.manager_fee, v.fee_status, v.status, v.returned_at, v.notes,
            v.created_by_name,
            o.order_number as parent_order_number,
            o.total_price as parent_total,
            o.deposit_amount as parent_deposit,
            o.rental_start_date, o.rental_end_date
        FROM order_return_versions v
        LEFT JOIN orders o ON v.parent_order_id = o.order_id
        WHERE v.id = :id
    """), {"id": version_id}).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Версія не знайдена")
    
    # Товари
    items_result = db.execute(text("""
        SELECT id, product_id, sku, name, qty, daily_rate, returned_qty
        FROM order_return_version_items
        WHERE version_id = :id
    """), {"id": version_id})
    
    items = []
    daily_fee = 0
    for item in items_result:
        remaining = (item[4] or 0) - (item[6] or 0)
        rate = float(item[5] or 0)
        daily_fee += remaining * rate
        
        items.append({
            "id": item[0],
            "product_id": item[1],
            "sku": item[2] or "",
            "name": item[3] or "",
            "qty": item[4] or 0,
            "daily_rate": rate,
            "returned_qty": item[6] or 0,
            "remaining_qty": remaining
        })
    
    days = calculate_days_overdue(result[8])
    
    return {
        "id": result[0],
        "parent_order_id": result[1],
        "version_number": result[2],
        "order_number": result[3],
        "customer_name": result[4] or "",
        "customer_phone": result[5] or "",
        "customer_email": result[6] or "",
        "started_at": result[7].isoformat() if result[7] else None,
        "original_return_date": str(result[8]) if result[8] else None,
        "days_overdue": days,
        "daily_fee": daily_fee,
        "calculated_total_fee": daily_fee * days,
        "manager_fee": float(result[12]) if result[12] else None,
        "fee_status": result[13] or "pending",
        "status": result[14] or "active",
        "returned_at": result[15].isoformat() if result[15] else None,
        "notes": result[16],
        "created_by_name": result[17],
        "parent": {
            "order_number": result[18],
            "total": float(result[19]) if result[19] else 0,
            "deposit": float(result[20]) if result[20] else 0,
            "rental_start": str(result[21]) if result[21] else None,
            "rental_end": str(result[22]) if result[22] else None
        },
        "items": items
    }


@router.post("/order/{order_id}/create")
async def create_return_version(
    order_id: int,
    data: CreateVersionRequest,
    db: Session = Depends(get_rh_db)
):
    """
    Створити нову версію повернення для замовлення
    Батьківське замовлення буде закрите (archived)
    """
    ensure_tables_exist(db)
    
    try:
        # Отримати дані батьківського замовлення
        parent = db.execute(text("""
            SELECT order_number, customer_name, customer_phone, customer_email,
                   rental_end_date, status
            FROM orders WHERE order_id = :id
        """), {"id": order_id}).fetchone()
        
        if not parent:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        parent_order_number = parent[0]
        
        # Визначити номер версії
        existing_versions = db.execute(text("""
            SELECT MAX(version_number) FROM order_return_versions
            WHERE parent_order_id = :id
        """), {"id": order_id}).scalar() or 0
        
        version_number = existing_versions + 1
        version_order_number = f"{parent_order_number}({version_number})"
        
        # Розрахувати денну ставку
        daily_fee = sum(item.qty * item.daily_rate for item in data.items)
        
        # Створити версію
        db.execute(text("""
            INSERT INTO order_return_versions (
                parent_order_id, version_number, order_number,
                customer_name, customer_phone, customer_email,
                original_return_date, calculated_daily_fee,
                notes, started_at
            ) VALUES (
                :parent_id, :version, :order_number,
                :name, :phone, :email,
                :return_date, :daily_fee,
                :notes, NOW()
            )
        """), {
            "parent_id": order_id,
            "version": version_number,
            "order_number": version_order_number,
            "name": parent[1],
            "phone": parent[2],
            "email": parent[3],
            "return_date": parent[4],
            "daily_fee": daily_fee,
            "notes": data.notes
        })
        
        version_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        
        # Додати товари
        for item in data.items:
            db.execute(text("""
                INSERT INTO order_return_version_items (
                    version_id, product_id, sku, name, qty, daily_rate
                ) VALUES (
                    :version_id, :product_id, :sku, :name, :qty, :rate
                )
            """), {
                "version_id": version_id,
                "product_id": item.product_id,
                "sku": item.sku,
                "name": item.name,
                "qty": item.qty,
                "rate": item.daily_rate
            })
        
        # Закрити батьківське замовлення
        db.execute(text("""
            UPDATE orders 
            SET status = 'returned',
                has_partial_return = 1,
                updated_at = NOW()
            WHERE order_id = :id
        """), {"id": order_id})
        
        # Оновити issue_card
        db.execute(text("""
            UPDATE issue_cards 
            SET status = 'returned',
                updated_at = NOW()
            WHERE order_id = :id
        """), {"id": order_id})
        
        # Записати в lifecycle
        db.execute(text("""
            INSERT INTO order_lifecycle (order_id, stage, notes, created_at)
            VALUES (:order_id, 'version_created', :notes, NOW())
        """), {
            "order_id": order_id,
            "notes": f"Створено версію {version_order_number} з {len(data.items)} товарами"
        })
        
        db.commit()
        
        return {
            "success": True,
            "version_id": version_id,
            "version_number": version_number,
            "order_number": version_order_number,
            "items_count": len(data.items),
            "daily_fee": daily_fee
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ReturnVersions] ❌ Error creating version: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{version_id}/accept-items")
async def accept_items_from_version(
    version_id: int,
    data: AcceptItemsRequest,
    db: Session = Depends(get_rh_db)
):
    """
    Прийняти товари з версії
    Якщо залишились неповернені - можна створити нову версію
    """
    ensure_tables_exist(db)
    
    try:
        # Отримати версію
        version = db.execute(text("""
            SELECT parent_order_id, order_number, original_return_date,
                   customer_name, customer_phone, customer_email
            FROM order_return_versions
            WHERE id = :id AND status = 'active'
        """), {"id": version_id}).fetchone()
        
        if not version:
            raise HTTPException(status_code=404, detail="Активна версія не знайдена")
        
        parent_order_id = version[0]
        order_number = version[1]
        original_return_date = version[2]
        
        items_accepted = 0
        remaining_items = []
        
        for item_data in data.items:
            sku = item_data.get('sku')
            returned_qty = item_data.get('returned_qty', 0)
            
            if not sku or returned_qty <= 0:
                continue
            
            # Оновити повернену кількість
            db.execute(text("""
                UPDATE order_return_version_items
                SET returned_qty = COALESCE(returned_qty, 0) + :returned
                WHERE version_id = :version_id AND sku = :sku
            """), {
                "version_id": version_id,
                "sku": sku,
                "returned": returned_qty
            })
            
            items_accepted += 1
        
        # Перевірити чи все повернуто
        remaining = db.execute(text("""
            SELECT product_id, sku, name, qty - COALESCE(returned_qty, 0) as remaining, daily_rate
            FROM order_return_version_items
            WHERE version_id = :id AND qty > COALESCE(returned_qty, 0)
        """), {"id": version_id}).fetchall()
        
        for r in remaining:
            if r[3] > 0:
                remaining_items.append({
                    "product_id": r[0],
                    "sku": r[1],
                    "name": r[2],
                    "qty": r[3],
                    "daily_rate": float(r[4] or 0)
                })
        
        all_returned = len(remaining_items) == 0
        
        if all_returned:
            # Закрити версію
            db.execute(text("""
                UPDATE order_return_versions
                SET status = 'returned',
                    returned_at = NOW()
                WHERE id = :id
            """), {"id": version_id})
            
            # Записати в lifecycle
            db.execute(text("""
                INSERT INTO order_lifecycle (order_id, stage, notes, created_at)
                VALUES (:order_id, 'version_returned', :notes, NOW())
            """), {
                "order_id": parent_order_id,
                "notes": f"Версія {order_number} повністю повернена"
            })
        
        db.commit()
        
        return {
            "success": True,
            "items_accepted": items_accepted,
            "all_returned": all_returned,
            "remaining_items": remaining_items,
            "message": "Всі товари повернено!" if all_returned else f"Залишилось {len(remaining_items)} позицій"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ReturnVersions] ❌ Error accepting items: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{version_id}/create-next")
async def create_next_version(
    version_id: int,
    data: Optional[dict] = None,
    db: Session = Depends(get_rh_db)
):
    """
    Створити наступну версію з неповернених товарів поточної
    """
    ensure_tables_exist(db)
    
    try:
        # Отримати поточну версію
        current = db.execute(text("""
            SELECT parent_order_id, version_number, order_number,
                   customer_name, customer_phone, customer_email
            FROM order_return_versions
            WHERE id = :id
        """), {"id": version_id}).fetchone()
        
        if not current:
            raise HTTPException(status_code=404, detail="Версія не знайдена")
        
        parent_order_id = current[0]
        current_version = current[1]
        
        # Отримати неповернені товари
        remaining = db.execute(text("""
            SELECT product_id, sku, name, qty - COALESCE(returned_qty, 0) as remaining, daily_rate
            FROM order_return_version_items
            WHERE version_id = :id AND qty > COALESCE(returned_qty, 0)
        """), {"id": version_id}).fetchall()
        
        if not remaining:
            raise HTTPException(status_code=400, detail="Немає неповернених товарів")
        
        # Закрити поточну версію
        db.execute(text("""
            UPDATE order_return_versions
            SET status = 'returned',
                returned_at = NOW()
            WHERE id = :id
        """), {"id": version_id})
        
        # Отримати батьківський order_number
        parent = db.execute(text("""
            SELECT order_number, rental_end_date FROM orders WHERE order_id = :id
        """), {"id": parent_order_id}).fetchone()
        
        # Створити нову версію
        new_version = current_version + 1
        new_order_number = f"{parent[0]}({new_version})"
        
        daily_fee = sum(float(r[4] or 0) * r[3] for r in remaining)
        
        db.execute(text("""
            INSERT INTO order_return_versions (
                parent_order_id, version_number, order_number,
                customer_name, customer_phone, customer_email,
                original_return_date, calculated_daily_fee,
                notes, started_at
            ) VALUES (
                :parent_id, :version, :order_number,
                :name, :phone, :email,
                :return_date, :daily_fee,
                :notes, NOW()
            )
        """), {
            "parent_id": parent_order_id,
            "version": new_version,
            "order_number": new_order_number,
            "name": current[3],
            "phone": current[4],
            "email": current[5],
            "return_date": parent[1],
            "daily_fee": daily_fee,
            "notes": data.get('notes') if data else None
        })
        
        new_version_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        
        # Додати товари
        for r in remaining:
            db.execute(text("""
                INSERT INTO order_return_version_items (
                    version_id, product_id, sku, name, qty, daily_rate
                ) VALUES (
                    :version_id, :product_id, :sku, :name, :qty, :rate
                )
            """), {
                "version_id": new_version_id,
                "product_id": r[0],
                "sku": r[1],
                "name": r[2],
                "qty": r[3],
                "rate": r[4]
            })
        
        # Записати в lifecycle
        db.execute(text("""
            INSERT INTO order_lifecycle (order_id, stage, notes, created_at)
            VALUES (:order_id, 'version_created', :notes, NOW())
        """), {
            "order_id": parent_order_id,
            "notes": f"Створено версію {new_order_number} з {len(remaining)} товарами"
        })
        
        db.commit()
        
        return {
            "success": True,
            "previous_version_id": version_id,
            "new_version_id": new_version_id,
            "new_version_number": new_version,
            "new_order_number": new_order_number,
            "items_count": len(remaining)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ReturnVersions] ❌ Error creating next version: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{version_id}/charge-fee")
async def charge_late_fee(
    version_id: int,
    data: ChargeFeeRequest,
    db: Session = Depends(get_rh_db)
):
    """
    Нарахувати прострочення (менеджер вводить суму вручну)
    """
    ensure_tables_exist(db)
    
    try:
        # Отримати версію
        version = db.execute(text("""
            SELECT parent_order_id, order_number, original_return_date, fee_status
            FROM order_return_versions
            WHERE id = :id
        """), {"id": version_id}).fetchone()
        
        if not version:
            raise HTTPException(status_code=404, detail="Версія не знайдена")
        
        if version[3] == 'charged':
            raise HTTPException(status_code=400, detail="Прострочення вже нараховано")
        
        parent_order_id = version[0]
        order_number = version[1]
        
        # Розрахувати дні
        days = calculate_days_overdue(version[2])
        
        # Оновити версію
        db.execute(text("""
            UPDATE order_return_versions
            SET manager_fee = :fee,
                fee_status = 'charged',
                days_overdue = :days,
                calculated_total_fee = :fee
            WHERE id = :id
        """), {
            "id": version_id,
            "fee": data.amount,
            "days": days
        })
        
        # Створити фінансову транзакцію
        if data.amount > 0:
            db.execute(text("""
                INSERT INTO fin_payments 
                (order_id, payment_type, amount, currency, status, note, occurred_at)
                VALUES (:order_id, 'late', :amount, 'UAH', 'pending', :description, NOW())
            """), {
                "order_id": parent_order_id,
                "amount": data.amount,
                "description": f"Прострочення {order_number}: {days} днів. {data.notes or ''}"
            })
        
        # Записати в lifecycle
        db.execute(text("""
            INSERT INTO order_lifecycle (order_id, stage, notes, created_at)
            VALUES (:order_id, 'late_fee_charged', :notes, NOW())
        """), {
            "order_id": parent_order_id,
            "notes": f"Нараховано прострочення {order_number}: ₴{data.amount:.2f} ({days} днів)"
        })
        
        db.commit()
        
        return {
            "success": True,
            "version_id": version_id,
            "amount": data.amount,
            "days": days,
            "fee_status": "charged"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ReturnVersions] ❌ Error charging fee: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{version_id}/waive-fee")
async def waive_late_fee(
    version_id: int,
    data: Optional[dict] = None,
    db: Session = Depends(get_rh_db)
):
    """
    Списати прострочення (не нараховувати)
    """
    ensure_tables_exist(db)
    
    try:
        version = db.execute(text("""
            SELECT parent_order_id, order_number FROM order_return_versions WHERE id = :id
        """), {"id": version_id}).fetchone()
        
        if not version:
            raise HTTPException(status_code=404, detail="Версія не знайдена")
        
        db.execute(text("""
            UPDATE order_return_versions
            SET fee_status = 'waived',
                manager_fee = 0,
                notes = CONCAT(COALESCE(notes, ''), ' | Списано: ', :reason)
            WHERE id = :id
        """), {
            "id": version_id,
            "reason": data.get('reason', 'Без причини') if data else 'Без причини'
        })
        
        db.execute(text("""
            INSERT INTO order_lifecycle (order_id, stage, notes, created_at)
            VALUES (:order_id, 'late_fee_waived', :notes, NOW())
        """), {
            "order_id": version[0],
            "notes": f"Списано прострочення {version[1]}"
        })
        
        db.commit()
        
        return {"success": True, "fee_status": "waived"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/order/{order_id}/versions")
async def get_order_versions(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати всі версії для замовлення (для архіву/перегляду)
    """
    ensure_tables_exist(db)
    
    result = db.execute(text("""
        SELECT 
            id, version_number, order_number, started_at, returned_at,
            days_overdue, manager_fee, fee_status, status
        FROM order_return_versions
        WHERE parent_order_id = :order_id
        ORDER BY version_number
    """), {"order_id": order_id})
    
    versions = []
    for row in result:
        # Кількість товарів
        items_count = db.execute(text("""
            SELECT COUNT(*), SUM(qty) FROM order_return_version_items WHERE version_id = :id
        """), {"id": row[0]}).fetchone()
        
        versions.append({
            "id": row[0],
            "version_number": row[1],
            "order_number": row[2],
            "started_at": row[3].isoformat() if row[3] else None,
            "returned_at": row[4].isoformat() if row[4] else None,
            "days_overdue": row[5] or 0,
            "manager_fee": float(row[6]) if row[6] else 0,
            "fee_status": row[7] or "pending",
            "status": row[8] or "active",
            "items_count": items_count[0] or 0,
            "total_qty": items_count[1] or 0
        })
    
    return {
        "order_id": order_id,
        "versions": versions,
        "count": len(versions)
    }


@router.post("/migrate-from-extensions")
async def migrate_from_extensions(
    db: Session = Depends(get_rh_db)
):
    """
    Міграція існуючих order_extensions до нової системи версій
    Запускати ОДИН раз після деплою
    """
    ensure_tables_exist(db)
    
    try:
        # Знайти унікальні order_id з активними extensions
        orders_with_extensions = db.execute(text("""
            SELECT DISTINCT e.order_id, o.order_number, o.customer_name, 
                   o.customer_phone, o.customer_email, o.rental_end_date
            FROM order_extensions e
            JOIN orders o ON e.order_id = o.order_id
            WHERE e.status = 'active'
        """)).fetchall()
        
        migrated = 0
        
        for order in orders_with_extensions:
            order_id = order[0]
            
            # Перевірити чи вже є версія
            existing = db.execute(text("""
                SELECT id FROM order_return_versions 
                WHERE parent_order_id = :id AND status = 'active'
            """), {"id": order_id}).fetchone()
            
            if existing:
                continue
            
            # Отримати extensions
            extensions = db.execute(text("""
                SELECT product_id, sku, name, qty, daily_rate, adjusted_daily_rate
                FROM order_extensions
                WHERE order_id = :id AND status = 'active'
            """), {"id": order_id}).fetchall()
            
            if not extensions:
                continue
            
            # Розрахувати daily_fee
            daily_fee = sum(float(e[5] or e[4] or 0) * e[3] for e in extensions)
            
            # Створити версію
            db.execute(text("""
                INSERT INTO order_return_versions (
                    parent_order_id, version_number, order_number,
                    customer_name, customer_phone, customer_email,
                    original_return_date, calculated_daily_fee,
                    notes, started_at
                ) VALUES (
                    :parent_id, 1, :order_number,
                    :name, :phone, :email,
                    :return_date, :daily_fee,
                    'Мігровано з order_extensions', NOW()
                )
            """), {
                "parent_id": order_id,
                "order_number": f"{order[1]}(1)",
                "name": order[2],
                "phone": order[3],
                "email": order[4],
                "return_date": order[5],
                "daily_fee": daily_fee
            })
            
            version_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
            
            # Додати товари
            for ext in extensions:
                db.execute(text("""
                    INSERT INTO order_return_version_items (
                        version_id, product_id, sku, name, qty, daily_rate
                    ) VALUES (
                        :version_id, :product_id, :sku, :name, :qty, :rate
                    )
                """), {
                    "version_id": version_id,
                    "product_id": ext[0],
                    "sku": ext[1],
                    "name": ext[2],
                    "qty": ext[3],
                    "rate": float(ext[5] or ext[4] or 0)
                })
            
            migrated += 1
        
        db.commit()
        
        return {
            "success": True,
            "migrated_orders": migrated,
            "message": f"Мігровано {migrated} замовлень з extensions до versions"
        }
        
    except Exception as e:
        db.rollback()
        print(f"[Migration] ❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
