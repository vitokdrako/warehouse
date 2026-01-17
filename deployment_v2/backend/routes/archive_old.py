"""
Archive routes - Архів завершених замовлень
Повна історія замовлення з усіма нотатками, змінами, документами
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc
from datetime import datetime, timedelta
from database import get_db
from models_sqlalchemy import (
    OpenCartOrder,
    OpenCartOrderProduct,
    OpenCartOrderSimpleFields,
    OpenCartProduct,
    OpenCartCustomer,
    DecorOrder,
    DecorOrderItem,
    DecorOrderLifecycle,
    DecorIssueCard,
    DecorReturnCard,
    DecorDamage,
    ProductReservation,
    FinanceTransaction
)

router = APIRouter(prefix="/api/archive", tags=["archive"])


@router.get("")
async def get_archived_orders(
    search: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    client_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    Отримати архівні замовлення (завершені та скасовані)
    """
    try:
        # Статуси для архіву:
        # 13 - Завершено (returned)
        # 5 - Completed
        # 9 - Cancelled
        archive_statuses = [13, 5, 9]
        
        query = db.query(
            OpenCartOrder,
            OpenCartOrderSimpleFields
        ).outerjoin(
            OpenCartOrderSimpleFields,
            OpenCartOrder.order_id == OpenCartOrderSimpleFields.order_id
        ).filter(
            OpenCartOrder.order_status_id.in_(archive_statuses)
        )
        
        # Пошук по номеру замовлення або імені клієнта
        if search:
            query = query.filter(
                or_(
                    OpenCartOrder.order_id == int(search) if search.isdigit() else False,
                    OpenCartOrder.firstname.contains(search),
                    OpenCartOrder.lastname.contains(search),
                    OpenCartOrder.telephone.contains(search)
                )
            )
        
        # Фільтр по датах
        if from_date:
            query = query.filter(OpenCartOrder.date_added >= from_date)
        if to_date:
            query = query.filter(OpenCartOrder.date_added <= to_date)
        
        # Фільтр по клієнту
        if client_id:
            query = query.filter(OpenCartOrder.customer_id == client_id)
        
        # Сортування по даті (найновіші першими)
        orders = query.order_by(desc(OpenCartOrder.date_added)).limit(limit).offset(offset).all()
        
        result = []
        for oc_order, simple_fields in orders:
            # Отримати товари
            products = db.query(OpenCartOrderProduct).filter(
                OpenCartOrderProduct.order_id == oc_order.order_id
            ).all()
            
            # Декор замовлення
            decor_order = db.query(DecorOrder).filter(
                DecorOrder.opencart_order_id == oc_order.order_id
            ).first()
            
            # Статус на українській
            status_map = {
                13: "Завершено",
                5: "Виконано",
                9: "Скасовано"
            }
            
            result.append({
                "order_id": oc_order.order_id,
                "order_number": f"#{oc_order.order_id}",
                "client_name": f"{oc_order.firstname} {oc_order.lastname}",
                "client_phone": oc_order.telephone,
                "client_email": oc_order.email,
                "status": status_map.get(oc_order.order_status_id, "Завершено"),
                "status_id": oc_order.order_status_id,
                "items_count": len(products),
                "total": float(oc_order.total),
                "date_created": str(oc_order.date_added),
                "date_modified": str(oc_order.date_modified),
                "rent_from": str(simple_fields.rent_issue_date) if simple_fields and simple_fields.rent_issue_date else None,
                "rent_to": str(simple_fields.rent_return_date) if simple_fields and simple_fields.rent_return_date else None,
                "has_damages": bool(decor_order and db.query(DecorDamage).filter(DecorDamage.order_id == decor_order.id).count() > 0)
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка завантаження архіву: {str(e)}"
        )


@router.get("/{order_id}/full-history")
async def get_order_full_history(
    order_id: int,
    db: Session = Depends(get_db)
):
    """
    Отримати ПОВНУ історію замовлення
    Включає: деталі, lifecycle, нотатки, документи, фінанси, шкоди
    """
    try:
        # 1. Основне замовлення OpenCart
        oc_order = db.query(OpenCartOrder).filter(
            OpenCartOrder.order_id == order_id
        ).first()
        
        if not oc_order:
            raise HTTPException(status_code=404, detail="Замовлення не знайдено")
        
        # 2. Simple fields
        simple_fields = db.query(OpenCartOrderSimpleFields).filter(
            OpenCartOrderSimpleFields.order_id == order_id
        ).first()
        
        # 3. Товари
        products = db.query(
            OpenCartOrderProduct,
            OpenCartProduct
        ).join(
            OpenCartProduct,
            OpenCartOrderProduct.product_id == OpenCartProduct.product_id
        ).filter(
            OpenCartOrderProduct.order_id == order_id
        ).all()
        
        items = []
        for order_product, product in products:
            items.append({
                "product_id": product.product_id,
                "sku": product.model,
                "name": order_product.name,
                "quantity": order_product.quantity,
                "price": float(order_product.price),
                "total": float(order_product.total),
                "image": f"https://farforrent.com.ua/image/{product.image}" if product.image else None
            })
        
        # 4. Decor Order
        decor_order = db.query(DecorOrder).filter(
            DecorOrder.opencart_order_id == order_id
        ).first()
        
        decor_data = None
        if decor_order:
            decor_data = {
                "id": decor_order.id,
                "status": decor_order.status,
                "rent_date": str(decor_order.rent_date) if decor_order.rent_date else None,
                "rent_return_date": str(decor_order.rent_return_date) if decor_order.rent_return_date else None,
                "rental_days": decor_order.rental_days,
                "total_rental": float(decor_order.total_rental or 0),
                "total_deposit": float(decor_order.total_deposit or 0),
                "notes": decor_order.notes,
                "manager_notes": decor_order.manager_notes,
                "client_confirmed": decor_order.client_confirmed
            }
        
        # 5. Lifecycle history
        lifecycle_events = db.query(DecorOrderLifecycle).filter(
            DecorOrderLifecycle.opencart_order_id == order_id
        ).order_by(DecorOrderLifecycle.timestamp.asc()).all()
        
        lifecycle = []
        for event in lifecycle_events:
            lifecycle.append({
                "action": event.action,
                "old_status": event.old_status,
                "new_status": event.new_status,
                "user": event.user,
                "timestamp": str(event.timestamp),
                "notes": event.notes
            })
        
        # 6. Issue Card
        issue_card = db.query(DecorIssueCard).filter(
            DecorIssueCard.order_id == decor_order.id if decor_order else None
        ).first()
        
        issue_data = None
        if issue_card:
            issue_data = {
                "id": issue_card.id,
                "status": issue_card.status,
                "created_at": str(issue_card.created_at),
                "issued_at": str(issue_card.issued_at) if issue_card.issued_at else None,
                "issued_by": issue_card.issued_by,
                "notes": issue_card.issue_notes
            }
        
        # 7. Return Card
        return_card = db.query(DecorReturnCard).filter(
            DecorReturnCard.order_id == decor_order.id if decor_order else None
        ).first()
        
        return_data = None
        if return_card:
            return_data = {
                "id": return_card.id,
                "status": return_card.status,
                "created_at": str(return_card.created_at),
                "returned_at": str(return_card.returned_at) if return_card.returned_at else None,
                "received_by": return_card.received_by,
                "checked_by": return_card.checked_by,
                "notes": return_card.return_notes,
                "items_returned": return_card.items_returned
            }
        
        # 8. Damages
        damages = db.query(DecorDamage).filter(
            DecorDamage.order_id == decor_order.id if decor_order else None
        ).all()
        
        damages_data = []
        for damage in damages:
            damages_data.append({
                "id": damage.id,
                "status": damage.status,
                "total_amount": float(damage.total_amount or 0),
                "paid_amount": float(damage.paid_amount or 0),
                "created_at": str(damage.created_at),
                "resolved_at": str(damage.resolved_at) if damage.resolved_at else None
            })
        
        # 9. Finance transactions
        transactions = db.query(FinanceTransaction).filter(
            FinanceTransaction.order_id == decor_order.id if decor_order else None
        ).all()
        
        finance_data = []
        for trans in transactions:
            finance_data.append({
                "id": trans.id,
                "type": trans.type,
                "title": trans.title,
                "debit": float(trans.debit or 0),
                "credit": float(trans.credit or 0),
                "currency": trans.currency,
                "status": trans.status,
                "date": str(trans.date) if trans.date else None
            })
        
        # 10. Reservations history
        reservations = db.query(ProductReservation).filter(
            ProductReservation.order_id == decor_order.id if decor_order else None
        ).all()
        
        reservations_data = []
        for res in reservations:
            reservations_data.append({
                "sku": res.sku,
                "product_name": res.product_name,
                "quantity": res.quantity_reserved,
                "status": res.status,
                "reserved_from": str(res.reserved_from),
                "reserved_to": str(res.reserved_to),
                "issued_at": str(res.issued_at) if res.issued_at else None,
                "returned_at": str(res.returned_at) if res.returned_at else None
            })
        
        # Повна історія
        return {
            "order": {
                "order_id": oc_order.order_id,
                "order_number": f"#{oc_order.order_id}",
                "status_id": oc_order.order_status_id,
                "client": {
                    "name": f"{oc_order.firstname} {oc_order.lastname}",
                    "phone": oc_order.telephone,
                    "email": oc_order.email,
                    "customer_id": oc_order.customer_id
                },
                "total": float(oc_order.total),
                "created_at": str(oc_order.date_added),
                "modified_at": str(oc_order.date_modified)
            },
            "items": items,
            "decor_order": decor_data,
            "lifecycle": lifecycle,
            "issue_card": issue_data,
            "return_card": return_data,
            "damages": damages_data,
            "finance": finance_data,
            "reservations": reservations_data,
            "timeline": _build_timeline(lifecycle_events, issue_card, return_card, damages, transactions)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка завантаження історії: {str(e)}"
        )


def _build_timeline(lifecycle_events, issue_card, return_card, damages, transactions):
    """Побудувати загальну timeline з усіх подій"""
    timeline = []
    
    # Lifecycle events
    for event in lifecycle_events:
        timeline.append({
            "timestamp": event.timestamp,
            "type": "lifecycle",
            "action": event.action,
            "description": f"{event.old_status} → {event.new_status}",
            "user": event.user
        })
    
    # Issue card
    if issue_card and issue_card.issued_at:
        timeline.append({
            "timestamp": issue_card.issued_at,
            "type": "issue",
            "action": "issued",
            "description": "Замовлення видано клієнту",
            "user": issue_card.issued_by
        })
    
    # Return card
    if return_card and return_card.returned_at:
        timeline.append({
            "timestamp": return_card.returned_at,
            "type": "return",
            "action": "returned",
            "description": "Замовлення повернуто",
            "user": return_card.received_by
        })
    
    # Damages
    for damage in damages:
        timeline.append({
            "timestamp": damage.created_at,
            "type": "damage",
            "action": "damage_created",
            "description": f"Створено справу про пошкодження ({float(damage.total_amount or 0)} грн)",
            "user": "System"
        })
    
    # Transactions
    for trans in transactions:
        if trans.date:
            timeline.append({
                "timestamp": trans.date,
                "type": "finance",
                "action": trans.type,
                "description": trans.title,
                "user": "Finance"
            })
    
    # Сортувати по часу
    timeline.sort(key=lambda x: x["timestamp"])
    
    return timeline


@router.get("/stats")
async def get_archive_stats(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Статистика по архіву
    """
    try:
        archive_statuses = [13, 5, 9]
        
        query = db.query(OpenCartOrder).filter(
            OpenCartOrder.order_status_id.in_(archive_statuses)
        )
        
        if from_date:
            query = query.filter(OpenCartOrder.date_added >= from_date)
        if to_date:
            query = query.filter(OpenCartOrder.date_added <= to_date)
        
        total_count = query.count()
        
        # По статусах
        completed_count = query.filter(OpenCartOrder.order_status_id == 13).count()
        cancelled_count = query.filter(OpenCartOrder.order_status_id == 9).count()
        
        # Загальна сума
        total_sum = db.query(func.sum(OpenCartOrder.total)).filter(
            OpenCartOrder.order_status_id.in_(archive_statuses)
        ).scalar() or 0
        
        return {
            "total_count": total_count,
            "completed_count": completed_count,
            "cancelled_count": cancelled_count,
            "total_revenue": float(total_sum),
            "period": {
                "from": from_date,
                "to": to_date
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка отримання статистики: {str(e)}"
        )
