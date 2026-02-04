"""
Return Versions API - Версіонування часткових повернень

НОВА АРХІТЕКТУРА:
- НЕ створюємо нові записи в orders (це таблиця OpenCart)
- Використовуємо окрему таблицю partial_return_versions
- Кожна версія зберігає товари що залишились у клієнта

Приклад:
1. OC-7266 (order_id=7266) - оригінальне замовлення
2. При частковому поверненні → версія OC-7266(1) в partial_return_versions
3. Ще одне часткове повернення → версія OC-7266(2)
4. На дашборді показуємо тільки останню активну версію
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional
import re

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/return-versions", tags=["return-versions"])


# === PYDANTIC MODELS ===

class VersionItemRequest(BaseModel):
    """Товар для нової версії"""
    product_id: int
    sku: str
    name: str
    qty: int
    daily_rate: float = 0


class CreateVersionRequest(BaseModel):
    """Запит на створення версії"""
    not_returned_items: List[VersionItemRequest]


# === INIT TABLES ===

def ensure_version_tables(db: Session):
    """Створити таблиці для версій якщо не існують"""
    
    # Головна таблиця версій
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS partial_return_versions (
            version_id INT AUTO_INCREMENT PRIMARY KEY,
            parent_order_id INT NOT NULL COMMENT 'Оригінальне замовлення з OpenCart',
            version_number INT NOT NULL DEFAULT 1 COMMENT 'Номер версії (1, 2, 3...)',
            display_number VARCHAR(50) NOT NULL COMMENT 'Для відображення: OC-7266(1)',
            
            customer_name VARCHAR(255),
            customer_phone VARCHAR(50),
            customer_email VARCHAR(255),
            
            rental_end_date DATE COMMENT 'Дата закінчення оренди',
            total_price DECIMAL(10,2) DEFAULT 0,
            
            status ENUM('active', 'returned', 'archived') DEFAULT 'active',
            notes TEXT,
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            
            INDEX idx_parent_order (parent_order_id),
            INDEX idx_status (status),
            INDEX idx_display (display_number)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """))
    
    # Товари кожної версії
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS partial_return_version_items (
            item_id INT AUTO_INCREMENT PRIMARY KEY,
            version_id INT NOT NULL,
            product_id INT NOT NULL,
            sku VARCHAR(50),
            name VARCHAR(255),
            qty INT DEFAULT 1,
            daily_rate DECIMAL(10,2) DEFAULT 0,
            
            status ENUM('pending', 'returned', 'lost') DEFAULT 'pending',
            returned_at TIMESTAMP NULL,
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            
            INDEX idx_version (version_id),
            INDEX idx_product (product_id),
            FOREIGN KEY (version_id) REFERENCES partial_return_versions(version_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    """))
    
    db.commit()


def get_next_version_number(db: Session, parent_order_id: int, base_order_number: str) -> tuple:
    """
    Отримати наступний номер версії
    Returns: (version_number, display_number)
    """
    # Видалити існуючий суфікс з номера
    base = re.sub(r'\(\d+\)$', '', base_order_number).strip()
    
    # Знайти максимальну версію для цього замовлення
    result = db.execute(text("""
        SELECT MAX(version_number) FROM partial_return_versions 
        WHERE parent_order_id = :parent_id
    """), {"parent_id": parent_order_id}).scalar()
    
    next_version = (result or 0) + 1
    display_number = f"{base}({next_version})"
    
    return next_version, display_number


# === API ENDPOINTS ===

@router.post("/order/{order_id}/create-version")
async def create_partial_return_version(
    order_id: int,
    data: CreateVersionRequest,
    db: Session = Depends(get_rh_db)
):
    """
    Створити нову версію часткового повернення.
    
    Логіка:
    1. Оригінальне замовлення (order_id) отримує статус 'returned' (архів)
    2. Попередня версія (якщо є) отримує статус 'archived'
    3. Створюється нова версія в partial_return_versions з товарами що залишились
    4. На дашборді показується тільки остання активна версія
    """
    ensure_version_tables(db)
    
    try:
        # === 1. Отримати дані оригінального замовлення ===
        parent = db.execute(text("""
            SELECT order_id, order_number, customer_name, customer_phone, customer_email,
                   rental_start_date, rental_end_date, status
            FROM orders WHERE order_id = :id
        """), {"id": order_id}).fetchone()
        
        if not parent:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        parent_order_id = parent[0]
        parent_order_number = parent[1]
        
        # === 2. Перевірити чи є попередня активна версія ===
        # Якщо так - це повторне часткове повернення, беремо parent_order_id з неї
        existing_version = db.execute(text("""
            SELECT version_id, parent_order_id, display_number 
            FROM partial_return_versions 
            WHERE (parent_order_id = :order_id OR version_id = :order_id)
              AND status = 'active'
            ORDER BY version_number DESC
            LIMIT 1
        """), {"order_id": order_id}).fetchone()
        
        if existing_version:
            # Це версія - беремо справжній parent_order_id
            real_parent_id = existing_version[1]
            # Архівуємо попередню версію
            db.execute(text("""
                UPDATE partial_return_versions 
                SET status = 'archived', updated_at = NOW()
                WHERE version_id = :vid
            """), {"vid": existing_version[0]})
            print(f"[ReturnVersions] 📦 Архівовано попередню версію: {existing_version[2]}")
        else:
            real_parent_id = parent_order_id
        
        # === 3. Отримати дані батьківського замовлення ===
        parent_data = db.execute(text("""
            SELECT order_number, customer_name, customer_phone, customer_email, rental_end_date
            FROM orders WHERE order_id = :id
        """), {"id": real_parent_id}).fetchone()
        
        if not parent_data:
            raise HTTPException(status_code=404, detail="Батьківське замовлення не знайдено")
        
        # === 4. Генеруємо номер версії ===
        version_number, display_number = get_next_version_number(db, real_parent_id, parent_data[0])
        
        # === 5. Рахуємо суму ===
        total = sum(item.qty * item.daily_rate for item in data.not_returned_items)
        
        # === 6. Оновлюємо статус оригінального замовлення ===
        db.execute(text("""
            UPDATE orders 
            SET status = 'returned', updated_at = NOW()
            WHERE order_id = :id
        """), {"id": order_id})
        
        db.execute(text("""
            UPDATE issue_cards 
            SET status = 'returned', updated_at = NOW()
            WHERE order_id = :id
        """), {"id": order_id})
        
        # === 7. Створюємо нову версію ===
        db.execute(text("""
            INSERT INTO partial_return_versions (
                parent_order_id, version_number, display_number,
                customer_name, customer_phone, customer_email,
                rental_end_date, total_price, status
            ) VALUES (
                :parent_id, :version_num, :display_num,
                :name, :phone, :email,
                :end_date, :total, 'active'
            )
        """), {
            "parent_id": real_parent_id,
            "version_num": version_number,
            "display_num": display_number,
            "name": parent_data[1],
            "phone": parent_data[2],
            "email": parent_data[3],
            "end_date": parent_data[4],
            "total": total
        })
        
        # Отримуємо ID нової версії
        new_version_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        
        # === 8. Додаємо товари до версії ===
        for item in data.not_returned_items:
            db.execute(text("""
                INSERT INTO partial_return_version_items (
                    version_id, product_id, sku, name, qty, daily_rate
                ) VALUES (
                    :version_id, :product_id, :sku, :name, :qty, :rate
                )
            """), {
                "version_id": new_version_id,
                "product_id": item.product_id,
                "sku": item.sku,
                "name": item.name,
                "qty": item.qty,
                "rate": item.daily_rate
            })
        
        db.commit()
        
        print(f"[ReturnVersions] ✅ Створено версію {display_number} (ID: {new_version_id})")
        
        return {
            "success": True,
            "original_order_id": order_id,
            "parent_order_id": real_parent_id,
            "parent_order_number": parent_data[0],
            "version_id": new_version_id,
            "version_number": version_number,
            "display_number": display_number,
            "status": "active",
            "items_count": len(data.not_returned_items),
            "total_price": total,
            "redirect_url": f"/partial-return/{new_version_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ReturnVersions] ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/version/{version_id}")
async def get_version_details(
    version_id: int,
    db: Session = Depends(get_rh_db)
):
    """Отримати деталі версії часткового повернення"""
    ensure_version_tables(db)
    
    # Дані версії
    version = db.execute(text("""
        SELECT v.version_id, v.parent_order_id, v.version_number, v.display_number,
               v.customer_name, v.customer_phone, v.customer_email,
               v.rental_end_date, v.total_price, v.status, v.created_at,
               o.order_number as parent_order_number, o.rental_start_date
        FROM partial_return_versions v
        LEFT JOIN orders o ON v.parent_order_id = o.order_id
        WHERE v.version_id = :vid
    """), {"vid": version_id}).fetchone()
    
    if not version:
        raise HTTPException(status_code=404, detail="Версію не знайдено")
    
    # Товари версії з фото з таблиці products
    items = db.execute(text("""
        SELECT 
            vi.item_id, vi.product_id, vi.sku, vi.name, vi.qty, vi.daily_rate, 
            vi.status, vi.returned_at,
            p.image_url
        FROM partial_return_version_items vi
        LEFT JOIN products p ON vi.product_id = p.product_id
        WHERE vi.version_id = :vid
        ORDER BY vi.sku
    """), {"vid": version_id}).fetchall()
    
    # Історія версій для цього замовлення
    history = db.execute(text("""
        SELECT version_id, version_number, display_number, status, created_at
        FROM partial_return_versions
        WHERE parent_order_id = :parent_id
        ORDER BY version_number DESC
    """), {"parent_id": version[1]}).fetchall()
    
    # Розрахунок днів прострочення
    from datetime import date
    today = date.today()
    end_date = version[7]
    days_overdue = (today - end_date).days if end_date and today > end_date else 0
    
    return {
        "version_id": version[0],
        "parent_order_id": version[1],
        "parent_order_number": version[11],
        "version_number": version[2],
        "display_number": version[3],
        "customer": {
            "name": version[4],
            "phone": version[5],
            "email": version[6]
        },
        "rental_start_date": str(version[12]) if version[12] else None,
        "rental_end_date": str(version[7]) if version[7] else None,
        "days_overdue": days_overdue,
        "total_price": float(version[8] or 0),
        "status": version[9],
        "created_at": version[10].isoformat() if version[10] else None,
        "items": [{
            "item_id": item[0],
            "product_id": item[1],
            "sku": item[2],
            "name": item[3],
            "qty": item[4],
            "daily_rate": float(item[5] or 0),
            "status": item[6],
            "returned_at": item[7].isoformat() if item[7] else None,
            "image_url": item[8] if len(item) > 8 else None
        } for item in items],
        "version_history": [{
            "version_id": h[0],
            "version_number": h[1],
            "display_number": h[2],
            "status": h[3],
            "created_at": h[4].isoformat() if h[4] else None
        } for h in history]
    }


@router.get("/active")
async def get_active_versions(
    db: Session = Depends(get_rh_db)
):
    """
    Отримати всі активні версії для дашборду.
    Повертає тільки останню активну версію для кожного замовлення.
    """
    ensure_version_tables(db)
    
    versions = db.execute(text("""
        SELECT v.version_id, v.parent_order_id, v.display_number,
               v.customer_name, v.customer_phone,
               v.rental_end_date, v.total_price, v.created_at,
               o.order_number as parent_order_number,
               (SELECT COUNT(*) FROM partial_return_version_items WHERE version_id = v.version_id) as items_count
        FROM partial_return_versions v
        LEFT JOIN orders o ON v.parent_order_id = o.order_id
        WHERE v.status = 'active'
        ORDER BY v.created_at DESC
    """)).fetchall()
    
    from datetime import date
    today = date.today()
    
    result = []
    for v in versions:
        end_date = v[5]
        days_overdue = (today - end_date).days if end_date and today > end_date else 0
        
        result.append({
            "version_id": v[0],
            "parent_order_id": v[1],
            "display_number": v[2],
            "parent_order_number": v[8],
            "customer_name": v[3],
            "customer_phone": v[4],
            "rental_end_date": str(v[5]) if v[5] else None,
            "days_overdue": days_overdue,
            "total_price": float(v[6] or 0),
            "items_count": v[9],
            "created_at": v[7].isoformat() if v[7] else None
        })
    
    return {"versions": result, "count": len(result)}


@router.post("/version/{version_id}/return-item")
async def return_version_item(
    version_id: int,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Позначити товар як повернений у версії.
    Якщо всі товари повернено - версія закривається.
    """
    ensure_version_tables(db)
    
    item_id = data.get("item_id")
    sku = data.get("sku")
    qty_returned = data.get("qty", 1)
    
    try:
        # Знайти товар
        if item_id:
            item = db.execute(text("""
                SELECT item_id, product_id, sku, qty, daily_rate
                FROM partial_return_version_items
                WHERE item_id = :item_id AND version_id = :vid AND status = 'pending'
            """), {"item_id": item_id, "vid": version_id}).fetchone()
        else:
            item = db.execute(text("""
                SELECT item_id, product_id, sku, qty, daily_rate
                FROM partial_return_version_items
                WHERE sku = :sku AND version_id = :vid AND status = 'pending'
                LIMIT 1
            """), {"sku": sku, "vid": version_id}).fetchone()
        
        if not item:
            raise HTTPException(status_code=404, detail="Товар не знайдено або вже повернено")
        
        # Оновити статус товару
        db.execute(text("""
            UPDATE partial_return_version_items
            SET status = 'returned', returned_at = NOW()
            WHERE item_id = :item_id
        """), {"item_id": item[0]})
        
        # Перевірити чи всі товари повернено
        pending_count = db.execute(text("""
            SELECT COUNT(*) FROM partial_return_version_items
            WHERE version_id = :vid AND status = 'pending'
        """), {"vid": version_id}).scalar()
        
        all_returned = pending_count == 0
        
        if all_returned:
            # Закрити версію
            db.execute(text("""
                UPDATE partial_return_versions
                SET status = 'returned', updated_at = NOW()
                WHERE version_id = :vid
            """), {"vid": version_id})
        
        db.commit()
        
        return {
            "success": True,
            "item_id": item[0],
            "sku": item[2],
            "all_returned": all_returned,
            "pending_items": pending_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/version/{version_id}/complete")
async def complete_version(
    version_id: int,
    db: Session = Depends(get_rh_db)
):
    """Закрити версію (всі товари повернено)"""
    ensure_version_tables(db)
    
    try:
        # Позначити всі товари як повернені
        db.execute(text("""
            UPDATE partial_return_version_items
            SET status = 'returned', returned_at = NOW()
            WHERE version_id = :vid AND status = 'pending'
        """), {"vid": version_id})
        
        # Закрити версію
        db.execute(text("""
            UPDATE partial_return_versions
            SET status = 'returned', updated_at = NOW()
            WHERE version_id = :vid
        """), {"vid": version_id})
        
        db.commit()
        
        return {"success": True, "version_id": version_id, "status": "returned"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/order/{order_id}/versions")
async def get_order_versions(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """Отримати всі версії для замовлення (для архіву)"""
    ensure_version_tables(db)
    
    versions = db.execute(text("""
        SELECT version_id, version_number, display_number, status, 
               total_price, created_at,
               (SELECT COUNT(*) FROM partial_return_version_items WHERE version_id = v.version_id) as items_count
        FROM partial_return_versions v
        WHERE parent_order_id = :order_id
        ORDER BY version_number DESC
    """), {"order_id": order_id}).fetchall()
    
    return {
        "order_id": order_id,
        "versions": [{
            "version_id": v[0],
            "version_number": v[1],
            "display_number": v[2],
            "status": v[3],
            "total_price": float(v[4] or 0),
            "created_at": v[5].isoformat() if v[5] else None,
            "items_count": v[6]
        } for v in versions]
    }



# ============================================================
# ФІНАНСОВА ІНТЕГРАЦІЯ - Нарахування прострочення
# ============================================================

class ChargeLateRequest(BaseModel):
    """Нарахування прострочення з версії"""
    amount: float
    note: Optional[str] = None
    method: str = "cash"  # cash | bank


@router.post("/version/{version_id}/charge-late")
async def charge_late_fee(
    version_id: int,
    data: ChargeLateRequest,
    db: Session = Depends(get_rh_db)
):
    """
    Нарахувати прострочення з версії у фінансову систему.
    
    Логіка:
    1. Отримуємо дані версії (parent_order_id, days_overdue, total_price)
    2. Створюємо запис в fin_payments з типом 'late'
    3. Оновлюємо статус версії (fee_charged = True)
    """
    ensure_version_tables(db)
    
    try:
        # Отримуємо дані версії
        version = db.execute(text("""
            SELECT version_id, parent_order_id, display_number, total_price, rental_end_date, status
            FROM partial_return_versions
            WHERE version_id = :vid
        """), {"vid": version_id}).fetchone()
        
        if not version:
            raise HTTPException(status_code=404, detail="Версію не знайдено")
        
        parent_order_id = version[1]
        display_number = version[2]
        
        # Рахуємо дні прострочення
        from datetime import date
        today = date.today()
        rental_end = version[4]
        days_overdue = (today - rental_end).days if rental_end and today > rental_end else 0
        
        # Створюємо запис в fin_payments
        db.execute(text("""
            INSERT INTO fin_payments (order_id, payment_type, amount, currency, status, note, occurred_at, method)
            VALUES (:order_id, 'late', :amount, 'UAH', 'pending', :note, NOW(), :method)
        """), {
            "order_id": parent_order_id,
            "amount": data.amount,
            "note": data.note or f"Прострочення {display_number} ({days_overdue} дн.)",
            "method": data.method
        })
        
        payment_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        
        # Оновлюємо версію - позначаємо що нарахування зроблено
        db.execute(text("""
            UPDATE partial_return_versions
            SET notes = CONCAT(COALESCE(notes, ''), '\n[FIN] Нараховано прострочення: ₴', :amount, ' (payment_id=', :pid, ')')
            WHERE version_id = :vid
        """), {"amount": data.amount, "pid": payment_id, "vid": version_id})
        
        db.commit()
        
        print(f"[ReturnVersions] 💰 Нараховано прострочення: {display_number} → ₴{data.amount}")
        
        return {
            "success": True,
            "payment_id": payment_id,
            "version_id": version_id,
            "parent_order_id": parent_order_id,
            "amount": data.amount,
            "days_overdue": days_overdue
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ReturnVersions] ❌ Error charging late fee: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/version/{version_id}/finance-summary")
async def get_version_finance_summary(
    version_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати фінансовий підсумок версії:
    - Розрахункове прострочення
    - Нараховано
    - Оплачено
    """
    ensure_version_tables(db)
    
    try:
        # Дані версії
        version = db.execute(text("""
            SELECT version_id, parent_order_id, display_number, total_price, rental_end_date, status
            FROM partial_return_versions
            WHERE version_id = :vid
        """), {"vid": version_id}).fetchone()
        
        if not version:
            raise HTTPException(status_code=404, detail="Версію не знайдено")
        
        parent_order_id = version[1]
        total_price = float(version[3] or 0)
        rental_end = version[4]
        
        # Рахуємо дні прострочення
        from datetime import date
        today = date.today()
        days_overdue = (today - rental_end).days if rental_end and today > rental_end else 0
        
        # Розрахункова сума
        calculated_late_fee = total_price * days_overdue if days_overdue > 0 else 0
        
        # Нараховано (з fin_payments для цього order_id типу 'late')
        charged = db.execute(text("""
            SELECT COALESCE(SUM(amount), 0) FROM fin_payments
            WHERE order_id = :order_id AND payment_type = 'late' AND status = 'pending'
        """), {"order_id": parent_order_id}).scalar() or 0
        
        # Оплачено
        paid = db.execute(text("""
            SELECT COALESCE(SUM(amount), 0) FROM fin_payments
            WHERE order_id = :order_id AND payment_type = 'late' AND status IN ('completed', 'confirmed')
        """), {"order_id": parent_order_id}).scalar() or 0
        
        return {
            "version_id": version_id,
            "parent_order_id": parent_order_id,
            "display_number": version[2],
            "daily_rate": total_price,
            "days_overdue": days_overdue,
            "calculated_late_fee": calculated_late_fee,
            "charged_amount": float(charged),
            "paid_amount": float(paid),
            "due_amount": float(charged) - float(paid),
            "status": version[5]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
