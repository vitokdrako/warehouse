"""
Return Versions API v2 - Створення "дочірніх" замовлень при частковому поверненні

Логіка:
1. При частковому поверненні #OC-7293:
   - Оригінальне #OC-7293 → статус 'returned'
   - Створюється НОВЕ замовлення #OC-7293(1) в таблиці orders
   - Нове замовлення містить ТІЛЬКИ неповернені товари
   - Статус нового замовлення: 'partial_return'
   
2. Нове замовлення відображається:
   - На дашборді в колонці "Часткове повернення"
   - При кліку відкривається /return/{new_order_id}
   - Той самий ReturnOrderWorkspace!
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, date
from pydantic import BaseModel
from typing import List, Optional
import re

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/return-versions", tags=["return-versions"])


def ensure_parent_order_column(db: Session):
    """Додати колонку parent_order_id якщо не існує"""
    try:
        db.execute(text("""
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_order_id INT DEFAULT NULL
        """))
        db.commit()
    except Exception as e:
        # Колонка може вже існувати
        db.rollback()
        # Спробуємо альтернативний синтаксис для MySQL < 8
        try:
            # Перевірити чи колонка існує
            result = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.columns 
                WHERE table_schema = DATABASE() 
                AND table_name = 'orders' 
                AND column_name = 'parent_order_id'
            """)).scalar()
            
            if result == 0:
                db.execute(text("""
                    ALTER TABLE orders ADD COLUMN parent_order_id INT DEFAULT NULL
                """))
                db.commit()
        except:
            db.rollback()


class CreateChildOrderRequest(BaseModel):
    """Запит на створення дочірнього замовлення"""
    items: List[dict]  # [{product_id, sku, name, qty, daily_rate}]
    notes: Optional[str] = None


def get_next_version_number(db: Session, base_order_number: str) -> int:
    """Отримати наступний номер версії для замовлення"""
    # Видалити існуючий суфікс якщо є
    base = re.sub(r'\(\d+\)$', '', base_order_number).strip()
    
    # Знайти всі версії цього замовлення
    result = db.execute(text("""
        SELECT order_number FROM orders 
        WHERE order_number LIKE :pattern
        ORDER BY order_number DESC
    """), {"pattern": f"{base}(%"}).fetchall()
    
    if not result:
        return 1
    
    # Знайти максимальний номер версії
    max_version = 0
    for row in result:
        match = re.search(r'\((\d+)\)$', row[0])
        if match:
            version = int(match.group(1))
            max_version = max(max_version, version)
    
    return max_version + 1


@router.post("/order/{order_id}/create-child")
async def create_child_order(
    order_id: int,
    data: CreateChildOrderRequest,
    db: Session = Depends(get_rh_db)
):
    """
    Створити дочірнє замовлення з неповернених товарів
    
    - Оригінальне замовлення → статус 'returned'
    - Нове замовлення → статус 'partial_return', номер OC-XXXX(N)
    - Нове замовлення містить тільки неповернені товари
    """
    # Переконатись що колонка parent_order_id існує
    ensure_parent_order_column(db)
    
    try:
        # Отримати оригінальне замовлення
        parent = db.execute(text("""
            SELECT order_id, order_number, customer_name, customer_phone, customer_email,
                   rental_start_date, rental_end_date, total_price, deposit_amount,
                   address, delivery_notes, source
            FROM orders WHERE order_id = :id
        """), {"id": order_id}).fetchone()
        
        if not parent:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        parent_order_number = parent[1]
        
        # Визначити номер версії
        version_number = get_next_version_number(db, parent_order_number)
        
        # Базовий номер (без суфікса)
        base_number = re.sub(r'\(\d+\)$', '', parent_order_number).strip()
        new_order_number = f"{base_number}({version_number})"
        
        # Розрахувати суму для нового замовлення
        total_price = sum(item.get('qty', 0) * item.get('daily_rate', 0) for item in data.items)
        
        # Створити нове замовлення
        db.execute(text("""
            INSERT INTO orders (
                order_number, customer_name, customer_phone, customer_email,
                rental_start_date, rental_end_date,
                total_price, deposit_amount,
                status, source,
                address, delivery_notes,
                parent_order_id,
                created_at, updated_at
            ) VALUES (
                :order_number, :name, :phone, :email,
                :start_date, :end_date,
                :total, :deposit,
                'partial_return', :source,
                :address, :notes,
                :parent_id,
                NOW(), NOW()
            )
        """), {
            "order_number": new_order_number,
            "name": parent[2],
            "phone": parent[3],
            "email": parent[4],
            "start_date": datetime.now().date(),  # Починається сьогодні
            "end_date": parent[6],  # Оригінальна дата повернення
            "total": total_price,
            "deposit": 0,  # Застава залишається в оригінальному
            "source": parent[11] or 'partial_return',
            "address": parent[9],
            "notes": data.notes or f"Часткове повернення з {parent_order_number}",
            "parent_id": order_id
        })
        
        # Отримати ID нового замовлення
        new_order_id = db.execute(text("SELECT LAST_INSERT_ID()")).scalar()
        
        # Додати товари до нового замовлення
        for item in data.items:
            db.execute(text("""
                INSERT INTO order_items (
                    order_id, product_id, quantity, rental_price
                ) VALUES (
                    :order_id, :product_id, :qty, :price
                )
            """), {
                "order_id": new_order_id,
                "product_id": item.get('product_id'),
                "qty": item.get('qty'),
                "price": item.get('daily_rate', 0)
            })
        
        # Створити issue_card для нового замовлення
        db.execute(text("""
            INSERT INTO issue_cards (
                order_id, order_number, customer_name, customer_phone,
                rental_start_date, rental_end_date,
                total_rental, deposit_amount,
                status, created_at, updated_at
            ) VALUES (
                :order_id, :order_number, :name, :phone,
                :start_date, :end_date,
                :total, 0,
                'partial_return', NOW(), NOW()
            )
        """), {
            "order_id": new_order_id,
            "order_number": new_order_number,
            "name": parent[2],
            "phone": parent[3],
            "start_date": datetime.now().date(),
            "end_date": parent[6],
            "total": total_price
        })
        
        # Закрити оригінальне замовлення
        db.execute(text("""
            UPDATE orders 
            SET status = 'returned',
                has_partial_return = 1,
                updated_at = NOW()
            WHERE order_id = :id
        """), {"id": order_id})
        
        # Оновити issue_card оригінального замовлення
        db.execute(text("""
            UPDATE issue_cards 
            SET status = 'returned',
                updated_at = NOW()
            WHERE order_id = :id
        """), {"id": order_id})
        
        # Записати в lifecycle
        db.execute(text("""
            INSERT INTO order_lifecycle (order_id, stage, notes, created_at)
            VALUES (:order_id, 'partial_return_created', :notes, NOW())
        """), {
            "order_id": order_id,
            "notes": f"Створено {new_order_number} з {len(data.items)} товарами"
        })
        
        db.commit()
        
        return {
            "success": True,
            "parent_order_id": order_id,
            "parent_order_number": parent_order_number,
            "new_order_id": new_order_id,
            "new_order_number": new_order_number,
            "version_number": version_number,
            "items_count": len(data.items),
            "redirect_url": f"/return/{new_order_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ReturnVersions] ❌ Error creating child order: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/partial-return-orders")
async def get_partial_return_orders(
    db: Session = Depends(get_rh_db)
):
    """
    Отримати всі замовлення зі статусом partial_return (для дашборду)
    """
    # Переконатись що колонка parent_order_id існує
    ensure_parent_order_column(db)
    
    try:
        # Спочатку перевіримо чи колонка існує
        has_parent_col = False
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.columns 
                WHERE table_schema = DATABASE() 
                AND table_name = 'orders' 
                AND column_name = 'parent_order_id'
            """)).scalar()
            has_parent_col = check > 0
        except:
            pass
        
        if has_parent_col:
            query = """
                SELECT 
                    o.order_id, o.order_number, o.customer_name, o.customer_phone,
                    o.rental_start_date, o.rental_end_date,
                    o.total_price, o.deposit_amount,
                    o.parent_order_id, o.status, o.created_at,
                    ic.id as issue_card_id,
                    DATEDIFF(CURDATE(), o.rental_end_date) as days_overdue
                FROM orders o
                LEFT JOIN issue_cards ic ON o.order_id = ic.order_id
                WHERE o.status = 'partial_return'
                ORDER BY o.created_at DESC
            """
        else:
            query = """
                SELECT 
                    o.order_id, o.order_number, o.customer_name, o.customer_phone,
                    o.rental_start_date, o.rental_end_date,
                    o.total_price, o.deposit_amount,
                    NULL as parent_order_id, o.status, o.created_at,
                    ic.id as issue_card_id,
                    DATEDIFF(CURDATE(), o.rental_end_date) as days_overdue
                FROM orders o
                LEFT JOIN issue_cards ic ON o.order_id = ic.order_id
                WHERE o.status = 'partial_return'
                ORDER BY o.created_at DESC
            """
        
        result = db.execute(text(query))
        
        orders = []
        for row in result:
            # Отримати товари
            items = db.execute(text("""
                SELECT oi.product_id, p.sku, p.name, oi.quantity, oi.rental_price
                FROM order_items oi
                LEFT JOIN products p ON oi.product_id = p.product_id
                WHERE oi.order_id = :order_id
            """), {"order_id": row[0]}).fetchall()
            
            items_list = []
            daily_fee = 0
            for item in items:
                rate = float(item[4] or 0)
                qty = item[3] or 0
                daily_fee += rate * qty
                items_list.append({
                    "product_id": item[0],
                    "sku": item[1] or "",
                    "name": item[2] or "",
                    "qty": qty,
                    "daily_rate": rate
                })
            
            days_overdue = max(0, row[12] or 0)
            
            orders.append({
                "order_id": row[0],
                "order_number": row[1],
                "customer_name": row[2] or "",
                "customer_phone": row[3] or "",
                "rental_start_date": str(row[4]) if row[4] else None,
                "rental_end_date": str(row[5]) if row[5] else None,
                "total_price": float(row[6] or 0),
                "deposit_amount": float(row[7] or 0),
                "parent_order_id": row[8],
                "status": row[9],
                "issue_card_id": row[11],
                "days_overdue": days_overdue,
                "daily_fee": daily_fee,
                "calculated_fee": daily_fee * days_overdue,
                "items": items_list,
                "items_count": len(items_list)
            })
        
        return {"orders": orders, "count": len(orders)}
        
    except Exception as e:
        print(f"[ReturnVersions] ❌ Error fetching partial return orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/order/{order_id}/children")
async def get_child_orders(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати всі дочірні замовлення (версії) для батьківського
    """
    try:
        result = db.execute(text("""
            SELECT order_id, order_number, status, created_at, total_price
            FROM orders
            WHERE parent_order_id = :parent_id
            ORDER BY created_at
        """), {"parent_id": order_id})
        
        children = []
        for row in result:
            children.append({
                "order_id": row[0],
                "order_number": row[1],
                "status": row[2],
                "created_at": row[3].isoformat() if row[3] else None,
                "total_price": float(row[4] or 0)
            })
        
        return {"parent_order_id": order_id, "children": children, "count": len(children)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== BACKWARD COMPATIBILITY ==========
# Старі endpoints для сумісності з попереднім кодом

@router.get("")
async def get_active_versions(db: Session = Depends(get_rh_db)):
    """Старий endpoint - перенаправляє на новий"""
    result = await get_partial_return_orders(db)
    # Конвертуємо формат для сумісності
    versions = []
    for order in result["orders"]:
        versions.append({
            "id": order["order_id"],
            "parent_order_id": order["parent_order_id"],
            "version_number": 1,
            "order_number": order["order_number"],
            "customer_name": order["customer_name"],
            "customer_phone": order["customer_phone"],
            "original_return_date": order["rental_end_date"],
            "days_overdue": order["days_overdue"],
            "daily_fee": order["daily_fee"],
            "calculated_total_fee": order["calculated_fee"],
            "fee_status": "pending",
            "status": "active",
            "items": order["items"],
            "remaining_items": order["items_count"]
        })
    return {"versions": versions, "count": len(versions)}
