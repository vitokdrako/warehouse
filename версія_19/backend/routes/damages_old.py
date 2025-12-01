"""
Damages Cabinet API - Кабінет шкоди PRO
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from datetime import datetime
import uuid

from database import get_db as get_oc_db  # OpenCart DB (legacy)
from database_rentalhub import get_rh_db  # RentalHub DB
from models_sqlalchemy import DecorDamage, DecorDamageItem
from sqlalchemy import text

router = APIRouter(prefix="/api/damages", tags=["damages"])


@router.get("/cases")
async def get_damage_cases(
    q: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    source: Optional[str] = None,
    db: Session = Depends(get_rh_db)
):
    """
    ✅ MIGRATED: Отримати список кейсів шкоди з RentalHub DB
    """
    try:
        # ✅ NEW: Query from damages table in RentalHub DB
        sql_parts = ["SELECT * FROM damages WHERE 1=1"]
        params = {}
        
        # Filters
        if q:
            sql_parts.append("""
                AND (
                    id LIKE :search 
                    OR description LIKE :search
                    OR notes LIKE :search
                )
            """)
            params['search'] = f"%{q}%"
        
        if status and status != 'all':
            sql_parts.append("AND resolution_status = :status")
            params['status'] = status
        
        if severity and severity != 'all':
            sql_parts.append("AND severity = :severity")
            params['severity'] = severity
        
        if source and source != 'all':
            sql_parts.append("AND responsible_party = :source")
            params['source'] = source
        
        sql_parts.append("ORDER BY reported_date DESC")
        
        final_sql = " ".join(sql_parts)
        cases = db.execute(text(final_sql), params).fetchall()
        
        # ✅ NEW: Format results from RentalHub damages table
        result = []
        for case in cases:
            # Get product info if needed
            product_info = {}
            if case[2]:  # product_id exists
                prod_query = db.execute(text("""
                    SELECT name, sku FROM products WHERE product_id = :pid
                """), {"pid": case[2]}).fetchone()
                if prod_query:
                    product_info = {'name': prod_query[0], 'sku': prod_query[1]}
            
            result.append({
                'id': case[0],  # id
                'orderId': str(case[1]) if case[1] else None,  # order_id
                'productId': case[2],  # product_id
                'productName': product_info.get('name', 'Unknown'),
                'productSku': product_info.get('sku', ''),
                'damageType': case[3],  # damage_type
                'severity': case[4],  # severity
                'description': case[5],  # description
                'damageCost': float(case[6]) if case[6] else 0,  # damage_cost
                'responsibleParty': case[7],  # responsible_party
                'status': case[8],  # resolution_status
                'reportedBy': case[9],  # reported_by
                'reportedDate': case[10].isoformat() if case[10] else None,  # reported_date
                'photoUrl': case[11],  # photo_url
                'notes': case[12] or '',  # notes
                'createdAt': case[13].isoformat() if case[13] else None,  # created_at
                'totalClaimed': float(case[6]) if case[6] else 0
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка завантаження кейсів: {str(e)}"
        )


@router.get("/cases/{case_id}")
async def get_damage_case(
    case_id: str,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати деталі одного кейсу
    """
    try:
        case = db.query(DecorDamage).filter(DecorDamage.id == case_id).first()
        
        if not case:
            raise HTTPException(status_code=404, detail="Кейс не знайдено")
        
        items = db.query(DecorDamageItem).filter(
            DecorDamageItem.damage_id == case.id
        ).all()
        
        lines = []
        total_claimed = 0
        for item in items:
            line_total = float(item.estimate_value or 0) * (item.qty or 1)
            total_claimed += line_total
            lines.append({
                'id': str(item.id),
                'productName': item.name or '',
                'sku': item.barcode or '',
                'inventoryCode': item.item_ref or '',
                'category': item.category or '',
                'ruleLabel': item.damage_type or '',
                'minAmount': float(item.base_value or 0),
                'qty': item.qty or 1,
                'amountPerUnit': float(item.estimate_value or 0),
                'total': line_total,
                'note': item.comment or '',
                'fromReauditItemId': item.from_reaudit_item_id
            })
        
        return {
            'id': case.id,
            'orderId': case.order_number,
            'source': case.source or 'other',
            'fromReauditItemId': case.from_reaudit_item_id,
            'createdAt': case.created_at.isoformat() if case.created_at else None,
            'createdBy': case.created_by or 'Manager',
            'clientName': case.customer_name or 'Невідомий клієнт',
            'eventName': case.event_name,
            'returnDate': case.return_date.isoformat() if case.return_date else None,
            'severity': case.severity or 'medium',
            'status': case.case_status or 'draft',
            'depositHold': float(case.deposit_available or 0),
            'lines': lines,
            'internalNote': case.notes or '',
            'totalClaimed': total_claimed
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка: {str(e)}"
        )


@router.post("/cases")
async def create_damage_case(
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Створити новий кейс шкоди
    """
    try:
        case_id = f"DC-{uuid.uuid4().hex[:8].upper()}"
        
        new_case = DecorDamage(
            id=case_id,
            order_id=data.get('order_id'),
            order_number=data.get('order_number'),
            customer_id=data.get('customer_id'),
            customer_name=data.get('customer_name', 'Невідомий клієнт'),
            customer_phone=data.get('customer_phone'),
            customer_email=data.get('customer_email'),
            event_name=data.get('event_name'),
            return_date=datetime.fromisoformat(data['return_date']) if data.get('return_date') else None,
            case_status=data.get('status', 'draft'),
            severity=data.get('severity', 'medium'),
            source=data.get('source', 'other'),
            from_reaudit_item_id=data.get('from_reaudit_item_id'),
            deposit_available=data.get('deposit_hold', 0),
            notes=data.get('internal_note', ''),
            created_by=data.get('created_by', 'Реквізитор')
        )
        
        db.add(new_case)
        db.commit()
        
        return {
            'success': True,
            'case_id': case_id,
            'message': 'Кейс створено'
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка створення кейсу: {str(e)}"
        )


@router.put("/cases/{case_id}/status")
async def update_case_status(
    case_id: str,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Оновити статус кейсу
    """
    try:
        case = db.query(DecorDamage).filter(DecorDamage.id == case_id).first()
        
        if not case:
            raise HTTPException(status_code=404, detail="Кейс не знайдено")
        
        case.case_status = data.get('status', case.case_status)
        
        db.commit()
        
        return {
            'success': True,
            'message': 'Статус оновлено'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка: {str(e)}"
        )


@router.post("/cases/{case_id}/lines")
async def add_damage_line(
    case_id: str,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Додати позицію в кейс
    """
    try:
        case = db.query(DecorDamage).filter(DecorDamage.id == case_id).first()
        
        if not case:
            raise HTTPException(status_code=404, detail="Кейс не знайдено")
        
        new_item = DecorDamageItem(
            damage_id=case_id,
            product_id=data.get('product_id'),
            from_reaudit_item_id=data.get('from_reaudit_item_id'),
            barcode=data.get('sku', ''),
            name=data.get('product_name', ''),
            category=data.get('category', 'Реквізит'),
            item_ref=data.get('inventory_code'),
            damage_type=data.get('rule_label', 'Пошкодження'),
            qty=data.get('qty', 1),
            base_value=data.get('min_amount', 0),
            estimate_value=data.get('amount_per_unit', 0),
            comment=data.get('note', '')
        )
        
        db.add(new_item)
        db.commit()
        
        return {
            'success': True,
            'line_id': new_item.id,
            'message': 'Позицію додано'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка: {str(e)}"
        )


@router.put("/cases/{case_id}/lines/{line_id}")
async def update_damage_line(
    case_id: str,
    line_id: str,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Оновити позицію в кейсі
    """
    try:
        item = db.query(DecorDamageItem).filter(
            DecorDamageItem.id == int(line_id),
            DecorDamageItem.damage_id == case_id
        ).first()
        
        if not item:
            raise HTTPException(status_code=404, detail="Позицію не знайдено")
        
        if 'amount_per_unit' in data:
            item.estimate_value = data['amount_per_unit']
        if 'qty' in data:
            item.qty = data['qty']
        if 'note' in data:
            item.comment = data['note']
        
        db.commit()
        
        return {
            'success': True,
            'message': 'Позицію оновлено'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка: {str(e)}"
        )


@router.put("/cases/{case_id}")
async def update_damage_case(
    case_id: str,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Оновити інформацію про кейс
    """
    try:
        case = db.query(DecorDamage).filter(DecorDamage.id == case_id).first()
        
        if not case:
            raise HTTPException(status_code=404, detail="Кейс не знайдено")
        
        if 'internal_note' in data:
            case.notes = data['internal_note']
        if 'severity' in data:
            case.severity = data['severity']
        if 'status' in data:
            case.case_status = data['status']
        
        db.commit()
        
        return {
            'success': True,
            'message': 'Кейс оновлено'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка: {str(e)}"
        )
