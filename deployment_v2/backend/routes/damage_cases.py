"""
Damage Cases API - Кейси шкоди
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import text
from database_rentalhub import get_rh_db
from datetime import datetime
import uuid
import jwt
import os

router = APIRouter(prefix="/api/damage-cases", tags=["damage-cases"])

# JWT Configuration (має бути такий самий як в auth.py)
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"

def get_current_user(authorization: str = Header(None)):
    """Extract user info from JWT token"""
    if not authorization or not authorization.startswith('Bearer '):
        print("❌ No authorization header")
        return None
    
    try:
        token = authorization.split(' ')[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"✅ Token decoded: {payload}")
        return {
            'email': payload.get('email'),
            'username': payload.get('username') or payload.get('sub'),
            'user_id': payload.get('user_id')
        }
    except Exception as e:
        print(f"❌ Token decode error: {e}")
        return None


@router.post("/create")
async def create_damage_case(
    data: dict,
    authorization: str = Header(None),
    rh_db: Session = Depends(get_rh_db)
):
    """
    Створити кейс шкоди для товару
    
    action_type:
    - repair: Ремонт (заморожує товар)
    - restoration: Реставрація (заморожує товар)
    - washing: Мийка (заморожує товар)
    - total_loss: Повна втрата (віднімає від кількості)
    """
    try:
        # Отримати поточного користувача
        current_user = get_current_user(authorization)
        created_by = (current_user.get('username') or current_user.get('email')) if current_user else 'Unknown'
        
        product_id = data.get('product_id')
        qty = data.get('qty', 1)
        action_type = data.get('action_type', 'repair')
        description = data.get('description', '')
        estimated_cost = data.get('estimated_cost', 0)
        
        if not product_id or qty <= 0:
            raise HTTPException(status_code=400, detail="Некоректні дані")
        
        # Перевірити наявну кількість товару і frozen
        product_query = text("SELECT quantity, frozen_quantity FROM products WHERE product_id = :pid")
        product = rh_db.execute(product_query, {'pid': product_id}).fetchone()
        
        if not product:
            raise HTTPException(status_code=404, detail="Товар не знайдено")
        
        current_qty = product[0] or 0
        frozen_qty = product[1] or 0
        available_qty = current_qty - frozen_qty
        
        if qty > available_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Недостатньо товару. Доступно: {available_qty} (загалом: {current_qty}, заморожено: {frozen_qty})"
            )
        
        # Створити damage case
        damage_id = str(uuid.uuid4())
        
        # Генеруємо case_number (DMG-XXXX)
        count_query = text("SELECT COUNT(*) FROM damages")
        count = rh_db.execute(count_query).fetchone()[0]
        case_number = f"DMG-{count + 1:04d}"
        
        # 1. Створити запис в damages
        insert_damage = text("""
            INSERT INTO damages (
                id, case_number, case_status, severity, source, from_reaudit_item_id,
                notes, created_by, created_at, updated_at
            ) VALUES (
                :id, :case_number, 'open', 'minor', 'reaudit', :product_id,
                :notes, :created_by, NOW(), NOW()
            )
        """)
        
        rh_db.execute(insert_damage, {
            'id': damage_id,
            'case_number': case_number,
            'product_id': str(product_id),
            'notes': description,
            'created_by': created_by
        })
        
        # 2. Створити запис в damage_items
        insert_item = text("""
            INSERT INTO damage_items (
                damage_id, product_id, name, image, qty, frozen_qty,
                action_type, status, estimate_value, comment, created_at
            )
            SELECT 
                :damage_id, :product_id, name, image_url, :qty, :frozen_qty,
                :action_type, 'pending', :estimated_cost, :comment, NOW()
            FROM products
            WHERE product_id = :product_id
        """)
        
        frozen_qty = qty if action_type in ['repair', 'restoration', 'washing'] else 0
        
        rh_db.execute(insert_item, {
            'damage_id': damage_id,
            'product_id': product_id,
            'qty': qty,
            'frozen_qty': frozen_qty,
            'action_type': action_type,
            'estimated_cost': estimated_cost,
            'comment': description
        })
        
        # 3. Оновити кількість товару
        if action_type == 'total_loss':
            # Повна втрата - віднімаємо від кількості
            update_query = text("""
                UPDATE products 
                SET quantity = quantity - :qty
                WHERE product_id = :pid
            """)
            rh_db.execute(update_query, {'qty': qty, 'pid': product_id})
            message = f"Повна втрата: віднято {qty} од."
        else:
            # Ремонт/Реставрація/Мийка - заморожуємо товар
            update_query = text("""
                UPDATE products 
                SET frozen_quantity = frozen_quantity + :qty
                WHERE product_id = :pid
            """)
            rh_db.execute(update_query, {'qty': qty, 'pid': product_id})
            message = f"{action_type.capitalize()}: заморожено {qty} од."
        
        rh_db.commit()
        
        return {
            'success': True,
            'damage_id': damage_id,
            'case_number': case_number,
            'message': message,
            'action_type': action_type,
            'qty': qty,
            'frozen_qty': frozen_qty
        }
        
    except HTTPException:
        raise
    except Exception as e:
        rh_db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.get("/product/{product_id}")
async def get_product_damage_cases(
    product_id: int,
    rh_db: Session = Depends(get_rh_db)
):
    """
    Отримати всі кейси шкоди для товару
    """
    try:
        query = text("""
            SELECT 
                di.id,
                di.damage_id,
                di.product_id,
                di.name,
                di.image,
                di.action_type,
                di.status,
                di.qty,
                di.frozen_qty,
                di.estimate_value,
                di.comment,
                di.created_at,
                d.case_status,
                d.notes,
                d.created_by,
                d.case_number
            FROM damage_items di
            LEFT JOIN damages d ON di.damage_id = d.id
            WHERE di.product_id = :pid
            ORDER BY di.created_at DESC
        """)
        
        results = rh_db.execute(query, {'pid': product_id}).fetchall()
        
        cases = []
        for row in results:
            cases.append({
                'id': row[0],
                'damage_id': row[1],
                'product_id': row[2],
                'product_name': row[3],
                'image': row[4],
                'action_type': row[5],
                'status': row[6],
                'qty': row[7],
                'frozen_qty': row[8],
                'estimate_value': float(row[9]) if row[9] else 0,
                'comment': row[10],
                'created_at': row[11].isoformat() if row[11] else None,
                'case_status': row[12],
                'notes': row[13],
                'created_by': row[14],
                'case_number': row[15]
            })
        
        return cases
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.get("/all")
async def get_all_damage_cases(
    rh_db: Session = Depends(get_rh_db)
):
    """
    Отримати всі кейси шкоди
    """
    try:
        query = text("""
            SELECT 
                di.id,
                di.damage_id,
                di.product_id,
                di.name,
                di.image,
                di.action_type,
                di.status,
                di.qty,
                di.frozen_qty,
                di.estimate_value,
                di.comment,
                di.created_at,
                d.case_status,
                d.notes,
                d.created_by,
                d.case_number
            FROM damage_items di
            LEFT JOIN damages d ON di.damage_id = d.id
            ORDER BY di.created_at DESC
        """)
        
        results = rh_db.execute(query).fetchall()
        
        cases = []
        for row in results:
            cases.append({
                'id': row[0],
                'damage_id': row[1],
                'product_id': row[2],
                'product_name': row[3],
                'image': row[4],
                'action_type': row[5],
                'status': row[6],
                'qty': row[7],
                'frozen_qty': row[8],
                'estimate_value': float(row[9]) if row[9] else 0,
                'comment': row[10],
                'created_at': row[11].isoformat() if row[11] else None,
                'case_status': row[12],
                'notes': row[13],
                'created_by': row[14],
                'case_number': row[15]
            })
        
        return cases
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.delete("/{damage_id}")
async def delete_damage_case(
    damage_id: str,
    rh_db: Session = Depends(get_rh_db)
):
    """
    Видалити кейс шкоди (розморожує товар і видаляє всі записи)
    """
    try:
        # Отримати всі damage_items для цього кейсу
        query = text("""
            SELECT id, product_id, action_type, frozen_qty, qty
            FROM damage_items
            WHERE damage_id = :damage_id
        """)
        
        items = rh_db.execute(query, {'damage_id': damage_id}).fetchall()
        
        if not items:
            raise HTTPException(status_code=404, detail="Кейс не знайдено")
        
        # Розморозити товари або повернути кількість
        for item in items:
            item_id, product_id, action_type, frozen_qty, qty = item
            
            if action_type == 'total_loss':
                # Повернути кількість назад
                update_query = text("""
                    UPDATE products 
                    SET quantity = quantity + :qty
                    WHERE product_id = :pid
                """)
                rh_db.execute(update_query, {'qty': qty, 'pid': product_id})
            else:
                # Розморозити товар
                if frozen_qty > 0:
                    unfreeze_query = text("""
                        UPDATE products 
                        SET frozen_quantity = GREATEST(0, frozen_quantity - :qty)
                        WHERE product_id = :pid
                    """)
                    rh_db.execute(unfreeze_query, {'qty': frozen_qty, 'pid': product_id})
        
        # Видалити damage_items
        delete_items = text("DELETE FROM damage_items WHERE damage_id = :damage_id")
        rh_db.execute(delete_items, {'damage_id': damage_id})
        
        # Видалити damage
        delete_damage = text("DELETE FROM damages WHERE id = :damage_id")
        rh_db.execute(delete_damage, {'damage_id': damage_id})
        
        rh_db.commit()
        
        return {
            'success': True,
            'message': f'Кейс видалено. Оброблено {len(items)} позицій.',
            'items_count': len(items)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        rh_db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.put("/{damage_item_id}/complete")
async def complete_damage_case(
    damage_item_id: int,
    rh_db: Session = Depends(get_rh_db)
):
    """
    Завершити кейс шкоди (розморозити товар якщо був заморожений)
    """
    try:
        # Отримати інформацію про кейс
        query = text("""
            SELECT product_id, action_type, frozen_qty, status
            FROM damage_items
            WHERE id = :id
        """)
        
        result = rh_db.execute(query, {'id': damage_item_id}).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Кейс не знайдено")
        
        product_id, action_type, frozen_qty, status = result
        
        if status == 'completed':
            return {'success': True, 'message': 'Кейс вже завершено'}
        
        # Оновити статус кейсу
        update_query = text("""
            UPDATE damage_items 
            SET status = 'completed', frozen_qty = 0
            WHERE id = :id
        """)
        
        rh_db.execute(update_query, {'id': damage_item_id})
        
        # Розморозити товар якщо був заморожений (не total_loss)
        if action_type in ['repair', 'restoration', 'washing'] and frozen_qty > 0:
            unfreeze_query = text("""
                UPDATE products 
                SET frozen_quantity = GREATEST(0, frozen_quantity - :qty)
                WHERE product_id = :pid
            """)
            rh_db.execute(unfreeze_query, {'qty': frozen_qty, 'pid': product_id})
        
        rh_db.commit()
        
        return {
            'success': True,
            'message': 'Кейс завершено',
            'action': 'unfrozen' if action_type != 'total_loss' else 'none'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        rh_db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")
