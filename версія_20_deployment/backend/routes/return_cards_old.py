"""
Return Cards routes - Картки повернення
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import json

from database import get_db
from models_sqlalchemy import (
    DecorReturnCard, DecorIssueCard, OpenCartOrder,
    DecorDamage, DecorDamageItem, DecorPhoto
)

router = APIRouter(prefix="/api/return-cards", tags=["return-cards"])

# ============================================================
# PYDANTIC MODELS
# ============================================================

class ReturnItem(BaseModel):
    sku: str
    name: str
    quantity_expected: int
    quantity_returned: int
    condition: str = "ok"  # ok, dirty, damaged, missing
    photos_before: List[str] = []
    photos_after: List[str] = []
    notes: Optional[str] = None
    damage_amount: Optional[float] = None

class ReturnCardUpdate(BaseModel):
    status: Optional[str] = None
    items_returned: Optional[List[ReturnItem]] = None
    cleaning_fee: Optional[float] = None
    late_fee: Optional[float] = None
    return_notes: Optional[str] = None
    received_by: Optional[str] = None
    checked_by: Optional[str] = None

# ============================================================
# API ENDPOINTS
# ============================================================

@router.get("")
async def get_return_cards(
    status: Optional[str] = None,
    order_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Отримати всі картки повернення"""
    query = db.query(DecorReturnCard)
    
    if status:
        query = query.filter(DecorReturnCard.status == status)
    if order_id:
        query = query.filter(DecorReturnCard.order_id == order_id)
    
    cards = query.order_by(DecorReturnCard.created_at.desc()).all()
    
    return [
        {
            "id": card.id,
            "order_id": card.order_id,
            "order_number": card.order_number,
            "issue_card_id": card.issue_card_id,
            "status": card.status,
            "items_expected": json.loads(card.items_expected) if isinstance(card.items_expected, str) else (card.items_expected or []),
            "items_returned": json.loads(card.items_returned) if isinstance(card.items_returned, str) else (card.items_returned or []),
            "total_items_expected": card.total_items_expected,
            "total_items_returned": card.total_items_returned,
            "items_ok": card.items_ok,
            "items_dirty": card.items_dirty,
            "items_damaged": card.items_damaged,
            "items_missing": card.items_missing,
            "cleaning_fee": float(card.cleaning_fee) if card.cleaning_fee else 0.0,
            "late_fee": float(card.late_fee) if card.late_fee else 0.0,
            "return_notes": card.return_notes,
            "received_by": card.received_by,
            "checked_by": card.checked_by,
            "returned_at": card.returned_at.isoformat() if card.returned_at else None,
            "checked_at": card.checked_at.isoformat() if card.checked_at else None,
            "created_at": card.created_at.isoformat(),
            "updated_at": card.updated_at.isoformat()
        }
        for card in cards
    ]

@router.get("/{card_id}")
async def get_return_card(card_id: str, db: Session = Depends(get_db)):
    """Отримати одну картку повернення"""
    card = db.query(DecorReturnCard).filter(DecorReturnCard.id == card_id).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Return card not found")
    
    return {
        "id": card.id,
        "order_id": card.order_id,
        "order_number": card.order_number,
        "issue_card_id": card.issue_card_id,
        "status": card.status,
        "items_expected": json.loads(card.items_expected) if isinstance(card.items_expected, str) else (card.items_expected or []),
        "items_returned": json.loads(card.items_returned) if isinstance(card.items_returned, str) else (card.items_returned or []),
        "total_items_expected": card.total_items_expected,
        "total_items_returned": card.total_items_returned,
        "items_ok": card.items_ok,
        "items_dirty": card.items_dirty,
        "items_damaged": card.items_damaged,
        "items_missing": card.items_missing,
        "cleaning_fee": float(card.cleaning_fee) if card.cleaning_fee else 0.0,
        "late_fee": float(card.late_fee) if card.late_fee else 0.0,
        "return_notes": card.return_notes,
        "received_by": card.received_by,
        "checked_by": card.checked_by,
        "returned_at": card.returned_at.isoformat() if card.returned_at else None,
        "checked_at": card.checked_at.isoformat() if card.checked_at else None,
        "created_at": card.created_at.isoformat(),
        "updated_at": card.updated_at.isoformat()
    }

@router.put("/{card_id}")
async def update_return_card(
    card_id: str,
    update_data: ReturnCardUpdate,
    db: Session = Depends(get_db)
):
    """Оновити картку повернення"""
    card = db.query(DecorReturnCard).filter(DecorReturnCard.id == card_id).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Return card not found")
    
    # 🔹 Додано логіку зміни статусів
    if update_data.status is not None:
        card.status = update_data.status
        
        if update_data.status == "checking" and not card.returned_at:
            card.returned_at = datetime.now()
            # Змінити статус замовлення на "Повернуто" (ID 25)
            order = db.query(OpenCartOrder).filter(
                OpenCartOrder.order_id == card.order_id
            ).first()
            if order:
                order.order_status_id = 25  # Повернуто
                order.date_modified = datetime.now()
        
        elif update_data.status == "resolved" and not card.checked_at:
            card.checked_at = datetime.now()
    
    if update_data.items_returned is not None:
        card.items_returned = json.dumps([item.dict() for item in update_data.items_returned])
        
        # Підрахунок статистики
        card.total_items_returned = sum(item.quantity_returned for item in update_data.items_returned)
        card.items_ok = sum(1 for item in update_data.items_returned if item.condition == "ok")
        card.items_dirty = sum(1 for item in update_data.items_returned if item.condition == "dirty")
        card.items_damaged = sum(1 for item in update_data.items_returned if item.condition == "damaged")
        card.items_missing = sum(1 for item in update_data.items_returned if item.condition == "missing")
    
    if update_data.cleaning_fee is not None:
        card.cleaning_fee = update_data.cleaning_fee
    
    if update_data.late_fee is not None:
        card.late_fee = update_data.late_fee
    
    if update_data.return_notes is not None:
        card.return_notes = update_data.return_notes
    
    if update_data.received_by is not None:
        card.received_by = update_data.received_by
    
    if update_data.checked_by is not None:
        card.checked_by = update_data.checked_by
    
    db.commit()
    db.refresh(card)
    
    return await get_return_card(card_id, db)

@router.post("/{card_id}/return-item")
async def return_item(
    card_id: str,
    item_data: ReturnItem,
    db: Session = Depends(get_db)
):
    """Відмітити повернення позиції"""
    card = db.query(DecorReturnCard).filter(DecorReturnCard.id == card_id).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Return card not found")
    
    items_returned = json.loads(card.items_returned) if isinstance(card.items_returned, str) else (card.items_returned or [])
    
    # Додати або оновити позицію
    found = False
    for item in items_returned:
        if item['sku'] == item_data.sku:
            item.update(item_data.dict())
            found = True
            break
    
    if not found:
        items_returned.append(item_data.dict())
    
    card.items_returned = json.dumps(items_returned)
    
    # Оновити статистику
    card.total_items_returned = sum(item['quantity_returned'] for item in items_returned)
    card.items_ok = sum(1 for item in items_returned if item['condition'] == 'ok')
    card.items_dirty = sum(1 for item in items_returned if item['condition'] == 'dirty')
    card.items_damaged = sum(1 for item in items_returned if item['condition'] == 'damaged')
    card.items_missing = sum(1 for item in items_returned if item['condition'] == 'missing')
    
    db.commit()
    db.refresh(card)
    
    return await get_return_card(card_id, db)

@router.post("/{card_id}/create-damage-case")
async def create_damage_from_return(
    card_id: str,
    damage_data: dict,
    db: Session = Depends(get_db)
):
    """Створити кейс шкоди з картки повернення"""
    card = db.query(DecorReturnCard).filter(DecorReturnCard.id == card_id).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Return card not found")
    
    # Отримати замовлення для інформації про клієнта
    order = db.query(OpenCartOrder).filter(
        OpenCartOrder.order_id == card.order_id
    ).first()
    
    case_id = f"DMG-{str(uuid.uuid4())[:8].upper()}"
    
    # Створити кейс шкоди
    new_damage = DecorDamage(
        id=case_id,
        order_id=card.order_id,
        order_number=card.order_number,
        customer_id=order.customer_id if order else None,
        customer_name=f"{order.firstname} {order.lastname}" if order else "Unknown",
        customer_phone=order.telephone if order else "",
        customer_email=order.email if order else "",
        case_status="estimated",
        finance_status="none",
        fulfillment_status="none",
        claimed_total=damage_data.get('claimed_total', 0.0),
        paid_total=0.00,
        withheld_total=0.00,
        deposit_available=damage_data.get('deposit_available', 0.0),
        notes=f"Створено автоматично з картки повернення {card.id}",
        payment_policy="withhold_first",
        created_by="System"
    )
    
    db.add(new_damage)
    
    # Створити позиції шкоди
    for item in damage_data.get('items', []):
        damage_item = DecorDamageItem(
            damage_id=case_id,
            barcode=item.get('sku', ''),
            name=item.get('name', ''),
            category=item.get('category', ''),
            damage_type=item.get('damage_type', 'damaged'),
            qty=item.get('qty', 1),
            base_value=item.get('base_value', 0.0),
            estimate_value=item.get('estimate_value', 0.0),
            comment=item.get('comment', ''),
            photos=json.dumps(item.get('photos', []))
        )
        db.add(damage_item)
    
    db.commit()
    
    return {
        "success": True,
        "damage_case_id": case_id,
        "message": "Damage case created successfully"
    }

@router.post("/{card_id}/complete")
async def complete_return(
    card_id: str,
    complete_data: dict,
    db: Session = Depends(get_db)
):
    """Завершити перевірку повернення"""
    card = db.query(DecorReturnCard).filter(DecorReturnCard.id == card_id).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Return card not found")
    
    # Оновити статус картки
    card.status = "resolved"
    card.checked_at = datetime.now()
    card.checked_by = complete_data.get('checked_by', 'Manager')
    
    # 🔹 ЗАКРИТИ РЕЗЕРВАЦІЇ (розморозити товари)
    if card.items_returned:
        from models_sqlalchemy import ProductReservation
        
        for item in card.items_returned:
            sku = item.get('sku')
            quantity_returned = item.get('quantity_returned', 0)
            condition = item.get('condition', 'ok')
            
            if quantity_returned > 0:
                # Знайти активні резервації по цьому замовленню і SKU
                reservations = db.query(ProductReservation).filter(
                    ProductReservation.order_id == card.order_id,
                    ProductReservation.sku == sku,
                    ProductReservation.status == 'issued'
                ).all()
                
                for reservation in reservations:
                    # Закрити резервацію
                    reservation.status = 'returned'
                    reservation.return_card_id = card.id
                    reservation.returned_at = datetime.now()
                    reservation.notes = f"Condition: {condition}"
    
    # 🔹 Оновити статус замовлення на "Завершено" (ID 13)
    order = db.query(OpenCartOrder).filter(
        OpenCartOrder.order_id == card.order_id
    ).first()
    
    if order:
        order.order_status_id = 13  # Завершено
        order.date_modified = datetime.now()
    
    db.commit()
    
    return {
        "success": True,
        "message": "Повернення завершено, товари повернуті в інвентар",
        "return_card": await get_return_card(card_id, db)
    }

@router.get("/by-order/{order_id}")
async def get_return_card_by_order(order_id: int, db: Session = Depends(get_db)):
    """Отримати картку повернення по ID замовлення"""
    card = db.query(DecorReturnCard).filter(
        DecorReturnCard.order_id == order_id
    ).order_by(DecorReturnCard.created_at.desc()).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Return card not found for this order")
    
    return await get_return_card(card.id, db)
