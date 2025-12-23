"""
Issue Cards routes - Картки видачі
✅ MIGRATED: Using RentalHub DB
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import uuid
import json

from database_rentalhub import get_rh_db  # ✅ Using RentalHub DB

router = APIRouter(prefix="/api/issue-cards", tags=["issue-cards"])

# ============================================================
# PYDANTIC MODELS
# ============================================================

class IssueItem(BaseModel):
    sku: str
    name: str
    quantity: int
    status: str = "pending"  # pending, prepared, ready, issued
    photos: List[str] = []
    notes: Optional[str] = None

class IssueCardCreate(BaseModel):
    order_id: int
    order_number: str
    items: List[IssueItem]
    preparation_notes: Optional[str] = None

class IssueCardUpdate(BaseModel):
    status: Optional[str] = None
    items: Optional[List[dict]] = None  # Приймаємо будь-який dict для гнучкості
    preparation_notes: Optional[str] = None
    issue_notes: Optional[str] = None
    prepared_by: Optional[str] = None
    issued_by: Optional[str] = None
    checklist: Optional[dict] = None
    manager_notes: Optional[str] = None

class IssueItemUpdate(BaseModel):
    sku: str
    status: str
    photos: Optional[List[str]] = None
    notes: Optional[str] = None

# ============================================================
# API ENDPOINTS
# ============================================================

@router.get("")
async def get_issue_cards(
    status: Optional[str] = None,
    order_id: Optional[int] = None,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати всі картки видачі
    ✅ MIGRATED: Using RentalHub DB
    """
    sql_query = "SELECT * FROM issue_cards WHERE 1=1"
    params = {}
    
    if status:
        sql_query += " AND status = :status"
        params['status'] = status
    if order_id:
        sql_query += " AND order_id = :order_id"
        params['order_id'] = order_id
    
    sql_query += " ORDER BY created_at DESC"
    
    result_db = db.execute(text(sql_query), params)
    
    result = []
    for row in result_db:
        # Parse items JSON and enrich with product images
        items = []
        if row[6]:  # items column
            try:
                items = json.loads(row[6]) if isinstance(row[6], str) else row[6]
            except:
                items = []
        
        # Enrich items with images from products table
        for item in items:
            if 'sku' in item and not item.get('image'):
                img_result = db.execute(text("""
                    SELECT image_url FROM products WHERE sku = :sku LIMIT 1
                """), {"sku": item['sku']})
                img_row = img_result.fetchone()
                if img_row and img_row[0]:
                    item['image'] = img_row[0]
                    item['photo'] = img_row[0]
        
        result.append({
            "id": row[0],
            "order_id": row[1],
            "order_number": row[2],
            "status": row[3],
            "items": items,
            "preparation_notes": row[7],
            "issue_notes": row[8],
            "prepared_by": row[4],
            "issued_by": row[5],
            "prepared_at": row[9].isoformat() if row[9] else None,
            "issued_at": row[10].isoformat() if row[10] else None,
            "created_at": row[11].isoformat() if row[11] else None,
            "updated_at": row[12].isoformat() if row[12] else None
        })
    
    return result

@router.get("/{card_id}")
async def get_issue_card(card_id: str, db: Session = Depends(get_rh_db)):
    """Отримати одну картку видачі"""
    card = db.query(DecorIssueCard).filter(DecorIssueCard.id == card_id).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Issue card not found")
    
    # Отримати items і підтягнути фото якщо відсутні
    items = card.items if isinstance(card.items, list) else (json.loads(card.items) if card.items else [])
    
    for item in items:
        if 'sku' in item and (not item.get('image') or not item.get('photo')):
            product = db.query(OpenCartProduct).filter(
                OpenCartProduct.model == item['sku']
            ).first()
            
            if product and product.image:
                item['image'] = f"https://farforrent.com.ua/image/{product.image}"
                item['photo'] = item['image']
    
    return {
        "id": card.id,
        "order_id": card.order_id,
        "order_number": card.order_number,
        "status": card.status,
        "items": items,
        "preparation_notes": card.preparation_notes,
        "issue_notes": card.issue_notes,
        "prepared_by": card.prepared_by,
        "issued_by": card.issued_by,
        "prepared_at": card.prepared_at.isoformat() if card.prepared_at else None,
        "issued_at": card.issued_at.isoformat() if card.issued_at else None,
        "created_at": card.created_at.isoformat(),
        "updated_at": card.updated_at.isoformat()
    }

@router.post("")
async def create_issue_card(card_data: dict, db: Session = Depends(get_rh_db)):
    """Створити картку видачі - accepts flexible format"""
    
    try:
        card_id = f"ISSUE-{str(uuid.uuid4())[:8].upper()}"
        
        # Перевірити що замовлення існує
        order_id = card_data.get('order_id')
        if not order_id:
            raise HTTPException(status_code=400, detail="order_id is required")
            
        order = db.query(OpenCartOrder).filter(
            OpenCartOrder.order_id == int(order_id)
        ).first()
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Get order number if not provided
        order_number = card_data.get('order_number', str(order.order_id))
        
        # Process items і підтягнути фото
        items_data = card_data.get('items', [])
        if isinstance(items_data, str):
            items_data = json.loads(items_data)
        
        # Для кожного товару підтягнути image з oc_product
        for item in items_data:
            if 'sku' in item and (not item.get('image') or not item.get('photo')):
                product = db.query(OpenCartProduct).filter(
                    OpenCartProduct.model == item['sku']
                ).first()
                
                if product and product.image:
                    item['image'] = f"https://farforrent.com.ua/image/{product.image}"
                    item['photo'] = item['image']  # Дублювати для сумісності
        
        # Створити картку
        new_card = DecorIssueCard(
            id=card_id,
            order_id=int(order_id),
            order_number=order_number,
            status="issued",  # Set to issued immediately
            items=json.dumps(items_data) if items_data else "[]",
            preparation_notes=card_data.get('preparation_notes', ''),
            issued_at=datetime.now()
        )
        
        db.add(new_card)
        db.commit()
        db.refresh(new_card)
        
        return {
            "success": True,
            "card_id": card_id,
            "order_id": order_id,
            "status": "issued"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create issue card: {str(e)}"
        )

@router.put("/{card_id}")
async def update_issue_card(
    card_id: str,
    update_data: IssueCardUpdate,
    db: Session = Depends(get_rh_db)
):
    """Оновити картку видачі"""
    card = db.query(DecorIssueCard).filter(DecorIssueCard.id == card_id).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Issue card not found")
    
    # Оновити поля
    if update_data.status is not None:
        print(f"[ISSUE CARD UPDATE] Змінюємо статус з {card.status} на {update_data.status}")
        card.status = update_data.status
        
        # Автоматично встановлювати дати
        if update_data.status == "ready" and not card.prepared_at:
            card.prepared_at = datetime.now()
            
            # 🔥 ОНОВИТИ СТАТУС DECOR ORDER НА "ready_for_issue"
            decor_order = db.query(DecorOrder).filter(
                DecorOrder.id == card.order_id
            ).first()
            
            if decor_order:
                print(f"[ISSUE CARD UPDATE] Оновлюємо DecorOrder #{decor_order.id} з {decor_order.status} на ready_for_issue")
                decor_order.status = 'ready_for_issue'
                decor_order.updated_at = datetime.now()
        elif update_data.status == "issued" and not card.issued_at:
            card.issued_at = datetime.now()
    
    if update_data.items is not None:
        # Оновити items і підтягнути фото з OpenCart
        items = update_data.items if isinstance(update_data.items, list) else json.loads(update_data.items)
        
        # Для кожного товару підтягнути image з oc_product якщо його немає
        for item in items:
            if 'sku' in item and (not item.get('image') or not item.get('photo')):
                product = db.query(OpenCartProduct).filter(
                    OpenCartProduct.model == item['sku']
                ).first()
                
                if product and product.image:
                    item['image'] = f"https://farforrent.com.ua/image/{product.image}"
                    item['photo'] = item['image']  # Дублювати для сумісності
        
        card.items = json.dumps(items)
    
    if update_data.preparation_notes is not None:
        card.preparation_notes = update_data.preparation_notes
    
    if update_data.issue_notes is not None:
        card.issue_notes = update_data.issue_notes
    
    if update_data.prepared_by is not None:
        card.prepared_by = update_data.prepared_by
    
    if update_data.issued_by is not None:
        card.issued_by = update_data.issued_by
    
    if update_data.checklist is not None:
        card.checklist = json.dumps(update_data.checklist)
    
    if update_data.manager_notes is not None:
        card.issue_notes = update_data.manager_notes  # Зберегти в issue_notes
    
    db.commit()
    db.refresh(card)
    
    return await get_issue_card(card_id, db)

@router.put("/{card_id}/item")
async def update_issue_item(
    card_id: str,
    item_update: IssueItemUpdate,
    db: Session = Depends(get_rh_db)
):
    """Оновити статус однієї позиції"""
    card = db.query(DecorIssueCard).filter(DecorIssueCard.id == card_id).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Issue card not found")
    
    items = card.items if isinstance(card.items, list) else (json.loads(card.items) if card.items else [])
    
    # Знайти і оновити позицію
    found = False
    for item in items:
        if item['sku'] == item_update.sku:
            item['status'] = item_update.status
            if item_update.photos is not None:
                item['photos'] = item_update.photos
            if item_update.notes is not None:
                item['notes'] = item_update.notes
            found = True
            break
    
    if not found:
        raise HTTPException(status_code=404, detail="Item not found in issue card")
    
    card.items = json.dumps(items)
    db.commit()
    db.refresh(card)
    
    return await get_issue_card(card_id, db)

@router.post("/{card_id}/complete")
async def complete_issue(
    card_id: str,
    complete_data: dict,
    db: Session = Depends(get_rh_db)
):
    """Завершити видачу (видати замовлення клієнту)"""
    card = db.query(DecorIssueCard).filter(DecorIssueCard.id == card_id).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Issue card not found")
    
    # Оновити статус картки
    card.status = "issued"
    card.issued_at = datetime.now()
    card.issued_by = complete_data.get('issued_by', 'Manager')
    card.issue_notes = complete_data.get('issue_notes', '')
    
    # 🔹 СТВОРЮЄМО РЕЗЕРВАЦІЇ ТОВАРІВ (заморожуємо на період оренди)
    if card.items and decor_order:
        from models_sqlalchemy import ProductReservation, OpenCartProduct
        
        items = card.items if isinstance(card.items, list) else (json.loads(card.items) if card.items else [])
        
        for item in items:
            sku = item.get('sku')
            quantity = item.get('quantity', 0)
            
            if sku and quantity > 0:
                # Знайти product_id по SKU
                product = db.query(OpenCartProduct).filter(
                    OpenCartProduct.sku == sku
                ).first()
                
                if product:
                    # Створити резервацію
                    reservation = ProductReservation(
                        product_id=product.product_id,
                        sku=sku,
                        product_name=item.get('name', ''),
                        quantity_reserved=quantity,
                        order_id=decor_order.id,
                        order_number=card.order_number,
                        client_name=decor_order.client_name,
                        client_phone=decor_order.client_phone,
                        reserved_from=decor_order.rent_date,
                        reserved_to=decor_order.rent_return_date,
                        status='issued',  # видано клієнту
                        issue_card_id=card.id,
                        issued_at=datetime.now()
                    )
                    db.add(reservation)
    
    # Оновити статус DECOR замовлення на "issued" (видано)
    decor_order = db.query(DecorOrder).filter(
        DecorOrder.id == card.order_id
    ).first()
    
    if decor_order:
        decor_order.status = 'issued'  # processing -> issued
        decor_order.updated_at = datetime.now()
    
    # Також оновити OpenCart замовлення на "Видано" (ID 24)
    oc_order = db.query(OpenCartOrder).filter(
        OpenCartOrder.order_id == decor_order.opencart_order_id
    ).first()
    
    if oc_order:
        oc_order.order_status_id = 24  # Видано (ID 24)
        oc_order.date_modified = datetime.now()
    
    db.commit()
    
    # Створити ReturnCard автоматично
    from models_sqlalchemy import DecorReturnCard
    
    return_card_id = f"RETURN-{str(uuid.uuid4())[:8].upper()}"
    
    items_expected = card.items if isinstance(card.items, list) else (json.loads(card.items) if card.items else [])
    
    new_return_card = DecorReturnCard(
        id=return_card_id,
        order_id=card.order_id,
        order_number=card.order_number,
        issue_card_id=card.id,
        status="active",
        items_expected=card.items,
        items_returned=json.dumps([]),
        total_items_expected=sum(item.get('quantity', 0) for item in items_expected)
    )
    
    db.add(new_return_card)
    db.commit()
    
    return {
        "success": True,
        "message": "Замовлення видано клієнту",
        "issue_card": await get_issue_card(card_id, db),
        "return_card_id": return_card_id
    }

@router.delete("/{card_id}")
async def delete_issue_card(card_id: str, db: Session = Depends(get_rh_db)):
    """Видалити картку видачі"""
    card = db.query(DecorIssueCard).filter(DecorIssueCard.id == card_id).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Issue card not found")
    
    db.delete(card)
    db.commit()
    
    return {"message": "Issue card deleted successfully"}

@router.get("/by-order/{order_id}")
async def get_issue_card_by_order(order_id: int, db: Session = Depends(get_rh_db)):
    """Отримати картку видачі по ID замовлення"""
    card = db.query(DecorIssueCard).filter(
        DecorIssueCard.order_id == order_id
    ).order_by(DecorIssueCard.created_at.desc()).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Issue card not found for this order")
    
    return await get_issue_card(card.id, db)
