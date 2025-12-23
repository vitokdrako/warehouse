"""
Orders routes - MySQL version
Reads from OpenCart oc_order tables
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, date
import uuid
import json
import os

from database import get_db as get_oc_db  # OpenCart DB
from database_rentalhub import get_rh_db  # RentalHub DB
from models_sqlalchemy import (
    OpenCartOrder, OpenCartOrderProduct, OpenCartProduct,
    OpenCartOrderSimpleFields, DecorOrderLifecycle, OpenCartCustomer,
    OpenCartProductDescription, DecorIssueCard, DecorReturnCard,
    FinanceTransaction, DecorOrder, DecorOrderItem
)
from utils.telegram_sender import send_order_confirmation_telegram

router = APIRouter(prefix="/api/orders", tags=["orders"])


# Router для decor_orders
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
    order_status_id: Optional[int] = None  # Числовий ID статусу з OpenCart
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

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def map_opencart_status_to_internal(status_id: int) -> str:
    """Map OpenCart order status to internal status"""
    status_map = {
        1: "pending",      # В обробці
        2: "pending",      # В обработке (processing)
        9: "cancelled",    # Відміна та анулювання
        13: "returned",    # Повне повернення
        19: "pending",     # Замовлення опрацьоване (ready to issue)
        24: "on_rent",     # Замовлення видано (issued - on rent)
    }
    return status_map.get(status_id, "pending")

def get_lifecycle_status(order_id: int, db: Session) -> dict:
    """Get lifecycle status for order - prioritize OpenCart dates"""
    
    # First, try to get dates from OpenCart simple_fields
    oc_simple = db.query(OpenCartOrderSimpleFields).filter(
        OpenCartOrderSimpleFields.order_id == order_id
    ).first()
    
    # Then check our lifecycle table for additional info
    lifecycle = db.query(DecorOrderLifecycle).filter(
        DecorOrderLifecycle.order_id == order_id
    ).first()
    
    # Use OpenCart dates if available, otherwise fall back to lifecycle
    issue_date = None
    return_date = None
    
    if oc_simple:
        # OpenCart dates have priority (format: YYYY-MM-DD string)
        if oc_simple.rent_issue_date:
            issue_date = oc_simple.rent_issue_date
        if oc_simple.rent_return_date:
            return_date = oc_simple.rent_return_date
    
    # Fall back to lifecycle dates if OpenCart dates not available
    if not issue_date and lifecycle and lifecycle.issue_date:
        issue_date = lifecycle.issue_date.isoformat()
    if not return_date and lifecycle and lifecycle.return_date:
        return_date = lifecycle.return_date.isoformat()
    
    # Get other lifecycle info
    if lifecycle:
        return {
            "issue_date": issue_date,
            "return_date": return_date,
            "issued_at": lifecycle.issued_at.isoformat() if lifecycle.issued_at else None,
            "returned_at": lifecycle.returned_at.isoformat() if lifecycle.returned_at else None,
            "lifecycle_status": lifecycle.lifecycle_status,
            "manager_comment": lifecycle.manager_comment
        }
    
    return {
        "issue_date": issue_date,
        "return_date": return_date,
        "issued_at": None,
        "returned_at": None,
        "lifecycle_status": "draft",
        "manager_comment": None
    }

# ============================================================
# API ENDPOINTS
# ============================================================

@router.get("")
async def get_orders(
    status: Optional[str] = None,
    client_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 1000,  # Збільшено до 1000
    db: Session = Depends(get_oc_db)
):
    """Get all orders from OpenCart with rental dates filter"""
    
    # Join with oc_order_simple_fields to check rental dates
    query = db.query(OpenCartOrder).join(
        OpenCartOrderSimpleFields,
        OpenCartOrder.order_id == OpenCartOrderSimpleFields.order_id,
        isouter=True  # LEFT JOIN to include orders without simple_fields
    )
    
    # Date range filter (for calendar view)
    if from_date and to_date:
        # Filter by date_added, rent_issue_date, or rent_return_date falling in range
        query = query.filter(
            or_(
                and_(
                    func.date(OpenCartOrder.date_added) >= from_date,
                    func.date(OpenCartOrder.date_added) <= to_date
                ),
                and_(
                    OpenCartOrderSimpleFields.rent_issue_date.isnot(None),
                    OpenCartOrderSimpleFields.rent_issue_date >= from_date,
                    OpenCartOrderSimpleFields.rent_issue_date <= to_date
                ),
                and_(
                    OpenCartOrderSimpleFields.rent_return_date.isnot(None),
                    OpenCartOrderSimpleFields.rent_return_date >= from_date,
                    OpenCartOrderSimpleFields.rent_return_date <= to_date
                )
            )
        )
    
    # Filter by client
    if client_id:
        query = query.filter(OpenCartOrder.customer_id == int(client_id))
    
    # Filter by status
    if status:
        # Map internal status to OpenCart status IDs
        status_map_reverse = {
            "pending": [1, 2, 19],
            "on_rent": [24],
            "returned": [13],
            "completed": [5],
            "cancelled": [9],
            "draft": [10]
        }
        status_ids = status_map_reverse.get(status, [])
        if status_ids:
            query = query.filter(OpenCartOrder.order_status_id.in_(status_ids))
    else:
        # Якщо статус НЕ вказаний - виключити завершені та скасовані з календаря
        # Завершені замовлення мають бути тільки в Архіві
        archived_statuses = [13, 5, 9]  # returned, completed, cancelled
        query = query.filter(~OpenCartOrder.order_status_id.in_(archived_statuses))
    
    # Get orders (order by order_id DESC to get latest orders)
    oc_orders = query.order_by(OpenCartOrder.order_id.desc()).limit(limit).all()
    
    result = []
    for oc_order in oc_orders:
        # Get order products WITH photos
        oc_products = db.query(
            OpenCartOrderProduct,
            OpenCartProduct.ean,
            OpenCartProduct.image
        ).join(
            OpenCartProduct,
            OpenCartOrderProduct.product_id == OpenCartProduct.product_id
        ).filter(
            OpenCartOrderProduct.order_id == oc_order.order_id
        ).all()
        
        # Get lifecycle data
        lifecycle = get_lifecycle_status(oc_order.order_id, db)
        
        # Convert to internal format
        items = []
        total_rental = 0.0
        total_deposit = 0.0
        
        for oc_prod, ean_value, image_value in oc_products:
            item_total = float(oc_prod.total)
            total_rental += item_total
            
            # Застава = (кількість × збиток) / 2
            # ean = збиток (повна вартість втрати)
            # Clean ean_value from currency symbols
            clean_ean = str(ean_value).replace('грн.', '').replace('грн', '').strip() if ean_value else None
            try:
                damage_cost = float(clean_ean) if clean_ean else float(oc_prod.price) * 10
            except ValueError:
                damage_cost = float(oc_prod.price) * 10  # Fallback
            item_deposit = (oc_prod.quantity * damage_cost) / 2
            total_deposit += item_deposit
            
            items.append({
                "inventory_id": str(oc_prod.product_id),
                "article": oc_prod.model,
                "name": oc_prod.name,
                "quantity": oc_prod.quantity,
                "price_per_day": float(oc_prod.price),
                "damage_cost": damage_cost,  # Збиток (ean)
                "total_rental": item_total,
                "deposit": item_deposit,
                "total_deposit": item_deposit,
                "image": image_value
            })
        
        order_dict = {
            "id": str(oc_order.order_id),
            "order_number": str(oc_order.order_id),
            "client_id": oc_order.customer_id,
            "client_name": f"{oc_order.firstname} {oc_order.lastname}",
            "client_phone": oc_order.telephone or "",
            "client_email": oc_order.email or "",
            "status": map_opencart_status_to_internal(oc_order.order_status_id),
            "order_status_id": oc_order.order_status_id,  # Числовий ID статусу з бази
            "issue_date": lifecycle["issue_date"],
            "return_date": lifecycle["return_date"],
            "items": items,
            "total_rental": total_rental,
            "total_deposit": total_deposit,
            "deposit_held": total_deposit,
            "manager_comment": lifecycle["manager_comment"],
            "created_at": oc_order.date_added.isoformat() if oc_order.date_added else datetime.now().isoformat()
        }
        
        result.append(order_dict)
    
    return result

@router.get("/{order_id}")
async def get_order(order_id: str, db: Session = Depends(get_oc_db)):
    """Get single order by ID or order number"""
    
    # Try as integer ID
    try:
        oc_order = db.query(OpenCartOrder).filter(
            OpenCartOrder.order_id == int(order_id)
        ).first()
    except ValueError:
        oc_order = None
    
    if not oc_order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get order products WITH photos
    oc_products = db.query(
        OpenCartOrderProduct,
        OpenCartProduct.ean,
        OpenCartProduct.image
    ).join(
        OpenCartProduct,
        OpenCartOrderProduct.product_id == OpenCartProduct.product_id
    ).filter(
        OpenCartOrderProduct.order_id == oc_order.order_id
    ).all()
    
    # Get lifecycle data
    lifecycle = get_lifecycle_status(oc_order.order_id, db)
    
    # Convert to internal format
    items = []
    total_rental = 0.0
    total_deposit = 0.0
    
    for oc_prod, ean_value, image_value in oc_products:
        item_total = float(oc_prod.total)
        total_rental += item_total
        
        # Застава = (кількість × збиток) / 2
        # Clean ean_value from currency symbols
        clean_ean = str(ean_value).replace('грн.', '').replace('грн', '').strip() if ean_value else None
        try:
            damage_cost = float(clean_ean) if clean_ean else float(oc_prod.price) * 10
        except ValueError:
            damage_cost = float(oc_prod.price) * 10  # Fallback
        item_deposit = (oc_prod.quantity * damage_cost) / 2
        total_deposit += item_deposit
        
        # Get inventory data (quantity from oc_product)
        product_info = db.query(OpenCartProduct).filter(
            OpenCartProduct.product_id == oc_prod.product_id
        ).first()
        
        # Наявність = quantity в oc_product
        available_qty = int(product_info.quantity) if product_info and product_info.quantity else 0
        
        # TODO: Резерв, в оренді, в реставрації - потрібно рахувати з інших замовлень
        # Поки що заглушки:
        reserved_qty = 0
        in_rent_qty = 0  
        in_restore_qty = 0
        
        items.append({
            "inventory_id": str(oc_prod.product_id),
            "article": oc_prod.model,
            "name": oc_prod.name,
            "quantity": oc_prod.quantity,
            "price_per_day": float(oc_prod.price),
            "damage_cost": damage_cost,  # Збиток (ean)
            "total_rental": item_total,
            "deposit": item_deposit,
            "total_deposit": item_deposit,
            "available_qty": available_qty,
            "reserved_qty": reserved_qty,
            "in_rent_qty": in_rent_qty,
            "in_restore_qty": in_restore_qty,
            "image": image_value
        })
    
    return {
        "id": str(oc_order.order_id),
        "order_number": str(oc_order.order_id),
        "client_id": oc_order.customer_id,
        "client_name": f"{oc_order.firstname} {oc_order.lastname}",
        "client_phone": oc_order.telephone or "",
        "client_email": oc_order.email or "",
        "status": map_opencart_status_to_internal(oc_order.order_status_id),
        "order_status_id": oc_order.order_status_id,  # Числовий ID статусу з бази
        "issue_date": lifecycle["issue_date"],
        "return_date": lifecycle["return_date"],
        "items": items,
        "total_rental": total_rental,
        "total_deposit": total_deposit,
        "deposit_held": total_deposit,
        "manager_comment": lifecycle["manager_comment"],
        "created_at": oc_order.date_added.isoformat() if oc_order.date_added else datetime.now().isoformat()
    }

@router.put("/{order_id}")
async def update_order(
    order_id: str,
    update_data: dict,
    db: Session = Depends(get_oc_db)
):
    """
    Update order
    
    Body:
    {
        "status": str (optional) - "pending", "on_rent", "returned"
        "manager_comment": str (optional)
        "issue_date": str (optional)
        "return_date": str (optional)
    }
    """
    try:
        # Знайти замовлення
        order = db.query(OpenCartOrder).filter(
            OpenCartOrder.order_id == int(order_id)
        ).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        # Оновити статус
        if 'status' in update_data:
            status_map = {
                'pending': 19,
                'processing': 2,
                'ready_for_issue': 3,
                'on_rent': 24,
                'returned': 25
            }
            new_status = status_map.get(update_data['status'])
            if new_status:
                order.order_status_id = new_status
                order.date_modified = datetime.now()
        
        # Підтримка прямої зміни status_id
        if 'status_id' in update_data:
            order.order_status_id = int(update_data['status_id'])
            order.date_modified = datetime.now()
        
        # Оновити коментар
        if 'manager_comment' in update_data:
            order.comment = update_data['manager_comment']
        
        # Оновити дати в simple_fields
        # Оновлюємо обидва поля: text (rent_issue, rent_return) та date (rent_issue_date, rent_return_date)
        if 'issue_date' in update_data or 'return_date' in update_data:
            simple_fields = db.query(OpenCartOrderSimpleFields).filter(
                OpenCartOrderSimpleFields.order_id == int(order_id)
            ).first()
            
            if simple_fields:
                if 'issue_date' in update_data:
                    print(f"[UPDATE] Updating simple_fields.rent_issue_date: {simple_fields.rent_issue_date} → {update_data['issue_date']}")
                    simple_fields.rent_issue = str(update_data['issue_date'])
                    simple_fields.rent_issue_date = update_data['issue_date']
                if 'return_date' in update_data:
                    print(f"[UPDATE] Updating simple_fields.rent_return_date: {simple_fields.rent_return_date} → {update_data['return_date']}")
                    simple_fields.rent_return = str(update_data['return_date'])
                    simple_fields.rent_return_date = update_data['return_date']
            else:
                # Створити якщо немає
                print(f"[UPDATE] Creating new simple_fields record")
                simple_fields = OpenCartOrderSimpleFields(
                    order_id=int(order_id),
                    rent_issue=str(update_data.get('issue_date')) if update_data.get('issue_date') else None,
                    rent_issue_date=update_data.get('issue_date'),
                    rent_return=str(update_data.get('return_date')) if update_data.get('return_date') else None,
                    rent_return_date=update_data.get('return_date')
                )
                db.add(simple_fields)
        
        # Оновити lifecycle
        lifecycle = db.query(DecorOrderLifecycle).filter(
            DecorOrderLifecycle.order_id == int(order_id)
        ).first()
        
        if lifecycle and 'manager_comment' in update_data:
            lifecycle.manager_comment = update_data['manager_comment']
        
        # Якщо змінюємо на on_rent - записати issued_at
        if update_data.get('status') == 'on_rent' and lifecycle:
            lifecycle.issued_at = datetime.now()
            lifecycle.lifecycle_status = 'issued'
        
        # Якщо змінюємо на returned - записати returned_at
        if update_data.get('status') == 'returned' and lifecycle:
            lifecycle.returned_at = datetime.now()
            lifecycle.lifecycle_status = 'returned'
        
        # Оновити decor_orders якщо існує
        decor_order = db.query(DecorOrder).filter(
            or_(
                DecorOrder.id == int(order_id),
                DecorOrder.opencart_order_id == int(order_id)
            )
        ).first()
        
        if decor_order:
            print(f"[UPDATE] Found DecorOrder id={decor_order.id}, updating...")
            if 'issue_date' in update_data:
                print(f"  - rent_date: {decor_order.rent_date} → {update_data['issue_date']}")
                decor_order.rent_date = update_data['issue_date']
            if 'return_date' in update_data:
                print(f"  - rent_return_date: {decor_order.rent_return_date} → {update_data['return_date']}")
                decor_order.rent_return_date = update_data['return_date']
            if 'manager_comment' in update_data:
                print(f"  - manager_notes updated")
                decor_order.manager_notes = update_data['manager_comment']
            decor_order.updated_at = datetime.now()
        else:
            print(f"[UPDATE] ⚠️ WARNING: DecorOrder not found for order_id={order_id}! Changes to dates will NOT be saved in decor_orders table.")
        
        db.commit()
        print(f"[UPDATE] ✅ Changes committed to database")
        
        # Повернути оновлене замовлення
        return await get_order(order_id, db)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка оновлення замовлення: {str(e)}"
        )

@router.put("/{order_id}/status")
async def update_order_status(
    order_id: str,
    status_data: dict,
    db: Session = Depends(get_oc_db)
):
    """
    Update order status
    
    Body:
    {
        "status_id": int - OpenCart status ID (2=processing, 3=ready, 24=on_rent, etc.)
    }
    """
    try:
        order = db.query(OpenCartOrder).filter(
            OpenCartOrder.order_id == int(order_id)
        ).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        if 'status_id' in status_data:
            order.order_status_id = int(status_data['status_id'])
            order.date_modified = datetime.now()
            
            # Update lifecycle status if needed
            lifecycle = db.query(DecorOrderLifecycle).filter(
                DecorOrderLifecycle.order_id == int(order_id)
            ).first()
            
            if lifecycle:
                # Status 24 = on_rent (issued)
                if status_data['status_id'] == 24:
                    lifecycle.issued_at = datetime.now()
                    lifecycle.lifecycle_status = 'issued'
                # Status 25 = returned
                elif status_data['status_id'] == 25:
                    lifecycle.returned_at = datetime.now()
                    lifecycle.lifecycle_status = 'returned'
            
            db.commit()
            
            return {
                "success": True,
                "order_id": order_id,
                "new_status_id": order.order_status_id
            }
        else:
            raise HTTPException(status_code=400, detail="status_id required")
            
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка оновлення статусу: {str(e)}"
        )

@router.post("")
async def create_order(
    order_data: dict,
    db: Session = Depends(get_oc_db)
):
    """
    Create new order in OpenCart
    
    Body:
    {
        "client_name": str,
        "client_phone": str,
        "client_email": str (optional),
        "issue_date": str (YYYY-MM-DD),
        "return_date": str (YYYY-MM-DD),
        "manager_comment": str (optional),
        "discount_percent": float (optional),
        "items": [
            {
                "inventory_id": str,
                "name": str,
                "article": str,
                "quantity": int,
                "price_per_day": float,
                "deposit": float,
                "total_rental": float,
                "total_deposit": float
            }
        ]
    }
    """
    try:
        # 1. Створюємо або знаходимо клієнта
        customer_name = order_data.get('client_name')
        customer_phone = order_data.get('client_phone')
        customer_email = order_data.get('client_email', '')
        
        # Шукаємо існуючого клієнта по телефону
        existing_customer = db.query(OpenCartCustomer).filter(
            OpenCartCustomer.telephone == customer_phone
        ).first()
        
        if existing_customer:
            customer_id = existing_customer.customer_id
        else:
            # Створюємо нового клієнта
            new_customer = OpenCartCustomer(
                firstname=customer_name.split()[0] if customer_name else "Unknown",
                lastname=" ".join(customer_name.split()[1:]) if len(customer_name.split()) > 1 else "",
                email=customer_email or f"{customer_phone}@temp.com",
                telephone=customer_phone,
                date_added=datetime.now()
            )
            db.add(new_customer)
            db.flush()  # Отримати customer_id
            customer_id = new_customer.customer_id
        
        # 2. Створюємо замовлення в OpenCart
        total_rental = sum(item['total_rental'] for item in order_data.get('items', []))
        total_deposit = sum(item['total_deposit'] for item in order_data.get('items', []))
        
        new_order = OpenCartOrder(
            customer_id=customer_id,
            firstname=customer_name.split()[0] if customer_name else "Unknown",
            lastname=" ".join(customer_name.split()[1:]) if len(customer_name.split()) > 1 else "",
            email=customer_email or f"{customer_phone}@temp.com",
            telephone=customer_phone,
            order_status_id=19,  # pending (В обробці)
            date_added=datetime.now(),
            date_modified=datetime.now(),
            total=total_rental + total_deposit,
            comment=order_data.get('manager_comment', '')
        )
        db.add(new_order)
        db.flush()  # Отримати order_id
        
        order_id = new_order.order_id
        
        # 3. Створюємо запис в oc_order_simple_fields для дат
        simple_fields = OpenCartOrderSimpleFields(
            order_id=order_id,
            rent_issue_date=order_data.get('issue_date'),
            rent_return_date=order_data.get('return_date')
        )
        db.add(simple_fields)
        
        # 4. Створюємо lifecycle запис
        lifecycle = DecorOrderLifecycle(
            order_id=order_id,
            issue_date=datetime.strptime(order_data.get('issue_date'), '%Y-%m-%d').date(),
            return_date=datetime.strptime(order_data.get('return_date'), '%Y-%m-%d').date(),
            lifecycle_status='draft',
            manager_comment=order_data.get('manager_comment', '')
        )
        db.add(lifecycle)
        
        # 5. Commit всіх змін
        db.commit()
        
        # 6. Повертаємо створене замовлення
        return {
            "success": True,
            "order_id": order_id,
            "order_number": str(order_id),
            "customer_id": customer_id,
            "total_rental": total_rental,
            "total_deposit": total_deposit,
            "message": "Замовлення успішно створено"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка створення замовлення: {str(e)}"
        )


@router.get("/customer/{customer_id}/stats")
async def get_customer_stats(
    customer_id: int,
    db: Session = Depends(get_oc_db)
):
    """
    Отримати статистику клієнта
    
    Статуси:
    - Новачок: < 5 замовлень
    - Постійний: 5-19 замовлень  
    - Срібний: 20-49 замовлень
    - Золотий: 50-99 замовлень
    - Платина: 100+ замовлень
    """
    try:
        # Підрахувати кількість замовлень клієнта
        order_count = db.query(func.count(OpenCartOrder.order_id)).filter(
            OpenCartOrder.customer_id == customer_id
        ).scalar()
        
        # Визначити статус
        if order_count < 5:
            status = "Новачок"
            tier = "novice"
        elif order_count < 20:
            status = "Постійний клієнт"
            tier = "regular"
        elif order_count < 50:
            status = "Срібний клієнт"
            tier = "silver"
        elif order_count < 100:
            status = "Золотий клієнт"
            tier = "gold"
        else:
            status = "Платиновий клієнт"
            tier = "platinum"
        
        return {
            "customer_id": customer_id,
            "order_count": order_count,
            "status": status,
            "tier": tier
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка отримання статистики: {str(e)}"
        )

@router.get("/inventory/search")
async def search_inventory(
    q: str = "",
    limit: int = 100,  # Збільшено до 100
    db: Session = Depends(get_oc_db)
):
    """
    Пошук товарів по SKU (model) або назві
    """
    try:
        # Пошук по model (SKU) або назві - ТІЛЬКИ українська мова
        query = db.query(
            OpenCartProduct.product_id,
            OpenCartProduct.model,
            OpenCartProduct.sku,
            OpenCartProduct.ean,
            OpenCartProduct.price,
            OpenCartProduct.quantity,
            OpenCartProduct.image,
            OpenCartProductDescription.name
        ).join(
            OpenCartProductDescription,
            OpenCartProduct.product_id == OpenCartProductDescription.product_id
        ).filter(
            OpenCartProduct.status == 1,  # Тільки активні товари
            OpenCartProductDescription.language_id == 4  # Українська мова
        )
        
        if q:
            search_term = f"%{q}%"
            query = query.filter(
                or_(
                    OpenCartProduct.model.like(search_term),
                    OpenCartProductDescription.name.like(search_term)
                )
            )
        
        products = query.all()
        
        # Видалити дублікати вручну - один product_id = один результат
        seen_ids = set()
        result = []
        
        for p in products:
            if p.product_id in seen_ids:
                continue  # Пропустити дублікат
            
            seen_ids.add(p.product_id)
            
            damage_cost = float(p.ean) if p.ean else float(p.price) * 10
            deposit = (1 * damage_cost) / 2  # Для 1 шт
            
            # Формат фото в OpenCart: catalog/path/image.jpg
            # URL: https://farforrent.com.ua/image/catalog/path/image.jpg
            image_path = p.image if p.image else None
            
            result.append({
                "product_id": p.product_id,
                "sku": p.model,
                "name": p.name,
                "price_per_day": float(p.price),
                "damage_cost": damage_cost,
                "deposit": deposit,
                "total_quantity": p.quantity,
                "image": image_path
            })
            
            if len(result) >= limit:
                break
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка пошуку: {str(e)}"
        )

@router.post("/check-availability")
async def check_availability(
    check_data: dict,
    db: Session = Depends(get_oc_db)
):
    """
    Перевірка доступності товарів на певні дати
    ОНОВЛЕНО: тепер використовує decor_orders замість OpenCart
    
    Body:
    {
        "issue_date": "2025-12-01",
        "return_date": "2025-12-05",
        "items": [
            {"product_id": 123, "sku": "VZK0006", "quantity": 5},
            ...
        ]
    }
    
    Повертає конфлікти для кожної позиції
    """
    try:
        issue_date = check_data.get('issue_date')
        return_date = check_data.get('return_date')
        items = check_data.get('items', [])
        
        # Validate required fields
        if not issue_date or not return_date:
            raise HTTPException(
                status_code=400,
                detail="issue_date та return_date є обов'язковими"
            )
        
        conflicts = []
        
        for item in items:
            product_id = item.get('product_id')
            sku = item.get('sku')
            requested_qty = item.get('quantity', 1)
            
            print(f"[CHECK AVAILABILITY] Checking product_id={product_id}, sku={sku}")
            
            # Отримати товар з бази
            product = db.query(OpenCartProduct).filter(
                OpenCartProduct.product_id == product_id
            ).first()
            
            if not product:
                print(f"[CHECK AVAILABILITY] ❌ Product {product_id} not found in OpenCart!")
                conflicts.append({
                    "product_id": product_id,
                    "sku": sku,
                    "level": "error",
                    "type": "not_found",
                    "message": f"Товар не знайдено в базі OpenCart (ID: {product_id}, SKU: {sku}). Можливо товар був видалений.",
                    "total_quantity": 0,
                    "in_rent": 0,
                    "available": 0,
                    "requested": requested_qty
                })
                continue
            
            print(f"[CHECK AVAILABILITY] ✅ Found: {product.model} - qty={product.quantity}")
            
            total_qty = int(product.quantity) if product.quantity else 0
            
            # ОНОВЛЕНО: використовуємо decor_orders замість OpenCart
            # 1. Зарезервовано в decor_orders (статуси processing, ready)
            # ТІЛЬКИ якщо дати перетинаються!
            reserved_in_decor = db.query(func.sum(DecorOrderItem.quantity)).join(
                DecorOrder,
                DecorOrderItem.order_id == DecorOrder.id
            ).filter(
                DecorOrderItem.product_id == product_id,
                DecorOrder.status.in_(['processing', 'ready']),
                # Перевіряємо перетин дат
                DecorOrder.rent_date <= return_date,
                DecorOrder.rent_return_date >= issue_date
            ).scalar() or 0
            
            # 2. В оренді в decor_orders (статуси issued, on_rent)
            # ТІЛЬКИ якщо дати перетинаються!
            in_rent_decor = db.query(func.sum(DecorOrderItem.quantity)).join(
                DecorOrder,
                DecorOrderItem.order_id == DecorOrder.id
            ).filter(
                DecorOrderItem.product_id == product_id,
                DecorOrder.status.in_(['issued', 'on_rent']),
                # Перевіряємо перетин дат
                DecorOrder.rent_date <= return_date,
                DecorOrder.rent_return_date >= issue_date
            ).scalar() or 0
            
            # 3. Пошкоджені товари (в реставрації)
            # TODO: додати перевірку decor_damage_items якщо є поле product_id
            damaged_qty = 0
            
            # Загальна зайнятість = Зарезервовано + В оренді + Пошкоджені
            qty_in_rent = int(reserved_in_decor) + int(in_rent_decor) + damaged_qty
            
            # Доступна кількість
            available_qty = total_qty - qty_in_rent
            
            # Визначити рівень конфлікту
            if available_qty < requested_qty:
                shortage = requested_qty - available_qty
                conflicts.append({
                    "product_id": product_id,
                    "sku": sku,
                    "level": "error",
                    "type": "insufficient",
                    "message": f"Недостатньо товару. Запитано: {requested_qty}, доступно: {available_qty}, не вистачає: {shortage}",
                    "total_quantity": total_qty,
                    "in_rent": qty_in_rent,
                    "reserved": int(reserved_in_decor),
                    "in_rent_detail": int(in_rent_decor),
                    "damaged": damaged_qty,
                    "available": max(0, available_qty),
                    "requested": requested_qty
                })
            elif available_qty < requested_qty + 2:
                # Попередження якщо залишок малий
                conflicts.append({
                    "product_id": product_id,
                    "sku": sku,
                    "level": "warning",
                    "type": "low_stock",
                    "message": f"Малий запас. Доступно: {available_qty}, запитано: {requested_qty}",
                    "total_quantity": total_qty,
                    "in_rent": qty_in_rent,
                    "reserved": int(reserved_in_decor),
                    "in_rent_detail": int(in_rent_decor),
                    "damaged": damaged_qty,
                    "available": available_qty,
                    "requested": requested_qty
                })
        
        return {
            "has_conflicts": len(conflicts) > 0,
            "conflicts": conflicts,
            "total_conflicts": len(conflicts)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка перевірки доступності: {str(e)}"
        )

@router.post("/{order_id}/accept")
async def accept_order(
    order_id: str,
    db: Session = Depends(get_oc_db)
):
    """
    Прийняти замовлення - імпортувати з OpenCart в нашу систему
    
    1. Створює запис в decor_orders
    2. Копіює items в decor_order_items
    3. Створює Issue Card і Return Card
    4. Змінює статус в OpenCart (2 → 19)
    """
    try:
        from models_sqlalchemy import DecorOrder, DecorOrderItem
        
        # 1. Перевірити чи вже імпортовано (по id або opencart_order_id)
        existing = db.query(DecorOrder).filter(
            or_(
                DecorOrder.id == int(order_id),
                DecorOrder.opencart_order_id == int(order_id)
            )
        ).first()
        
        # Флаг чи треба створювати нове замовлення
        create_new_order = not existing
        
        if existing:
            # Перевірити чи є items
            existing_items_count = db.query(DecorOrderItem).filter(
                DecorOrderItem.order_id == existing.id
            ).count()
            
            if existing_items_count > 0:
                return {
                    "success": True,
                    "message": "Замовлення вже імпортовано",
                    "decor_order_id": existing.id
                }
            else:
                # Items відсутні - додамо їх зараз
                print(f"[Accept] Order {order_id} exists but has no items, adding them now...")
                decor_order = existing
                # Пропускаємо перевірку конфліктів бо замовлення вже створене
        
        # 2. Отримати замовлення з OpenCart
        oc_order = db.query(OpenCartOrder).filter(
            OpenCartOrder.order_id == int(order_id)
        ).first()
        
        if not oc_order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        # 3. Отримати товари WITH photos
        oc_products = db.query(
            OpenCartOrderProduct,
            OpenCartProduct.ean,
            OpenCartProduct.image
        ).join(
            OpenCartProduct,
            OpenCartOrderProduct.product_id == OpenCartProduct.product_id
        ).filter(
            OpenCartOrderProduct.order_id == oc_order.order_id
        ).all()
        
        # 4. Отримати дати
        simple_fields = db.query(OpenCartOrderSimpleFields).filter(
            OpenCartOrderSimpleFields.order_id == int(order_id)
        ).first()
        
        rent_date = simple_fields.rent_issue_date if simple_fields else None
        return_date = simple_fields.rent_return_date if simple_fields else None
        
        if not rent_date or not return_date:
            raise HTTPException(
                status_code=400,
                detail="Не вказані дати видачі або повернення"
            )
        
        # 4.5. ПЕРЕВІРКА КОНФЛІКТІВ з decor_orders та damages (тільки для нових замовлень)
        if create_new_order:
            conflicts = []
            for oc_prod, ean_value, image_value in oc_products:
                product_id = oc_prod.product_id
                requested_qty = oc_prod.quantity
                
                # Загальна кількість з oc_product
                product = db.query(OpenCartProduct).filter(
                    OpenCartProduct.product_id == product_id
                ).first()
                total_qty = int(product.quantity) if product and product.quantity else 0
                
                # Зарезервовано в decor_orders (статуси processing, ready)
                # ТІЛЬКИ якщо дати перетинаються!
                reserved_in_decor = db.query(func.sum(DecorOrderItem.quantity)).join(
                    DecorOrder,
                    DecorOrderItem.order_id == DecorOrder.id
                ).filter(
                    DecorOrderItem.product_id == product_id,
                    DecorOrder.status.in_(['processing', 'ready']),
                    # Перевіряємо перетин дат
                    DecorOrder.rent_date <= return_date,
                    DecorOrder.rent_return_date >= rent_date
                ).scalar() or 0
                
                # В оренді в decor_orders (статуси issued, on_rent)
                # ТІЛЬКИ якщо дати перетинаються!
                in_rent_decor = db.query(func.sum(DecorOrderItem.quantity)).join(
                    DecorOrder,
                    DecorOrderItem.order_id == DecorOrder.id
                ).filter(
                    DecorOrderItem.product_id == product_id,
                    DecorOrder.status.in_(['issued', 'on_rent']),
                    # Перевіряємо перетин дат
                    DecorOrder.rent_date <= return_date,
                    DecorOrder.rent_return_date >= rent_date
                ).scalar() or 0
                
                # Пошкоджені товари (в реставрації)
                # TODO: додати перевірку decor_damage_items якщо є поле product_id
                damaged_qty = 0  # Поки що 0, треба з'ясувати структуру
                
                # Доступно = Загальна кількість - Зарезервовано - В оренді - Пошкоджені
                available = total_qty - int(reserved_in_decor) - int(in_rent_decor) - damaged_qty
                
                if available < requested_qty:
                    conflicts.append({
                        "sku": oc_prod.model,
                        "name": oc_prod.name,
                        "requested": requested_qty,
                        "available": max(0, available),
                        "total": total_qty,
                        "reserved": int(reserved_in_decor),
                        "in_rent": int(in_rent_decor),
                        "damaged": damaged_qty
                    })
            
            # Якщо є конфлікти - повернути помилку з деталями
            if conflicts:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "Конфлікти наявності товарів",
                        "conflicts": conflicts
                    }
                )
        
        # 5. Створити decor_orders (тільки якщо це нове замовлення)
        if create_new_order:
            decor_order = DecorOrder(
                id=oc_order.order_id,  # 🎯 Використовуємо той самий ID як в OpenCart!
                opencart_order_id=oc_order.order_id,
                order_number=f"#{oc_order.order_id}",
                client_name=f"{oc_order.firstname} {oc_order.lastname}",
                client_phone=oc_order.telephone or "",
                client_email=oc_order.email or "",
                status='awaiting_customer',  # 🎯 Спочатку чекаємо підтвердження!
                rent_date=rent_date,
                rent_return_date=return_date,
                total_rental=float(oc_order.total or 0),
                total_deposit=0  # TODO: якщо є окреме поле для депозиту
            )
            db.add(decor_order)
            db.flush()  # Отримати ID
        
        # 6. Копіювати items з розрахунком депозиту
        for oc_prod, ean_value, image_value in oc_products:
            # Розрахунок депозиту: damage_cost (ean) * quantity / 2
            damage_cost = float(ean_value or 0) if ean_value else 0
            item_deposit = (damage_cost * oc_prod.quantity) / 2
            
            print(f"[ACCEPT] Item: {oc_prod.name}")
            print(f"  - quantity: {oc_prod.quantity}")
            print(f"  - damage_cost: {damage_cost}")
            print(f"  - deposit: {item_deposit}")
            
            item = DecorOrderItem(
                order_id=decor_order.id,
                product_id=oc_prod.product_id,
                sku=oc_prod.model,
                name=oc_prod.name,
                quantity=oc_prod.quantity,
                price_per_day=float(oc_prod.price or 0),
                damage_cost=damage_cost,
                total_rental=float(oc_prod.total or 0),
                deposit=item_deposit,
                image=image_value
            )
            db.add(item)
        
        # 6.1. Порахувати total_deposit для замовлення
        if create_new_order:
            db.flush()  # Зберегти items щоб можна було їх прочитати
            total_deposit = db.query(func.sum(DecorOrderItem.deposit)).filter(
                DecorOrderItem.order_id == decor_order.id
            ).scalar() or 0
            
            decor_order.total_deposit = float(total_deposit)
            print(f"[ACCEPT] ✅ Total deposit calculated: {total_deposit}")
        
        # 7. Створити Issue Card
        items_data = []
        for oc_prod, ean_value, image_value in oc_products:
            items_data.append({
                "sku": oc_prod.model,
                "name": oc_prod.name,
                "quantity": oc_prod.quantity,
                "inventory_id": oc_prod.product_id,
                "image": image_value
            })
        
        # 7-8. Створити Issue Card і Return Card (тільки якщо це нове замовлення)
        if create_new_order:
            issue_card = DecorIssueCard(
                id=f"issue_{decor_order.id}",
                order_id=decor_order.id,  # Наш внутрішній ID
                order_number=f"#{oc_order.order_id}",
                status='preparation',  # preparation, ready, issued, archived
                items=items_data
            )
            db.add(issue_card)
            
            # 8. Створити Return Card
            return_card = DecorReturnCard(
                id=f"return_{decor_order.id}",
                order_id=decor_order.id,  # Наш внутрішній ID
                order_number=f"#{oc_order.order_id}",
                issue_card_id=issue_card.id,
                status='pending',  # pending, active, checking, resolved, closed
                items_expected=items_data,
                total_items_expected=sum(item['quantity'] for item in items_data)
            )
            db.add(return_card)
        
        # 9. Змінити статус в OpenCart (2 → 19) тільки для нових замовлень
        if create_new_order:
            oc_order.order_status_id = 19  # В обробці
        
        # 10. СТВОРИТИ ФІНАНСОВІ ТРАНЗАКЦІЇ (тільки для нових замовлень)
        if create_new_order:
            from models_sqlalchemy import FinanceTransaction
            from datetime import datetime
            
            # Отримати суми оренди і застави
            rental_amount = float(oc_order.total or 0)
            
            # Застава - з simple_fields
            deposit_amount = 0
            if simple_fields:
                deposit_amount = float(getattr(simple_fields, 'deposit_held', 0) or 
                                      getattr(simple_fields, 'total_deposit', 0) or 0)
            
            # 10.1 Нарахування оренди (Rent Accrual) - ДЕБЕТ, unpaid
            rent_transaction = FinanceTransaction(
                id=str(uuid.uuid4()),
                order_id=oc_order.order_id,  # Використовуємо order_id (існуюче поле)
                order_number=f"#{oc_order.order_id}",
                type='rent_accrual',
                title=f'Оренда для замовлення #{oc_order.order_id}',
                description=f'decor_order_id:{decor_order.id}',  # Зберігаємо decor_order_id в description
                debit=rental_amount,
                credit=0,
                currency='UAH',
                status='unpaid',
                counterparty=f"{oc_order.firstname} {oc_order.lastname}",
                payment_method='pending',
                tag='rental'
            )
            db.add(rent_transaction)
            
            # 10.2 Застава в холді (Deposit Hold) - КРЕДИТ, held
            if deposit_amount > 0:
                deposit_transaction = FinanceTransaction(
                    id=str(uuid.uuid4()),
                    order_id=oc_order.order_id,  # Використовуємо order_id (існуюче поле)
                    order_number=f"#{oc_order.order_id}",
                    type='deposit_hold',
                    title=f'Застава для замовлення #{oc_order.order_id}',
                    description=f'decor_order_id:{decor_order.id}',  # Зберігаємо decor_order_id в description
                    debit=0,
                    credit=deposit_amount,
                    currency='UAH',
                    status='held',
                    counterparty=f"{oc_order.firstname} {oc_order.lastname}",
                    payment_method='pending',
                    tag='deposit'
                )
                db.add(deposit_transaction)
        
        db.commit()
        
        return {
            "success": True,
            "message": "Замовлення прийнято" if create_new_order else "Items додано до існуючого замовлення",
            "decor_order_id": decor_order.id,
            "opencart_order_id": oc_order.order_id,
            "issue_card_id": issue_card.id if create_new_order else f"issue_{decor_order.id}",
            "return_card_id": return_card.id if create_new_order else f"return_{decor_order.id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка прийняття замовлення: {str(e)}"
        )

@router.delete("/{order_id}")
async def delete_order(
    order_id: str,
    db: Session = Depends(get_oc_db)
):
    """
    Видалити замовлення (soft delete - змінити статус на cancelled)
    
    IMPORTANT: Це soft delete - не видаляє дані з БД, а просто змінює статус
    """
    try:
        order = db.query(OpenCartOrder).filter(
            OpenCartOrder.order_id == int(order_id)
        ).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        # Soft delete - змінити статус на cancelled (7)
        order.order_status_id = 7  # Cancelled in OpenCart
        order.date_modified = datetime.now()
        
        # Також видалити пов'язані записи (опціонально)
        # - DecorIssueCard
        db.query(DecorIssueCard).filter(
            DecorIssueCard.order_id == int(order_id)
        ).delete()
        
        # - DecorReturnCard
        db.query(DecorReturnCard).filter(
            DecorReturnCard.order_id == int(order_id)
        ).delete()
        
        # - FinanceTransaction - НЕ видаляємо для звітності, але можна позначити
        
        db.commit()
        
        return {
            "success": True,
            "order_id": order_id,
            "message": "Замовлення скасовано"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка видалення замовлення: {str(e)}"
        )




# ============================================================
# DECOR ORDERS ENDPOINTS (OUR SYSTEM)
# ============================================================

@decor_router.get("")
async def get_decor_orders(
    status: Optional[str] = None,
    limit: int = 1000,
    db: Session = Depends(get_oc_db)
):
    """
    Отримати замовлення з нашої системи (decor_orders)
    """
    try:
        query = db.query(DecorOrder)
        
        if status:
            query = query.filter(DecorOrder.status == status)
        
        orders = query.order_by(DecorOrder.created_at.desc()).limit(limit).all()
        
        result = []
        for order in orders:
            # Отримати items
            items_count = db.query(func.count(DecorOrderItem.id)).filter(
                DecorOrderItem.order_id == order.id
            ).scalar()
            
            result.append({
                "id": order.id,
                "opencart_order_id": order.opencart_order_id,
                "order_number": order.order_number,
                "client_name": order.client_name,
                "client_phone": order.client_phone,
                "client_email": order.client_email,
                "status": order.status,
                "rent_date": str(order.rent_date) if order.rent_date else None,
                "rent_return_date": str(order.rent_return_date) if order.rent_return_date else None,
                "total_rental": float(order.total_rental or 0),
                "total_deposit": float(order.total_deposit or 0),
                "items_count": items_count,
                "created_at": str(order.created_at),
                "updated_at": str(order.updated_at)
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка завантаження замовлень: {str(e)}"
        )


@decor_router.get("/{order_id}")
async def get_decor_order(
    order_id: int,
    db: Session = Depends(get_oc_db)
):
    """
    Отримати деталі замовлення з нашої системи
    """
    try:
        order = db.query(DecorOrder).filter(DecorOrder.id == order_id).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        # Отримати items
        items = db.query(DecorOrderItem).filter(
            DecorOrderItem.order_id == order_id
        ).all()
        
        items_data = []
        for item in items:
            # Якщо damage_cost = 0, завантажити з OpenCart
            damage_cost = float(item.damage_cost or 0)
            if damage_cost == 0 and item.product_id:
                oc_product = db.query(OpenCartProduct).filter(
                    OpenCartProduct.product_id == item.product_id
                ).first()
                if oc_product and oc_product.ean:
                    damage_cost = float(oc_product.ean)
            
            # Перерахувати deposit якщо damage_cost змінився
            deposit = float(item.deposit or 0)
            if damage_cost > 0 and deposit == 0:
                deposit = (damage_cost * item.quantity) / 2
            
            items_data.append({
                "id": item.id,
                "product_id": item.product_id,
                "inventory_id": str(item.product_id),  # для сумісності з frontend
                "sku": item.sku,
                "article": item.sku,  # для сумісності з frontend
                "name": item.name,
                "quantity": item.quantity,
                "price_per_day": float(item.price_per_day or 0),
                "damage_cost": damage_cost,
                "total_rental": float(item.total_rental or 0),
                "deposit": deposit,
                "image": item.image
            })
        
        return {
            "id": order.id,
            "opencart_order_id": order.opencart_order_id,
            "order_number": order.order_number,
            "client_name": order.client_name,
            "client_phone": order.client_phone,
            "client_email": order.client_email,
            "status": order.status,
            "rent_date": str(order.rent_date) if order.rent_date else None,
            "rent_return_date": str(order.rent_return_date) if order.rent_return_date else None,
            "rental_days": int(order.rental_days or 1),
            "total_rental": float(order.total_rental or 0),
            "total_deposit": float(order.total_deposit or 0),
            "discount": float(order.discount or 0),
            "manager_notes": order.manager_notes,
            "client_confirmed": order.client_confirmed or False,
            "items": items_data,
            "created_at": str(order.created_at),
            "updated_at": str(order.updated_at)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка завантаження замовлення: {str(e)}"
        )

@decor_router.put("/{order_id}/status")
async def update_decor_order_status(
    order_id: int,
    status_data: dict,
    db: Session = Depends(get_oc_db)
):
    """
    Оновити статус decor_order
    
    Body: {"status": "processing" | "ready" | "issued" | "on_rent" | "returned" | "settled"}
    """
    try:
        order = db.query(DecorOrder).filter(DecorOrder.id == order_id).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        new_status = status_data.get('status')
        if not new_status:
            raise HTTPException(status_code=400, detail="Статус не вказано")
        
        # Перевірка валідності статусу
        valid_statuses = ['processing', 'ready', 'issued', 'on_rent', 'returned', 'settled', 'cancelled']
        if new_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Невірний статус. Допустимі: {', '.join(valid_statuses)}")
        
        order.status = new_status
        order.updated_at = datetime.now()
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Статус оновлено на '{new_status}'",
            "order_id": order.id,
            "status": order.status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка оновлення статусу: {str(e)}"
        )


@decor_router.put("/{order_id}")
async def update_decor_order(
    order_id: int,
    update_data: dict,
    db: Session = Depends(get_oc_db)
):
    """
    Оновити дані замовлення в DecorOrder
    
    Body: {
        "issue_date": str (optional) - YYYY-MM-DD,
        "return_date": str (optional) - YYYY-MM-DD,
        "manager_comment": str (optional),
        "client_name": str (optional),
        "client_phone": str (optional),
        "client_email": str (optional)
    }
    """
    try:
        print(f"[UPDATE DECOR ORDER] Оновлення замовлення #{order_id}")
        print(f"  Дані: {update_data}")
        
        order = db.query(DecorOrder).filter(DecorOrder.id == order_id).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        # Оновити дати
        if 'issue_date' in update_data:
            old_date = order.rent_date
            order.rent_date = update_data['issue_date']
            print(f"  - rent_date: {old_date} → {order.rent_date}")
        
        if 'return_date' in update_data:
            old_date = order.rent_return_date
            order.rent_return_date = update_data['return_date']
            print(f"  - rent_return_date: {old_date} → {order.rent_return_date}")
        
        # Оновити коментар
        if 'manager_comment' in update_data:
            order.manager_notes = update_data['manager_comment']
            print(f"  - manager_notes updated")
        
        # Оновити кількість днів
        if 'rental_days' in update_data:
            order.rental_days = int(update_data['rental_days'])
            print(f"  - rental_days: {order.rental_days}")
        
        # Оновити знижку
        if 'discount' in update_data:
            order.discount = float(update_data['discount'])
            print(f"  - discount: {order.discount}")
        
        # Оновити дані клієнта (якщо потрібно)
        if 'client_name' in update_data:
            order.client_name = update_data['client_name']
        if 'client_phone' in update_data:
            order.client_phone = update_data['client_phone']
        if 'client_email' in update_data:
            order.client_email = update_data['client_email']
        
        order.updated_at = datetime.now()
        
        db.commit()
        
        print(f"[UPDATE DECOR ORDER] ✅ Замовлення оновлено")
        
        # Повернути оновлене замовлення
        return await get_decor_order(order_id, db)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[UPDATE DECOR ORDER] ❌ Помилка: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Помилка оновлення замовлення: {str(e)}"
        )



@router.post("/{order_id}/decline")
async def decline_order(
    order_id: int,
    decline_data: dict,
    db: Session = Depends(get_oc_db)
):
    """
    Відхилити замовлення
    
    Body: {
        "reason": "Причина відхилення",
        "declined_by": "Менеджер Оля"
    }
    """
    try:
        # Знайти OpenCart замовлення
        oc_order = db.query(OpenCartOrder).filter(
            OpenCartOrder.order_id == order_id
        ).first()
        
        if not oc_order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        # Оновити статус на Cancelled (7)
        oc_order.order_status_id = 7
        oc_order.date_modified = datetime.now()
        
        # Додати коментар
        reason = decline_data.get('reason', 'Не вказано')
        declined_by = decline_data.get('declined_by', 'Система')
        
        # Якщо є decor_order - також оновити його
        decor_order = db.query(DecorOrder).filter(
            DecorOrder.opencart_order_id == order_id
        ).first()
        
        if decor_order:
            decor_order.status = 'cancelled'
            decor_order.manager_notes = (
                f"❌ Відхилено {datetime.now().strftime('%d.%m.%Y %H:%M')}\n"
                f"Менеджер: {declined_by}\n"
                f"Причина: {reason}\n\n"
                + (decor_order.manager_notes or "")
            )
            decor_order.updated_at = datetime.now()
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Замовлення #{order_id} відхилено",
            "order_id": order_id,
            "reason": reason,
            "declined_by": declined_by
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка відхилення замовлення: {str(e)}"
        )

        db.rollback()


@decor_router.post("/test-email")
async def test_email_sending(test_data: dict):
    """
    Тестовий endpoint для перевірки SMTP
    
    Body: {
        "to_email": "test@example.com",
        "to_name": "Test User"
    }
    """
    try:
        from utils.email_sender import get_email_sender
        from datetime import datetime
        
        email_sender = get_email_sender()
        
        # Тестові дані
        test_order_data = {
            "order_number": 9999,
            "client_name": test_data.get('to_name', 'Тестовий Користувач'),
            "rent_date": "15.11.2025",
            "return_date": "17.11.2025",
            "rental_days": 2,
            "items": [
                {
                    "name": "Ваза кришталева (тест)",
                    "quantity": 2,
                    "total": "1 200"
                },
                {
                    "name": "Стілець велюровий (тест)",
                    "quantity": 4,
                    "total": "4 000"
                }
            ],
            "total_rental": "5 200",
            "total_deposit": "2 600",
            "prepayment": "2 600",
            "changes": ["Це тестовий email для перевірки SMTP"],
            "confirmation_link": "https://farforrent.com.ua/confirm/9999"
        }
        
        success = email_sender.send_order_confirmation(
            to_email=test_data.get('to_email'),
            to_name=test_data.get('to_name', 'Тестовий Користувач'),
            order_data=test_order_data
        )
        
        if success:
            return {
                "success": True,
                "message": f"✅ Тестовий email відправлено на {test_data.get('to_email')}",
                "smtp_config": {
                    "host": os.getenv('SMTP_HOST'),
                    "port": os.getenv('SMTP_PORT'),
                    "username": os.getenv('SMTP_USERNAME'),
                    "use_ssl": os.getenv('SMTP_USE_SSL')
                }
            }
        else:
            return {
                "success": False,
                "message": "❌ Не вдалося відправити email. Перевірте логи backend.",
                "smtp_config": {
                    "host": os.getenv('SMTP_HOST'),
                    "port": os.getenv('SMTP_PORT'),
                    "username": os.getenv('SMTP_USERNAME'),
                    "use_ssl": os.getenv('SMTP_USE_SSL')
                }
            }
            
    except Exception as e:
        return {
            "success": False,
            "message": f"❌ Помилка: {str(e)}",
            "error_details": str(e)
        }



@decor_router.post("/{order_id}/confirm-by-client")
async def confirm_order_by_client(
    order_id: int,
    db: Session = Depends(get_oc_db)
):
    """
    Підтвердження замовлення клієнтом через посилання в email.
    Змінює статус з 'awaiting_customer' на 'processing' (готово до комплектації).
    """
    try:
        print(f"[CONFIRM] Клієнт підтверджує замовлення #{order_id}")
        
        order = db.query(DecorOrder).filter(DecorOrder.id == order_id).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        # Перевірити чи вже підтверджено
        if order.client_confirmed:
            return {
                "success": True,
                "message": "Замовлення вже підтверджено раніше. Дякуємо!",
                "status": order.status,
                "client_confirmed": True
            }
        
        # Встановити флаг client_confirmed (статус залишається awaiting_customer)
        order.client_confirmed = True
        order.updated_at = datetime.now()
        
        db.commit()
        
        print(f"[CONFIRM] ✅ Замовлення #{order_id} підтверджено клієнтом (статус залишається '{order.status}')")
        
        return {
            "success": True,
            "message": "Дякуємо! Замовлення підтверджено. Менеджер почне комплектацію найближчим часом.",
            "order_number": order.order_number,
            "status": order.status,
            "client_confirmed": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[CONFIRM] ❌ Помилка: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Помилка підтвердження: {str(e)}"
        )




@decor_router.post("/telegram/callback")
async def handle_telegram_callback(callback_data: dict, db: Session = Depends(get_oc_db)):
    """
    Обробка callback від Telegram бота (коли клієнт натискає кнопку "Підтвердити")
    
    Бот має відправляти POST запит:
    {
        "callback_data": "confirm_order_6912",
        "chat_id": "123456789",
        "message_id": "789"
    }
    """
    try:
        callback = callback_data.get('callback_data', '')
        chat_id = callback_data.get('chat_id')
        message_id = callback_data.get('message_id')
        
        if not callback.startswith('confirm_order_'):
            return {"success": False, "error": "Невідомий callback"}
        
        order_id = int(callback.replace('confirm_order_', ''))
        
        print(f"[TELEGRAM CALLBACK] Підтвердження замовлення #{order_id} від chat_id={chat_id}")
        
        # Підтвердити замовлення
        order = db.query(DecorOrder).filter(DecorOrder.id == order_id).first()
        
        if not order:
            return {"success": False, "error": "Замовлення не знайдено"}
        
        if order.client_confirmed:
            return {
                "success": True,
                "message": "✅ Замовлення вже підтверджено раніше!",
                "already_confirmed": True
            }
        
        order.client_confirmed = True
        order.updated_at = datetime.now()
        db.commit()
        
        print(f"[TELEGRAM CALLBACK] ✅ Замовлення #{order_id} підтверджено")
        
        # Відправити відповідь боту щоб оновити повідомлення
        return {
            "success": True,
            "message": f"✅ Дякуємо! Замовлення #{order.order_number} підтверджено.\n\nМенеджер почне комплектацію найближчим часом.",
            "order_number": order.order_number,
            "client_confirmed": True
        }
        
    except Exception as e:
        print(f"[TELEGRAM CALLBACK] ❌ Помилка: {str(e)}")
        return {"success": False, "error": str(e)}


@decor_router.post("/{order_id}/send-confirmation-email")
async def send_confirmation_email(
    order_id: int,
    email_data: dict,
    db: Session = Depends(get_oc_db)
):
    """
    Відправити email підтвердження клієнту
    
    Body: {
        "changes": ["Дата повернення: була 14.11 → стала 15.11", ...],
        "manager_notes": "..."
    }
    """
    print(f"[SEND EMAIL ENDPOINT] Викликано для order_id={order_id}")
    print(f"[SEND EMAIL ENDPOINT] email_data={email_data}")
    try:
        # Знайти decor_order
        order = db.query(DecorOrder).filter(DecorOrder.id == order_id).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        print(f"[EMAIL] Відправка email для замовлення #{order_id}")
        print(f"  - rent_date: {order.rent_date}")
        print(f"  - rent_return_date: {order.rent_return_date}")
        print(f"  - client_email: {order.client_email}")
        
        # Отримати items
        items = db.query(DecorOrderItem).filter(
            DecorOrderItem.order_id == order_id
        ).all()
        
        print(f"  - items count: {len(items)}")
        
        # Підготувати дані для email
        from datetime import datetime
        
        rent_date_obj = datetime.strptime(str(order.rent_date), '%Y-%m-%d') if order.rent_date else datetime.now()
        return_date_obj = datetime.strptime(str(order.rent_return_date), '%Y-%m-%d') if order.rent_return_date else datetime.now()
        rental_days = (return_date_obj - rent_date_obj).days + 1
        
        email_context = {
            "order_number": order.order_number,
            "order_id": order.id,
            "client_name": order.client_name,
            "issue_date": rent_date_obj.strftime('%d.%m.%Y'),
            "return_date": return_date_obj.strftime('%d.%m.%Y'),
            "rental_days": int(order.rental_days or rental_days),
            "items": [
                {
                    "name": item.name,
                    "sku": item.sku,
                    "quantity": item.quantity,
                    "price_per_day": f"{float(item.price_per_day or 0):,.0f}".replace(',', ' '),
                    "damage_cost": f"{float(item.damage_cost or 0):,.0f}".replace(',', ' '),
                    "deposit": f"{float(item.deposit or 0):,.0f}".replace(',', ' '),
                    "total": f"{float(item.total_rental):,.0f}".replace(',', ' '),
                    "image": item.image
                }
                for item in items
            ],
            "total_rental": f"{float(order.total_rental):,.0f}".replace(',', ' '),
            "total_deposit": f"{float(order.total_deposit or 0):,.0f}".replace(',', ' '),
            "prepayment": f"{float(order.total_rental / 2):,.0f}".replace(',', ' '),
            "changes": email_data.get('changes', []),
            "order_id": order.id,  # Для бота
            "rental_days": int(order.rental_days or 1)
        }
        
        # Перевірити чи є email клієнта
        if not order.client_email or '@' not in order.client_email:
            raise HTTPException(
                status_code=400,
                detail=f"Email клієнта не вказано або невалідний: {order.client_email}"
            )
        
        # Відправити email через SMTP
        from utils.email_sender import get_email_sender
        
        print(f"[SEND EMAIL ENDPOINT] Викликаємо email_sender для {order.client_email}")
        email_sender = get_email_sender()
        success = email_sender.send_order_confirmation(
            to_email=order.client_email,
            to_name=order.client_name,
            order_data=email_context
        )
        print(f"[SEND EMAIL ENDPOINT] email_sender повернув success={success}")
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Не вдалося відправити email. Перевірте SMTP налаштування."
            )
        
        # Зберегти інформацію про відправку email
        changes_log = "\n".join(f"  - {c}" for c in email_data.get('changes', []))
        order.manager_notes = (
            f"📧 Email відправлено {datetime.now().strftime('%d.%m.%Y %H:%M')}\n"
            f"Отримувач: {order.client_email}\n"
            f"Зміни:\n{changes_log if changes_log else '  (без змін)'}\n\n"
            + (order.manager_notes or "")
        )
        order.updated_at = datetime.now()
        
        db.commit()
        
        return {
            "success": True,
            "message": f"✅ Email підтвердження відправлено на {order.client_email}",
            "to_email": order.client_email,
            "order_number": order.opencart_order_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка відправки email: {str(e)}"
        )


@decor_router.post("/{order_id}/move-to-preparation")
async def move_to_preparation(
    order_id: int,
    db: Session = Depends(get_oc_db)
):
    """
    Відправити замовлення на збір (awaiting_customer → processing)
    Автоматично встановлює client_confirmed = True
    """
    print(f"[MOVE TO PREP] Початок для order_id={order_id}")
    try:
        order = db.query(DecorOrder).filter(DecorOrder.id == order_id).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        print(f"[MOVE TO PREP] Поточний статус: {order.status}, client_confirmed: {order.client_confirmed}")
        
        if order.status != 'awaiting_customer':
            raise HTTPException(
                status_code=400, 
                detail=f"Неможливо відправити на збір. Поточний статус: {order.status}"
            )
        
        # 🔥 АВТОМАТИЧНО ВСТАНОВИТИ client_confirmed = True
        order.client_confirmed = True
        
        # Змінити статус на processing
        order.status = 'processing'
        order.updated_at = datetime.now()
        
        print(f"[MOVE TO PREP] Новий статус: {order.status}, client_confirmed: {order.client_confirmed}")
        
        # Оновити або створити issue card
        issue_card = db.query(DecorIssueCard).filter(
            DecorIssueCard.order_id == order_id
        ).first()
        
        if not issue_card:
            # Створити issue card якщо його ще немає
            print(f"[MOVE TO PREP] Створюємо новий issue card")
            issue_card = DecorIssueCard(
                order_id=order_id,
                status='preparation',
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.add(issue_card)
        else:
            print(f"[MOVE TO PREP] Оновлюємо існуючий issue card")
            issue_card.status = 'preparation'  # Тепер комірники можуть збирати
            issue_card.updated_at = datetime.now()
        
        db.commit()
        db.refresh(issue_card)
        
        print(f"[MOVE TO PREP] ✅ Успішно! order_id={order_id}, issue_card_id={issue_card.id}, status={order.status}, client_confirmed={order.client_confirmed}")
        
        return {
            "success": True,
            "message": "Замовлення відправлено на збір. Клієнт автоматично підтверджений.",
            "order_id": order_id,
            "issue_card_id": issue_card.id,
            "status": order.status,
            "client_confirmed": order.client_confirmed
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[MOVE TO PREP] ❌ Помилка: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Помилка відправки на збір: {str(e)}"
        )


@decor_router.post("/{order_id}/complete-return")
async def complete_return(
    order_id: int,
    return_data: dict,
    db: Session = Depends(get_oc_db)
):
    """
    Завершити повернення замовлення з decor_orders
    
    Body: {
        "items_returned": [...],
        "late_fee": 0,
        "cleaning_fee": 0,
        "damage_fee": 0,
        "deposit_action": "use" | "release" | "part-release",
        "manager_notes": "..."
    }
    """
    try:
        # Знайти decor_order
        order = db.query(DecorOrder).filter(DecorOrder.id == order_id).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        # Оновити статус на 'returned' або 'settled'
        order.status = 'returned'
        order.updated_at = datetime.now()
        
        # Знайти або створити return card
        return_card = db.query(DecorReturnCard).filter(
            DecorReturnCard.order_id == order_id
        ).first()
        
        if not return_card:
            # Створити нову return card з таким же ID як decor_order
            return_card = DecorReturnCard(
                id=f"return_{order_id}",  # 🎯 Використовуємо той самий номер!
                order_id=order_id,
                order_number=f"#{order.opencart_order_id}",
                issue_card_id=f"issue_{order_id}",
                status='checking'
            )
            db.add(return_card)
        
        # Оновити return card даними
        items_returned = return_data.get('items_returned', [])
        return_card.items_returned = json.dumps(items_returned) if isinstance(items_returned, list) else items_returned
        return_card.late_fee = return_data.get('late_fee', 0)
        return_card.cleaning_fee = return_data.get('cleaning_fee', 0)
        return_card.return_notes = return_data.get('manager_notes', '')
        return_card.status = 'resolved'
        return_card.returned_at = datetime.now()
        return_card.checked_at = datetime.now()
        
        # Створити фінансові транзакції для fees
        late_fee = float(return_data.get('late_fee', 0))
        cleaning_fee = float(return_data.get('cleaning_fee', 0))
        damage_fee = float(return_data.get('damage_fee', 0))
        
        if late_fee > 0:
            late_transaction = FinanceTransaction(
                id=str(uuid.uuid4()),
                order_id=order.opencart_order_id,  # Використовуємо order_id
                order_number=f"#{order.opencart_order_id}",
                type='late_fee',
                title='Пеня за прострочення',
                description=f"decor_order_id:{order_id}",
                debit=late_fee,
                credit=0,
                currency='UAH',
                status='unpaid',
                counterparty=order.client_name
            )
            db.add(late_transaction)
        
        if cleaning_fee > 0:
            cleaning_transaction = FinanceTransaction(
                id=str(uuid.uuid4()),
                order_id=order.opencart_order_id,
                order_number=f"#{order.opencart_order_id}",
                type='cleaning_fee',
                title='Чистка/мийка',
                description=f"decor_order_id:{order_id}",
                debit=cleaning_fee,
                credit=0,
                currency='UAH',
                status='unpaid',
                counterparty=order.client_name
            )
            db.add(cleaning_transaction)
        
        if damage_fee > 0:
            damage_transaction = FinanceTransaction(
                id=str(uuid.uuid4()),
                order_id=order.opencart_order_id,
                order_number=f"#{order.opencart_order_id}",
                type='damage',
                title='Відшкодування пошкоджень',
                description=f"decor_order_id:{order_id}",
                debit=damage_fee,
                credit=0,
                currency='UAH',
                status='unpaid',
                counterparty=order.client_name
            )
            db.add(damage_transaction)
        
        # Обробка застави
        deposit_action = return_data.get('deposit_action')
        if deposit_action:
            # Знайти deposit_hold транзакцію  
            deposit_transaction = db.query(FinanceTransaction).filter(
                and_(
                    FinanceTransaction.order_id == order.opencart_order_id,
                    FinanceTransaction.type == 'deposit_hold',
                    FinanceTransaction.status == 'held'
                )
            ).first()
            
            if deposit_transaction:
                deposit_amount = float(deposit_transaction.credit or 0)
                total_fees = late_fee + cleaning_fee + damage_fee
                
                if deposit_action == 'use':
                    # Списати з застави
                    used_amount = min(deposit_amount, total_fees)
                    remaining = deposit_amount - used_amount
                    
                    writeoff_transaction = FinanceTransaction(
                        id=str(uuid.uuid4()),
                        opencart_order_id=order.opencart_order_id,
                        decor_order_id=order_id,
                        type='deposit_writeoff',
                        title='Списання із застави',
                        debit=0,
                        credit=used_amount,
                        currency='UAH',
                        status='completed',
                        date=datetime.now().date(),
                        notes=f"Списано на покриття штрафів"
                    )
                    db.add(writeoff_transaction)
                    
                    # Якщо залишилася застава, повернути її
                    if remaining > 0:
                        release_transaction = FinanceTransaction(
                            id=str(uuid.uuid4()),
                            opencart_order_id=order.opencart_order_id,
                            decor_order_id=order_id,
                            type='deposit_release',
                            title='Повернення застави',
                            debit=0,
                            credit=remaining,
                            currency='UAH',
                            status='completed',
                            date=datetime.now().date(),
                            notes=f"Повернено залишок застави"
                        )
                        db.add(release_transaction)
                    
                    deposit_transaction.status = 'released'
                
                elif deposit_action == 'release':
                    # Повернути всю заставу
                    release_transaction = FinanceTransaction(
                        id=str(uuid.uuid4()),
                        opencart_order_id=order.opencart_order_id,
                        decor_order_id=order_id,
                        type='deposit_release',
                        title='Повернення застави',
                        debit=0,
                        credit=deposit_amount,
                        currency='UAH',
                        status='completed',
                        date=datetime.now().date(),
                        notes=f"Повернено повну заставу"
                    )
                    db.add(release_transaction)
                    deposit_transaction.status = 'released'
                
                elif deposit_action == 'part-release':
                    # Частково повернути (після покриття штрафів)
                    used_amount = min(deposit_amount, total_fees)
                    remaining = deposit_amount - used_amount
                    
                    if used_amount > 0:
                        writeoff_transaction = FinanceTransaction(
                            id=str(uuid.uuid4()),
                            opencart_order_id=order.opencart_order_id,
                            decor_order_id=order_id,
                            type='deposit_writeoff',
                            title='Списання із застави',
                            debit=0,
                            credit=used_amount,
                            currency='UAH',
                            status='completed',
                            date=datetime.now().date(),
                            notes=f"Списано на покриття штрафів"
                        )
                        db.add(writeoff_transaction)
                    
                    if remaining > 0:
                        release_transaction = FinanceTransaction(
                            id=str(uuid.uuid4()),
                            opencart_order_id=order.opencart_order_id,
                            decor_order_id=order_id,
                            type='deposit_release',
                            title='Повернення застави',
                            debit=0,
                            credit=remaining,
                            currency='UAH',
                            status='completed',
                            date=datetime.now().date(),
                            notes=f"Повернено залишок застави"
                        )
                        db.add(release_transaction)
                    
                    deposit_transaction.status = 'released'
        
        # Оновити OpenCart замовлення (якщо потрібно)
        if order.opencart_order_id:
            oc_order = db.query(OpenCartOrder).filter(
                OpenCartOrder.order_id == order.opencart_order_id
            ).first()
            
            if oc_order:
                oc_order.order_status_id = 13  # Повернуто
                oc_order.date_modified = datetime.now()
        
        db.commit()
        
        return {
            "success": True,
            "message": "Повернення завершено успішно",
            "order_id": order_id,
            "status": order.status,
            "return_card_id": return_card.id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка завершення повернення: {str(e)}"
        )


@decor_router.put("/{order_id}/items")
async def update_order_items(
    order_id: int,
    items_data: dict,
    db: Session = Depends(get_oc_db)
):
    """
    Оновити товари в замовленні
    
    Body: {
        "items": [
            {
                "inventory_id": str,
                "article": str,
                "name": str,
                "quantity": int,
                "price_per_day": float,
                "damage_cost": float,
                "deposit": float,
                "total_rental": float,
                "total_deposit": float
            }
        ]
    }
    """
    try:
        print(f"[UPDATE ITEMS] Оновлення товарів для замовлення #{order_id}")
        
        # Знайти DecorOrder
        decor_order = db.query(DecorOrder).filter(DecorOrder.id == order_id).first()
        
        if not decor_order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        items = items_data.get('items', [])
        print(f"[UPDATE ITEMS] Отримано {len(items)} товарів")
        
        # Видалити старі items
        db.query(DecorOrderItem).filter(DecorOrderItem.order_id == order_id).delete()
        print(f"[UPDATE ITEMS] Видалено старі товари")
        
        # Додати нові items
        total_rental = 0
        total_deposit = 0
        
        for item_data in items:
            # Знайти product_id по inventory_id
            product_id = item_data.get('inventory_id')
            quantity = item_data['quantity']
            
            # Якщо damage_cost не переданий з frontend - завантажити з OpenCart
            damage_cost = float(item_data.get('damage_cost', 0))
            if damage_cost == 0 and product_id:
                oc_product = db.query(OpenCartProduct).filter(
                    OpenCartProduct.product_id == int(product_id)
                ).first()
                if oc_product and oc_product.ean:
                    damage_cost = float(oc_product.ean)
                    print(f"[UPDATE ITEMS] Завантажено damage_cost з OpenCart: {damage_cost}")
            
            # Розрахувати deposit: (damage_cost * quantity) / 2
            item_deposit = (damage_cost * quantity) / 2
            
            print(f"[UPDATE ITEMS] {item_data['name']}: qty={quantity}, damage_cost={damage_cost}, deposit={item_deposit}")
            
            new_item = DecorOrderItem(
                order_id=order_id,
                product_id=int(product_id) if product_id else None,
                sku=item_data.get('article', ''),
                name=item_data['name'],
                quantity=quantity,
                price_per_day=float(item_data.get('price_per_day', 0)),
                damage_cost=damage_cost,
                total_rental=float(item_data.get('total_rental', 0)),
                deposit=item_deposit,
                image=item_data.get('image')
            )
            db.add(new_item)
            
            total_rental += float(item_data.get('total_rental', 0))
            total_deposit += item_deposit
            
            print(f"[UPDATE ITEMS]   + {item_data['name']} x{quantity} → deposit: ₴{item_deposit}")
        
        # Оновити totals в DecorOrder
        decor_order.total_rental = total_rental
        decor_order.total_deposit = total_deposit
        decor_order.updated_at = datetime.now()
        
        db.commit()
        
        print(f"[UPDATE ITEMS] ✅ Товари оновлено. Total: ₴{total_rental}, Deposit: ₴{total_deposit}")
        
        return {
            "success": True,
            "message": "Товари оновлено",
            "items_count": len(items),
            "total_rental": total_rental,
            "total_deposit": total_deposit
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[UPDATE ITEMS] ❌ Помилка: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Помилка оновлення товарів: {str(e)}"
        )

