"""
Product Damage History API - Історія пошкоджень товарів
Використовується для фіксації пошкоджень до видачі та при поверненні
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import Optional, List
import uuid
import os

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/product-damage-history", tags=["product-damage-history"])

# Міграція таблиці
@router.post("/migrate")
async def migrate_table(db: Session = Depends(get_rh_db)):
    """Створити таблицю product_damage_history"""
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS product_damage_history (
                id VARCHAR(36) PRIMARY KEY,
                product_id INT NOT NULL,
                sku VARCHAR(255),
                product_name VARCHAR(500),
                category VARCHAR(255),
                
                order_id INT,
                order_number VARCHAR(50),
                stage VARCHAR(20) NOT NULL,
                
                damage_type VARCHAR(255) NOT NULL,
                damage_code VARCHAR(100),
                severity VARCHAR(20) DEFAULT 'low',
                fee DECIMAL(10,2) DEFAULT 0.00,
                fee_per_item DECIMAL(10,2) DEFAULT 0.00,
                qty INT DEFAULT 1,
                
                photo_url VARCHAR(500),
                note TEXT,
                
                created_by VARCHAR(255),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                INDEX idx_product_id (product_id),
                INDEX idx_sku (sku),
                INDEX idx_order_id (order_id),
                INDEX idx_stage (stage),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """))
        db.commit()
        return {"success": True, "message": "Таблиця створена успішно"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/migrate-add-qty-fields")
async def migrate_add_qty_fields(db: Session = Depends(get_rh_db)):
    """Додати поля qty та fee_per_item до існуючої таблиці"""
    added_columns = []
    
    # Додати колонку qty якщо не існує
    try:
        db.execute(text("ALTER TABLE product_damage_history ADD COLUMN qty INT DEFAULT 1"))
        db.commit()
        added_columns.append("qty")
    except Exception as e:
        db.rollback()
        if "Duplicate column" not in str(e):
            print(f"Warning adding qty: {e}")
    
    # Додати колонку fee_per_item якщо не існує
    try:
        db.execute(text("ALTER TABLE product_damage_history ADD COLUMN fee_per_item DECIMAL(10,2) DEFAULT 0.00"))
        db.commit()
        added_columns.append("fee_per_item")
    except Exception as e:
        db.rollback()
        if "Duplicate column" not in str(e):
            print(f"Warning adding fee_per_item: {e}")
    
    if added_columns:
        return {"success": True, "message": f"Додано колонки: {', '.join(added_columns)}"}
    else:
        return {"success": True, "message": "Колонки qty та fee_per_item вже існують"}


@router.post("/")
async def create_damage_record(
    damage_data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Створити запис про пошкодження
    
    ЛОГІКА НАРАХУВАННЯ:
    - stage='pre_issue' (при видачі): Тільки фіксація, БЕЗ нарахування клієнту (fee=0)
    - stage='return' (при поверненні): Нарахування клієнту ТІЛЬКИ за НОВУ шкоду
    
    Параметри:
    - product_id: ID товару
    - sku: Артикул товару
    - product_name: Назва товару
    - category: Категорія товару
    - order_id: ID замовлення (опціонально)
    - order_number: Номер замовлення (опціонально)
    - stage: 'pre_issue' або 'return'
    - damage_type: Тип пошкодження
    - damage_code: Код типу пошкодження
    - severity: 'low', 'medium', 'high', 'critical'
    - fee: Загальна сума збитку (для return stage)
    - fee_per_item: Сума за одиницю (опціонально)
    - qty: Кількість пошкоджених одиниць (за замовчуванням 1)
    - photo_url: URL фото (опціонально)
    - note: Примітка (опціонально)
    - created_by: Хто зафіксував (опціонально)
    - processing_type: 'none', 'wash', 'restoration', 'laundry'
    """
    try:
        damage_id = str(uuid.uuid4())
        processing_type = damage_data.get("processing_type", "none")
        stage = damage_data.get("stage", "return")
        order_id = damage_data.get("order_id")
        product_id = damage_data.get("product_id")
        damage_type = damage_data.get("damage_type")
        
        # Отримуємо qty та fee_per_item
        qty = damage_data.get("qty", 1)
        fee_per_item_input = damage_data.get("fee_per_item", damage_data.get("fee", 0.0))
        fee_input = damage_data.get("fee", fee_per_item_input * qty)
        
        # ЛОГІКА НАРАХУВАННЯ
        if stage == "pre_issue":
            # При видачі - тільки фіксація, БЕЗ нарахування
            fee = 0.0
            fee_per_item = 0.0
            charge_note = "Існуюча шкода (до видачі) - не нараховується клієнту"
        else:
            # При поверненні - перевіряємо чи вже була така шкода на видачі
            existing_damage = None
            if order_id and product_id:
                result = db.execute(text("""
                    SELECT id, damage_type, note, photo_url 
                    FROM product_damage_history 
                    WHERE order_id = :order_id 
                    AND product_id = :product_id 
                    AND stage = 'pre_issue'
                    AND damage_type = :damage_type
                    LIMIT 1
                """), {
                    "order_id": order_id,
                    "product_id": product_id,
                    "damage_type": damage_type
                })
                existing_damage = result.fetchone()
            
            if existing_damage:
                # Така шкода вже була зафіксована при видачі - НЕ нараховуємо
                fee = 0.0
                fee_per_item = 0.0
                charge_note = f"Шкода вже була при видачі (ID: {existing_damage[0]}) - не нараховується"
            else:
                # Нова шкода - нараховуємо клієнту
                fee = fee_input
                fee_per_item = fee_per_item_input
                charge_note = "Нова шкода при поверненні - нараховано клієнту"
        
        db.execute(text("""
            INSERT INTO product_damage_history (
                id, product_id, sku, product_name, category,
                order_id, order_number, stage,
                damage_type, damage_code, severity, fee,
                fee_per_item, qty,
                photo_url, note, created_by, created_at,
                processing_type, processing_status
            ) VALUES (
                :id, :product_id, :sku, :product_name, :category,
                :order_id, :order_number, :stage,
                :damage_type, :damage_code, :severity, :fee,
                :fee_per_item, :qty,
                :photo_url, :note, :created_by, NOW(),
                :processing_type, :processing_status
            )
        """), {
            "id": damage_id,
            "product_id": product_id,
            "sku": damage_data.get("sku"),
            "product_name": damage_data.get("product_name"),
            "category": damage_data.get("category"),
            "order_id": order_id,
            "order_number": damage_data.get("order_number"),
            "stage": stage,
            "damage_type": damage_type,
            "damage_code": damage_data.get("damage_code"),
            "severity": damage_data.get("severity", "low"),
            "fee": fee,
            "fee_per_item": fee_per_item,
            "qty": qty,
            "photo_url": damage_data.get("photo_url"),
            "note": damage_data.get("note"),
            "created_by": damage_data.get("created_by", "system"),
            "processing_type": processing_type,
            "processing_status": "pending" if processing_type != "none" else "completed"
        })
        
        db.commit()
        
        return {
            "success": True,
            "message": charge_note,
            "damage_id": damage_id,
            "stage": stage,
            "qty": qty,
            "fee": fee,
            "fee_per_item": fee_per_item,
            "charged_to_client": fee > 0
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка запису: {str(e)}")


@router.get("/product/{product_id}")
async def get_product_damage_history(
    product_id: int,
    db: Session = Depends(get_rh_db)
):
    """Отримати історію пошкоджень для товару"""
    try:
        result = db.execute(text("""
            SELECT 
                id, product_id, sku, product_name, category,
                order_id, order_number, stage,
                damage_type, damage_code, severity, fee,
                photo_url, note, created_by, created_at,
                qty, fee_per_item
            FROM product_damage_history
            WHERE product_id = :product_id
            ORDER BY created_at DESC
        """), {"product_id": product_id})
        
        history = []
        for row in result:
            qty = row[16] if len(row) > 16 and row[16] else 1
            fee_per_item = float(row[17]) if len(row) > 17 and row[17] else float(row[11]) if row[11] else 0.0
            
            history.append({
                "id": row[0],
                "product_id": row[1],
                "sku": row[2],
                "product_name": row[3],
                "category": row[4],
                "order_id": row[5],
                "order_number": row[6],
                "stage": row[7],
                "stage_label": "До видачі" if row[7] == "pre_issue" else "При поверненні",
                "damage_type": row[8],
                "damage_code": row[9],
                "severity": row[10],
                "fee": float(row[11]) if row[11] else 0.0,
                "qty": qty,
                "fee_per_item": fee_per_item,
                "photo_url": row[12],
                "note": row[13],
                "created_by": row[14],
                "created_at": row[15].isoformat() if row[15] else None
            })
        
        return {
            "product_id": product_id,
            "total_damages": len(history),
            "total_fees": sum(d["fee"] for d in history),
            "history": history
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка читання: {str(e)}")


@router.get("/order/{order_id}")
async def get_order_damage_history(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """Отримати всі пошкодження по замовленню"""
    try:
        result = db.execute(text("""
            SELECT 
                id, product_id, sku, product_name, category,
                order_id, order_number, stage,
                damage_type, damage_code, severity, fee,
                photo_url, note, created_by, created_at,
                processing_type, processing_status, sent_to_processing_at
            FROM product_damage_history
            WHERE order_id = :order_id
            ORDER BY created_at DESC
        """), {"order_id": order_id})
        
        history = []
        for row in result:
            history.append({
                "id": row[0],
                "product_id": row[1],
                "sku": row[2],
                "product_name": row[3],
                "category": row[4],
                "order_id": row[5],
                "order_number": row[6],
                "stage": row[7],
                "stage_label": "До видачі (не нараховано)" if row[7] == "pre_issue" else "При поверненні",
                "damage_type": row[8],
                "damage_code": row[9],
                "severity": row[10],
                "fee": float(row[11]) if row[11] else 0.0,
                "charged_to_client": float(row[11]) > 0 if row[11] else False,
                "photo_url": row[12],
                "note": row[13],
                "created_by": row[14],
                "discovered_by": row[14],  # Хто виявив
                "created_at": row[15].isoformat() if row[15] else None,
                "processing_type": row[16],
                "processing_status": row[17],
                "sent_to_processing_at": row[18].isoformat() if row[18] else None
            })
        
        return {
            "order_id": order_id,
            "total_damages": len(history),
            "total_fees": sum(d["fee"] for d in history),
            "history": history
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка читання: {str(e)}")


@router.get("/sku/{sku}")
async def get_sku_damage_history(
    sku: str,
    db: Session = Depends(get_rh_db)
):
    """Отримати історію пошкоджень за SKU"""
    try:
        result = db.execute(text("""
            SELECT 
                id, product_id, sku, product_name, category,
                order_id, order_number, stage,
                damage_type, damage_code, severity, fee,
                photo_url, note, created_by, created_at
            FROM product_damage_history
            WHERE sku = :sku
            ORDER BY created_at DESC
        """), {"sku": sku})
        
        history = []
        for row in result:
            history.append({
                "id": row[0],
                "product_id": row[1],
                "sku": row[2],
                "product_name": row[3],
                "category": row[4],
                "order_id": row[5],
                "order_number": row[6],
                "stage": row[7],
                "stage_label": "До видачі" if row[7] == "pre_issue" else "При поверненні",
                "damage_type": row[8],
                "damage_code": row[9],
                "severity": row[10],
                "fee": float(row[11]) if row[11] else 0.0,
                "photo_url": row[12],
                "note": row[13],
                "created_by": row[14],
                "created_at": row[15].isoformat() if row[15] else None
            })
        
        return {
            "sku": sku,
            "total_damages": len(history),
            "total_fees": sum(d["fee"] for d in history),
            "history": history
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка читання: {str(e)}")


@router.get("/order/{order_id}/pre-issue")
async def get_pre_issue_damages(
    order_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати шкоду зафіксовану при видачі для порівняння при поверненні
    Використовується для визначення чи шкода вже була
    """
    try:
        result = db.execute(text("""
            SELECT 
                id, product_id, sku, product_name, 
                damage_type, damage_code, severity,
                photo_url, note, created_at
            FROM product_damage_history
            WHERE order_id = :order_id AND stage = 'pre_issue'
            ORDER BY product_id, created_at
        """), {"order_id": order_id})
        
        damages = []
        for row in result:
            damages.append({
                "id": row[0],
                "product_id": row[1],
                "sku": row[2],
                "product_name": row[3],
                "damage_type": row[4],
                "damage_code": row[5],
                "severity": row[6],
                "photo_url": row[7],
                "note": row[8],
                "created_at": row[9].isoformat() if row[9] else None
            })
        
        return {
            "order_id": order_id,
            "pre_issue_damages": damages,
            "count": len(damages),
            "message": "Шкода зафіксована при видачі (не нараховується клієнту)"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка читання: {str(e)}")





@router.get("/recent")
async def get_recent_damages(
    limit: int = 50,
    db: Session = Depends(get_rh_db)
):
    """Отримати недавні пошкодження для календаря"""
    try:
        result = db.execute(text("""
            SELECT 
                pdh.id, pdh.product_id, pdh.sku, pdh.product_name, pdh.category,
                pdh.order_id, pdh.order_number, pdh.stage,
                pdh.damage_type, pdh.damage_code, pdh.severity, pdh.fee,
                pdh.photo_url, pdh.note, pdh.created_by, pdh.created_at,
                p.image_url as product_image
            FROM product_damage_history pdh
            LEFT JOIN products p ON p.sku COLLATE utf8mb4_unicode_ci = pdh.sku COLLATE utf8mb4_unicode_ci
            WHERE pdh.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            ORDER BY pdh.created_at DESC
            LIMIT :limit
        """), {"limit": limit})
        
        damages = []
        for row in result:
            damages.append({
                "id": row[0],
                "product_id": row[1],
                "sku": row[2],
                "product_name": row[3],
                "category": row[4],
                "order_id": row[5],
                "order_number": row[6],
                "stage": row[7],
                "damage_type": row[8],
                "damage_code": row[9],
                "severity": row[10],
                "fee": float(row[11]) if row[11] else 0.0,
                "photo_url": row[12],  # Фото пошкодження
                "note": row[13],
                "created_by": row[14],
                "created_at": row[15].isoformat() if row[15] else None,
                "product_image": row[16]  # Фото товару з products
            })
        
        return damages
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка читання: {str(e)}")



# ==================== НОВІ ENDPOINTS ДЛЯ ОБРОБКИ ====================

@router.get("/dashboard/overview")
async def get_damage_dashboard(db: Session = Depends(get_rh_db)):
    """
    Отримати загальний огляд Кабінету Шкоди
    Повертає статистику по всіх вкладках
    """
    try:
        # Отримати статистику по обробці
        result = db.execute(text("""
            SELECT 
                processing_type,
                processing_status,
                COUNT(*) as count,
                SUM(fee) as total_fee
            FROM product_damage_history
            WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY processing_type, processing_status
        """))
        
        stats = {}
        for row in result:
            proc_type = row[0] or 'none'
            proc_status = row[1] or 'pending'
            if proc_type not in stats:
                stats[proc_type] = {}
            stats[proc_type][proc_status] = {
                'count': row[2],
                'total_fee': float(row[3]) if row[3] else 0.0
            }
        
        return {
            "stats": stats,
            "period": "last_30_days"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.get("/cases/grouped")
async def get_damage_cases_grouped(db: Session = Depends(get_rh_db)):
    """
    Отримати damage cases згруповані по замовленнях (для головної вкладки)
    Показує всі пошкодження згруповані по order_id з інформацією про оплату
    """
    try:
        result = db.execute(text("""
            SELECT 
                pdh.order_id,
                pdh.order_number,
                COUNT(*) as items_count,
                SUM(pdh.fee) as total_fee,
                MAX(pdh.created_at) as latest_damage,
                GROUP_CONCAT(DISTINCT pdh.processing_type) as processing_types,
                MIN(pdh.created_at) as first_damage,
                o.customer_name,
                o.customer_phone,
                o.status as order_status,
                COALESCE((SELECT SUM(amount) FROM fin_payments WHERE order_id = pdh.order_id AND payment_type = 'damage'), 0) as damage_paid,
                SUM(CASE WHEN pdh.processing_type IS NULL OR pdh.processing_type = '' THEN 1 ELSE 0 END) as pending_assignment,
                SUM(CASE WHEN pdh.processing_status = 'completed' THEN 1 ELSE 0 END) as completed_count
            FROM product_damage_history pdh
            LEFT JOIN orders o ON o.order_id = pdh.order_id
            WHERE pdh.order_id IS NOT NULL
            GROUP BY pdh.order_id, pdh.order_number, o.customer_name, o.customer_phone, o.status
            ORDER BY latest_damage DESC
        """))
        
        cases = []
        for row in result:
            total_fee = float(row[3]) if row[3] else 0.0
            damage_paid = float(row[10]) if row[10] else 0.0
            damage_due = max(0, total_fee - damage_paid)
            
            cases.append({
                "order_id": row[0],
                "order_number": row[1],
                "items_count": row[2],
                "total_fee": total_fee,
                "damage_paid": damage_paid,
                "damage_due": damage_due,
                "is_paid": damage_due <= 0,
                "latest_damage": row[4].isoformat() if row[4] else None,
                "processing_types": row[5].split(',') if row[5] else [],
                "first_damage": row[6].isoformat() if row[6] else None,
                "customer_name": row[7],
                "customer_phone": row[8],
                "order_status": row[9],
                "pending_assignment": row[11] or 0,
                "completed_count": row[12] or 0
            })
        
        return {"cases": cases, "total": len(cases)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.get("/cases/{order_id}/details")
async def get_damage_case_details(order_id: int, db: Session = Depends(get_rh_db)):
    """
    Отримати детальну інформацію по damage case (всі товари з замовлення)
    """
    try:
        result = db.execute(text("""
            SELECT 
                pdh.id, pdh.product_id, pdh.sku, pdh.product_name, pdh.category,
                pdh.order_id, pdh.order_number, pdh.stage,
                pdh.damage_type, pdh.damage_code, pdh.severity, pdh.fee,
                pdh.photo_url, pdh.note, pdh.created_by, pdh.created_at,
                pdh.processing_type, pdh.processing_status,
                pdh.sent_to_processing_at, pdh.returned_from_processing_at,
                pdh.processing_notes, pdh.laundry_batch_id, pdh.laundry_item_id
            FROM product_damage_history pdh
            WHERE pdh.order_id = :order_id
            ORDER BY pdh.created_at DESC
        """), {"order_id": order_id})
        
        items = []
        for row in result:
            items.append({
                "id": row[0],
                "product_id": row[1],
                "sku": row[2],
                "product_name": row[3],
                "category": row[4],
                "order_id": row[5],
                "order_number": row[6],
                "stage": row[7],
                "damage_type": row[8],
                "damage_code": row[9],
                "severity": row[10],
                "fee": float(row[11]) if row[11] else 0.0,
                "photo_url": row[12],
                "note": row[13],
                "created_by": row[14],
                "created_at": row[15].isoformat() if row[15] else None,
                "processing_type": row[16],
                "processing_status": row[17],
                "sent_to_processing_at": row[18].isoformat() if row[18] else None,
                "returned_from_processing_at": row[19].isoformat() if row[19] else None,
                "processing_notes": row[20],
                "laundry_batch_id": row[21],
                "laundry_item_id": row[22]
            })
        
        return {
            "order_id": order_id,
            "items": items,
            "total_items": len(items),
            "total_fee": sum(item["fee"] for item in items)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.get("/processing/wash")
async def get_wash_queue(db: Session = Depends(get_rh_db)):
    """Отримати всі товари в черзі на мийку"""
    try:
        result = db.execute(text("""
            SELECT 
                pdh.id, pdh.product_id, pdh.sku, pdh.product_name, pdh.category,
                pdh.order_id, pdh.order_number,
                pdh.damage_type, pdh.severity, pdh.fee,
                pdh.photo_url, pdh.note,
                pdh.processing_status, pdh.sent_to_processing_at,
                pdh.returned_from_processing_at, pdh.processing_notes,
                pdh.created_at, pdh.created_by
            FROM product_damage_history pdh
            WHERE pdh.processing_type = 'wash'
            ORDER BY pdh.sent_to_processing_at DESC, pdh.created_at DESC
        """))
        
        items = []
        for row in result:
            items.append({
                "id": row[0],
                "product_id": row[1],
                "sku": row[2],
                "product_name": row[3],
                "category": row[4],
                "order_id": row[5],
                "order_number": row[6],
                "damage_type": row[7],
                "severity": row[8],
                "fee": float(row[9]) if row[9] else 0.0,
                "photo_url": row[10],
                "note": row[11],
                "processing_status": row[12],
                "sent_to_processing_at": row[13].isoformat() if row[13] else None,
                "returned_from_processing_at": row[14].isoformat() if row[14] else None,
                "processing_notes": row[15],
                "created_at": row[16].isoformat() if row[16] else None,
                "created_by": row[17]
            })
        
        return {"items": items, "total": len(items)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.get("/processing/restoration")
async def get_restoration_queue(db: Session = Depends(get_rh_db)):
    """Отримати всі товари в черзі на реставрацію"""
    try:
        result = db.execute(text("""
            SELECT 
                pdh.id, pdh.product_id, pdh.sku, pdh.product_name, pdh.category,
                pdh.order_id, pdh.order_number,
                pdh.damage_type, pdh.severity, pdh.fee,
                pdh.photo_url, pdh.note,
                pdh.processing_status, pdh.sent_to_processing_at,
                pdh.returned_from_processing_at, pdh.processing_notes,
                pdh.created_at, pdh.created_by
            FROM product_damage_history pdh
            WHERE pdh.processing_type = 'restoration'
            ORDER BY pdh.sent_to_processing_at DESC, pdh.created_at DESC
        """))
        
        items = []
        for row in result:
            items.append({
                "id": row[0],
                "product_id": row[1],
                "sku": row[2],
                "product_name": row[3],
                "category": row[4],
                "order_id": row[5],
                "order_number": row[6],
                "damage_type": row[7],
                "severity": row[8],
                "fee": float(row[9]) if row[9] else 0.0,
                "photo_url": row[10],
                "note": row[11],
                "processing_status": row[12],
                "sent_to_processing_at": row[13].isoformat() if row[13] else None,
                "returned_from_processing_at": row[14].isoformat() if row[14] else None,
                "processing_notes": row[15],
                "created_at": row[16].isoformat() if row[16] else None,
                "created_by": row[17]
            })
        
        return {"items": items, "total": len(items)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.get("/processing/laundry")
async def get_laundry_queue(db: Session = Depends(get_rh_db)):
    """Отримати всі товари в черзі на хімчистку"""
    try:
        result = db.execute(text("""
            SELECT 
                pdh.id, pdh.product_id, pdh.sku, pdh.product_name, pdh.category,
                pdh.order_id, pdh.order_number,
                pdh.damage_type, pdh.severity, pdh.fee,
                pdh.photo_url, pdh.note,
                pdh.processing_status, pdh.sent_to_processing_at,
                pdh.returned_from_processing_at, pdh.processing_notes,
                pdh.laundry_batch_id, pdh.laundry_item_id,
                pdh.created_at, pdh.created_by,
                lb.laundry_company, lb.status as batch_status
            FROM product_damage_history pdh
            LEFT JOIN laundry_batches lb ON pdh.laundry_batch_id = lb.id
            WHERE pdh.processing_type = 'laundry'
            ORDER BY pdh.sent_to_processing_at DESC, pdh.created_at DESC
        """))
        
        items = []
        for row in result:
            items.append({
                "id": row[0],
                "product_id": row[1],
                "sku": row[2],
                "product_name": row[3],
                "category": row[4],
                "order_id": row[5],
                "order_number": row[6],
                "damage_type": row[7],
                "severity": row[8],
                "fee": float(row[9]) if row[9] else 0.0,
                "photo_url": row[10],
                "note": row[11],
                "processing_status": row[12],
                "sent_to_processing_at": row[13].isoformat() if row[13] else None,
                "returned_from_processing_at": row[14].isoformat() if row[14] else None,
                "processing_notes": row[15],
                "laundry_batch_id": row[16],
                "laundry_item_id": row[17],
                "created_at": row[18].isoformat() if row[18] else None,
                "created_by": row[19],
                "laundry_company": row[20],
                "batch_status": row[21]
            })
        
        return {"items": items, "total": len(items)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.post("/{damage_id}/send-to-wash")
async def send_to_wash(damage_id: str, data: dict, db: Session = Depends(get_rh_db)):
    """Відправити товар на мийку"""
    try:
        # Перевірка чи товар вже відправлений на обробку
        existing = db.execute(text("""
            SELECT processing_type FROM product_damage_history WHERE id = :damage_id
        """), {"damage_id": damage_id}).fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail="Запис не знайдено")
        
        if existing[0] and existing[0] != 'none':
            raise HTTPException(status_code=400, detail=f"Товар вже відправлено на {existing[0]}")
        
        db.execute(text("""
            UPDATE product_damage_history
            SET processing_type = 'wash',
                processing_status = 'in_progress',
                sent_to_processing_at = NOW(),
                processing_notes = :notes
            WHERE id = :damage_id
        """), {
            "damage_id": damage_id,
            "notes": data.get("notes", "Відправлено на мийку")
        })
        
        db.commit()
        return {"success": True, "message": "Товар відправлено на мийку"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.post("/{damage_id}/send-to-restoration")
async def send_to_restoration(damage_id: str, data: dict, db: Session = Depends(get_rh_db)):
    """Відправити товар в реставрацію"""
    try:
        # Перевірка чи товар вже відправлений на обробку
        existing = db.execute(text("""
            SELECT processing_type FROM product_damage_history WHERE id = :damage_id
        """), {"damage_id": damage_id}).fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail="Запис не знайдено")
        
        if existing[0] and existing[0] != 'none':
            raise HTTPException(status_code=400, detail=f"Товар вже відправлено на {existing[0]}")
        
        db.execute(text("""
            UPDATE product_damage_history
            SET processing_type = 'restoration',
                processing_status = 'in_progress',
                sent_to_processing_at = NOW(),
                processing_notes = :notes
            WHERE id = :damage_id
        """), {
            "damage_id": damage_id,
            "notes": data.get("notes", "Відправлено в реставрацію")
        })
        
        db.commit()
        return {"success": True, "message": "Товар відправлено в реставрацію"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.post("/{damage_id}/send-to-laundry")
async def send_to_laundry(damage_id: str, data: dict, db: Session = Depends(get_rh_db)):
    """
    Відправити товар в хімчистку
    Створює новий batch або додає до існуючого
    """
    try:
        # Отримати інформацію про товар
        damage_info = db.execute(text("""
            SELECT product_id, sku, product_name, category, order_id, order_number, processing_type
            FROM product_damage_history
            WHERE id = :damage_id
        """), {"damage_id": damage_id}).fetchone()
        
        if not damage_info:
            raise HTTPException(status_code=404, detail="Damage record not found")
        
        # Перевірка чи товар вже відправлений на обробку
        if damage_info[6] and damage_info[6] != 'none':
            raise HTTPException(status_code=400, detail=f"Товар вже відправлено на {damage_info[6]}")
        
        laundry_company = data.get("laundry_company", "Хімчистка №1")
        expected_return_date = data.get("expected_return_date")
        notes = data.get("notes", "")
        
        # Створити новий batch якщо не вказано існуючий
        batch_id = data.get("batch_id")
        if not batch_id:
            batch_id = f"BATCH-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
            db.execute(text("""
                INSERT INTO laundry_batches (
                    id, laundry_company, status, sent_date, expected_return_date,
                    notes, created_at, updated_at
                ) VALUES (
                    :id, :company, 'sent', NOW(), :return_date,
                    :notes, NOW(), NOW()
                )
            """), {
                "id": batch_id,
                "company": laundry_company,
                "return_date": expected_return_date,
                "notes": notes
            })
        
        # Створити laundry_item (без order_id - такої колонки немає)
        item_id = f"ITEM-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        db.execute(text("""
            INSERT INTO laundry_items (
                id, batch_id, product_id, sku, product_name, category,
                quantity, returned_quantity, condition_before, notes,
                created_at
            ) VALUES (
                :id, :batch_id, :product_id, :sku, :product_name, :category,
                1, 0, 'damaged', :notes,
                NOW()
            )
        """), {
            "id": item_id,
            "batch_id": batch_id,
            "product_id": damage_info[0],
            "sku": damage_info[1],
            "product_name": damage_info[2],
            "category": damage_info[3],
            "notes": f"Від ордера {damage_info[5] or ''}"
        })
        
        # Оновити damage record
        db.execute(text("""
            UPDATE product_damage_history
            SET processing_type = 'laundry',
                processing_status = 'in_progress',
                sent_to_processing_at = NOW(),
                processing_notes = :notes,
                laundry_batch_id = :batch_id,
                laundry_item_id = :item_id
            WHERE id = :damage_id
        """), {
            "damage_id": damage_id,
            "notes": f"Відправлено в {laundry_company}",
            "batch_id": batch_id,
            "item_id": item_id
        })
        
        db.commit()
        return {
            "success": True,
            "message": "Товар відправлено в хімчистку",
            "batch_id": batch_id,
            "item_id": item_id
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.post("/{damage_id}/complete-processing")
async def complete_processing(damage_id: str, data: dict, db: Session = Depends(get_rh_db)):
    """Позначити обробку як завершену (повернуто на склад)"""
    try:
        db.execute(text("""
            UPDATE product_damage_history
            SET processing_status = 'completed',
                returned_from_processing_at = NOW(),
                processing_notes = CONCAT(
                    COALESCE(processing_notes, ''), 
                    '\n', 
                    :notes
                )
            WHERE id = :damage_id
        """), {
            "damage_id": damage_id,
            "notes": data.get("notes", "Повернуто на склад")
        })
        
        db.commit()
        return {"success": True, "message": "Обробку завершено"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")


@router.post("/{damage_id}/mark-failed")
async def mark_processing_failed(damage_id: str, data: dict, db: Session = Depends(get_rh_db)):
    """Позначити обробку як невдалу (не вдалося відремонтувати/відчистити)"""
    try:
        db.execute(text("""
            UPDATE product_damage_history
            SET processing_status = 'failed',
                returned_from_processing_at = NOW(),
                processing_notes = CONCAT(
                    COALESCE(processing_notes, ''), 
                    '\n[FAILED] ', 
                    :notes
                )
            WHERE id = :damage_id
        """), {
            "damage_id": damage_id,
            "notes": data.get("notes", "Обробка невдала")
        })
        
        db.commit()
        return {"success": True, "message": "Позначено як невдалу обробку"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Помилка: {str(e)}")

