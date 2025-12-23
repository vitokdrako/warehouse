"""
Extended Catalog API - Розширений каталог для реквізиторів
Includes: product passport, inventory items, history, advanced search
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime
import uuid
import json

from database import get_db
from models_sqlalchemy import (
    OpenCartProduct,
    OpenCartProductDescription,
    OpenCartCategory,
    OpenCartCategoryDescription,
    DecorProductExtended,
    DecorInventoryItem,
    DecorProductHistory,
    DecorProductCatalog
)

router = APIRouter(prefix="/api/catalog/extended", tags=["extended-catalog"])


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def calculate_status_summary(inventory_items: List):
    """Розрахувати статистику по статусам"""
    summary = {
        'total': len(inventory_items),
        'available': 0,
        'reserved': 0,
        'on_rent': 0,
        'washing': 0,
        'repair': 0,
        'lost': 0
    }
    
    for item in inventory_items:
        status = item.get('status', 'available')
        if status in summary:
            summary[status] += 1
    
    return summary


# ============================================================
# API ENDPOINTS
# ============================================================

@router.get("/search")
async def search_extended_catalog(
    q: Optional[str] = None,  # Загальний пошук
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    color: Optional[str] = None,
    material: Optional[str] = None,
    size: Optional[str] = None,
    tags: Optional[str] = None,  # comma-separated
    status: Optional[str] = None,  # available, reserved, etc.
    min_available: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Гнучкий пошук по каталогу
    Підтримує фільтри по всіх атрибутах (з OpenCart + decor_)
    """
    try:
        from sqlalchemy import text
        
        # Якщо є фільтр по кольору або матеріалу, використовуємо складний запит з атрибутами
        if color or material:
            # SQL запит який об'єднує OpenCart атрибути з decor_ таблицями
            params = {
                "language_id": 4,
                "color_attr_id": 13,  # ID атрибута "Колір" 
                "material_attr_id": 16  # ID атрибута "Матеріал"
            }
            
            # Базовий запит
            sql_parts = ["""
                SELECT DISTINCT
                    p.product_id,
                    p.model,
                    p.sku,
                    p.quantity,
                    p.status,
                    pd.name,
                    pe.subcategory,
                    pe.size,
                    pc.location_zone,
                    pc.location_aisle,
                    pc.location_shelf,
                    color_attr.text as color,
                    material_attr.text as material
                FROM oc_product p
                INNER JOIN oc_product_description pd 
                    ON p.product_id = pd.product_id AND pd.language_id = :language_id
                LEFT JOIN decor_product_extended pe 
                    ON p.product_id = pe.product_id
                LEFT JOIN decor_product_catalog pc 
                    ON p.product_id = pc.product_id
                LEFT JOIN oc_product_attribute color_attr 
                    ON p.product_id = color_attr.product_id 
                    AND color_attr.attribute_id = :color_attr_id 
                    AND color_attr.language_id = :language_id
                LEFT JOIN oc_product_attribute material_attr 
                    ON p.product_id = material_attr.product_id 
                    AND material_attr.attribute_id = :material_attr_id
                    AND material_attr.language_id = :language_id
                WHERE p.status = 1
            """]
            
            # Загальний пошук
            if q:
                sql_parts.append("AND (p.model LIKE :q OR pd.name LIKE :q OR p.sku LIKE :q)")
                params["q"] = f"%{q}%"
            
            # Фільтр по категорії
            if subcategory:
                sql_parts.append("AND pe.subcategory = :subcategory")
                params["subcategory"] = subcategory
            
            # Фільтр по кольору
            if color:
                sql_parts.append("AND color_attr.text LIKE :color")
                params["color"] = f"%{color}%"
            
            # Фільтр по матеріалу
            if material:
                sql_parts.append("AND material_attr.text LIKE :material")
                params["material"] = f"%{material}%"
            
            # Фільтр по розміру
            if size:
                sql_parts.append("AND pe.size LIKE :size")
                params["size"] = f"%{size}%"
            
            sql_parts.append("LIMIT :limit")
            params["limit"] = limit
            
            sql = " ".join(sql_parts)
            result = db.execute(text(sql), params)
            products_data = result.fetchall()
            
        else:
            # Простий запит без атрибутів (швидший)
            query = db.query(
                OpenCartProduct,
                OpenCartProductDescription,
                DecorProductExtended,
                DecorProductCatalog
            ).join(
                OpenCartProductDescription,
                OpenCartProduct.product_id == OpenCartProductDescription.product_id
            ).outerjoin(
                DecorProductExtended,
                OpenCartProduct.product_id == DecorProductExtended.product_id
            ).outerjoin(
                DecorProductCatalog,
                OpenCartProduct.product_id == DecorProductCatalog.product_id
            ).filter(
                OpenCartProduct.status == 1,
                OpenCartProductDescription.language_id == 4
            )
            
            # Загальний пошук
            if q:
                search_pattern = f"%{q}%"
                query = query.filter(
                    or_(
                        OpenCartProduct.model.like(search_pattern),
                        OpenCartProductDescription.name.like(search_pattern),
                        OpenCartProduct.sku.like(search_pattern)
                    )
                )
            
            # Фільтри
            if subcategory:
                query = query.filter(DecorProductExtended.subcategory == subcategory)
            
            if size:
                query = query.filter(DecorProductExtended.size.like(f"%{size}%"))
            
            products_data = query.limit(limit).all()
        
        # Формування результату
        results = []
        
        # Обробка результатів залежно від типу запиту
        if color or material:
            # Результати з SQL запиту (tuple)
            for row in products_data:
                product_id = row[0]
                model = row[1]
                sku = row[2]
                quantity = row[3]
                name = row[5]
                subcategory = row[6]
                size_val = row[7]
                zone = row[8]
                aisle = row[9]
                shelf = row[10]
                color_val = row[11]
                material_val = row[12]
                
                # Location
                location_parts = []
                if zone: location_parts.append(f"Зона {zone}")
                if aisle: location_parts.append(f"Стелаж {aisle}")
                if shelf: location_parts.append(f"Полиця {shelf}")
                default_location = " · ".join(location_parts) if location_parts else "Склад"
                
                # Status summary
                total_qty = int(quantity) if quantity else 0
                if min_available and total_qty < min_available:
                    continue
                
                status_summary = {
                    'total': total_qty,
                    'available': total_qty,
                    'reserved': 0,
                    'on_rent': 0,
                    'washing': 0,
                    'repair': 0,
                    'lost': 0
                }
                
                results.append({
                    'product_id': product_id,
                    'code': model,
                    'sku': sku,
                    'name': name,
                    'category': subcategory or 'Загальне',
                    'subcategory': subcategory,
                    'color': color_val,
                    'material': material_val,
                    'size': size_val,
                    'tags': [],
                    'quantity_total': total_qty,
                    'status_summary': status_summary,
                    'default_location': default_location,
                    'inventory_items': []
                })
        else:
            # Результати з ORM запиту
            for oc_prod, oc_desc, extended, catalog in products_data:
                # Отримати атрибути з OpenCart
                color_attr = db.execute(text("""
                    SELECT text FROM oc_product_attribute 
                    WHERE product_id = :pid AND attribute_id = 13 AND language_id = 4
                """), {"pid": oc_prod.product_id}).fetchone()
                
                material_attr = db.execute(text("""
                    SELECT text FROM oc_product_attribute 
                    WHERE product_id = :pid AND attribute_id = 16 AND language_id = 4
                """), {"pid": oc_prod.product_id}).fetchone()
                
                color_val = color_attr[0] if color_attr else None
                material_val = material_attr[0] if material_attr else None
                
                # Status summary (з реальної кількості в oc_product)
                total_qty = int(oc_prod.quantity) if oc_prod.quantity else 0
                status_summary = {
                    'total': total_qty,
                    'available': total_qty,  # Simplified
                    'reserved': 0,
                    'on_rent': 0,
                    'washing': 0,
                    'repair': 0,
                    'lost': 0
                }
                
                # Skip if min_available filter
                if min_available and status_summary['available'] < min_available:
                    continue
                
                # Location
                default_location = "Склад"
                if catalog:
                    parts = []
                    if catalog.location_zone: parts.append(f"Зона {catalog.location_zone}")
                    if catalog.location_aisle: parts.append(f"Стелаж {catalog.location_aisle}")
                    if catalog.location_shelf: parts.append(f"Полиця {catalog.location_shelf}")
                    default_location = " · ".join(parts) if parts else "Склад"
                
                # Extended attributes
                ext_attrs = {
                    'subcategory': extended.subcategory if extended else None,
                    'color': color_val,  # З OpenCart атрибутів
                    'material': material_val,  # З OpenCart атрибутів
                    'size': extended.size if extended else None,
                    'tags': extended.tags if extended and extended.tags else [],
                    'care_notes': extended.care_notes if extended else None
                }
                
                results.append({
                    'id': f"P-{oc_prod.product_id}",
                    'product_id': oc_prod.product_id,
                    'name': oc_desc.name,
                    'mainSku': oc_prod.model,
                    'skuPrefix': oc_prod.model.split('-')[0] if '-' in oc_prod.model else oc_prod.model,
                    'category': category or 'Загальне',
                    'subcategory': ext_attrs.get('subcategory'),
                    'color': ext_attrs.get('color'),
                    'material': ext_attrs.get('material'),
                    'size': ext_attrs.get('size'),
                    'imageUrl': f"https://farforrent.com.ua/image/{oc_prod.image}" if oc_prod.image else None,
                    'defaultLocation': default_location,
                    'tags': ext_attrs.get('tags', []),
                    'description': oc_desc.description or '',
                    'careNotes': ext_attrs.get('care_notes', ''),
                    'createdAt': oc_prod.date_added.isoformat() if oc_prod.date_added else None,
                    'updatedAt': oc_prod.date_modified.isoformat() if oc_prod.date_modified else None,
                    'statusSummary': status_summary,
                    'price': float(oc_prod.price) if oc_prod.price else 0,
                    'ean': oc_prod.ean
                })
        
        return {
            'total': len(results),
            'items': results
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка пошуку: {str(e)}"
        )


@router.get("/product/{product_id}")
async def get_product_details(
    product_id: int,
    db: Session = Depends(get_db)
):
    """
    Повна інформація про товар:
    - Паспорт товару
    - Інвентарні одиниці
    - Історія руху
    """
    try:
        # Основна інформація
        product = db.query(OpenCartProduct).filter(
            OpenCartProduct.product_id == product_id
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail="Товар не знайдено")
        
        # Опис
        description = db.query(OpenCartProductDescription).filter(
            OpenCartProductDescription.product_id == product_id,
            OpenCartProductDescription.language_id == 4
        ).first()
        
        # Розширені атрибути
        extended = db.query(DecorProductExtended).filter(
            DecorProductExtended.product_id == product_id
        ).first()
        
        # Каталог (локація)
        catalog = db.query(DecorProductCatalog).filter(
            DecorProductCatalog.product_id == product_id
        ).first()
        
        # Інвентарні одиниці (mock для dev)
        inventory_items = db.query(DecorInventoryItem).filter(
            DecorInventoryItem.product_id == product_id
        ).all()
        
        inventory_list = []
        for item in inventory_items:
            inventory_list.append({
                'id': item.id,
                'code': item.inventory_code,
                'status': item.status,
                'location': item.location or 'Не вказано',
                'lastOrderId': item.last_order_id,
                'lastMovementAt': item.last_movement_at.isoformat() if item.last_movement_at else None,
                'note': item.notes
            })
        
        # Історія (mock для dev)
        history_items = db.query(DecorProductHistory).filter(
            DecorProductHistory.product_id == product_id
        ).order_by(DecorProductHistory.created_at.desc()).limit(50).all()
        
        history_list = []
        for h in history_items:
            history_list.append({
                'id': h.id,
                'date': h.created_at.isoformat(),
                'kind': h.event_type,
                'actor': h.actor or 'Система',
                'orderId': h.order_id,
                'note': h.notes or ''
            })
        
        # Status summary
        total_qty = int(product.quantity) if product.quantity else 0
        status_summary = {
            'total': total_qty,
            'available': total_qty,
            'reserved': 0,
            'on_rent': 0,
            'washing': 0,
            'repair': 0,
            'lost': 0
        }
        
        # Location
        default_location = "Склад"
        if catalog:
            parts = []
            if catalog.location_zone: parts.append(f"Зона {catalog.location_zone}")
            if catalog.location_aisle: parts.append(f"Стелаж {catalog.location_aisle}")
            if catalog.location_shelf: parts.append(f"Полиця {catalog.location_shelf}")
            default_location = " · ".join(parts) if parts else "Склад"
        
        # Збірка результату
        result = {
            'id': f"P-{product_id}",
            'product_id': product_id,
            'name': description.name if description else 'Без назви',
            'mainSku': product.model,
            'skuPrefix': product.model.split('-')[0] if '-' in product.model else product.model,
            'category': 'Загальне',
            'subcategory': extended.subcategory if extended else None,
            'color': extended.color if extended else None,
            'material': extended.material if extended else None,
            'size': extended.size if extended else None,
            'imageUrl': f"https://farforrent.com.ua/image/{product.image}" if product.image else None,
            'defaultLocation': default_location,
            'tags': extended.tags if extended and extended.tags else [],
            'description': description.description if description else '',
            'careNotes': extended.care_notes if extended else '',
            'createdAt': product.date_added.isoformat() if product.date_added else None,
            'updatedAt': product.date_modified.isoformat() if product.date_modified else None,
            'statusSummary': status_summary,
            'inventory': inventory_list,
            'history': history_list,
            'price': float(product.price) if product.price else 0,
            'ean': product.ean
        }
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка завантаження товару: {str(e)}"
        )


@router.put("/product/{product_id}")
async def update_product_extended(
    product_id: int,
    update_data: dict,
    db: Session = Depends(get_db)
):
    """
    Оновити розширені атрибути товару
    """
    try:
        # Перевірити чи товар існує
        product = db.query(OpenCartProduct).filter(
            OpenCartProduct.product_id == product_id
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail="Товар не знайдено")
        
        # Оновити extended attributes
        extended = db.query(DecorProductExtended).filter(
            DecorProductExtended.product_id == product_id
        ).first()
        
        if not extended:
            # Створити новий запис
            extended = DecorProductExtended(
                product_id=product_id,
                subcategory=update_data.get('subcategory'),
                color=update_data.get('color'),
                material=update_data.get('material'),
                size=update_data.get('size'),
                tags=update_data.get('tags', []),
                care_notes=update_data.get('careNotes')
            )
            db.add(extended)
        else:
            # Оновити існуючий
            if 'subcategory' in update_data:
                extended.subcategory = update_data['subcategory']
            if 'color' in update_data:
                extended.color = update_data['color']
            if 'material' in update_data:
                extended.material = update_data['material']
            if 'size' in update_data:
                extended.size = update_data['size']
            if 'tags' in update_data:
                extended.tags = update_data['tags']
            if 'careNotes' in update_data:
                extended.care_notes = update_data['careNotes']
            
            extended.updated_at = datetime.now()
        
        # Оновити основну назву/опис якщо потрібно
        if 'name' in update_data:
            desc = db.query(OpenCartProductDescription).filter(
                OpenCartProductDescription.product_id == product_id,
                OpenCartProductDescription.language_id == 4
            ).first()
            if desc:
                desc.name = update_data['name']
        
        if 'description' in update_data:
            desc = db.query(OpenCartProductDescription).filter(
                OpenCartProductDescription.product_id == product_id,
                OpenCartProductDescription.language_id == 4
            ).first()
            if desc:
                desc.description = update_data['description']
        
        # Оновити локацію
        if 'defaultLocation' in update_data:
            catalog = db.query(DecorProductCatalog).filter(
                DecorProductCatalog.product_id == product_id
            ).first()
            
            if catalog:
                # Parse location string: "Зона A · Стелаж 1 · Полиця 2"
                location_parts = update_data['defaultLocation'].split('·')
                if len(location_parts) >= 1 and 'Зона' in location_parts[0]:
                    catalog.location_zone = location_parts[0].replace('Зона', '').strip()
                if len(location_parts) >= 2 and 'Стелаж' in location_parts[1]:
                    catalog.location_aisle = location_parts[1].replace('Стелаж', '').strip()
                if len(location_parts) >= 3 and 'Полиця' in location_parts[2]:
                    catalog.location_shelf = location_parts[2].replace('Полиця', '').strip()
        
        # Створити запис в історії
        history_event = DecorProductHistory(
            id=f"H-{uuid.uuid4().hex[:8].upper()}",
            product_id=product_id,
            event_type='edited',
            actor=update_data.get('actor', 'Система'),
            notes='Оновлено атрибути товару через Extended Catalog'
        )
        db.add(history_event)
        
        db.commit()
        
        return {
            'success': True,
            'message': 'Товар оновлено',
            'product_id': product_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка оновлення товару: {str(e)}"
        )


@router.post("/product/{product_id}/inventory")
async def add_inventory_item(
    product_id: int,
    item_data: dict,
    db: Session = Depends(get_db)
):
    """
    Додати нову інвентарну одиницю
    """
    try:
        inventory_code = item_data.get('code', '').strip()
        if not inventory_code:
            raise HTTPException(status_code=400, detail="inventory_code є обов'язковим")
        
        # Перевірити чи код унікальний
        existing = db.query(DecorInventoryItem).filter(
            DecorInventoryItem.inventory_code == inventory_code
        ).first()
        
        if existing:
            raise HTTPException(status_code=409, detail="Інвентарний код вже використовується")
        
        # Створити новий item
        new_item = DecorInventoryItem(
            id=f"INV-{uuid.uuid4().hex[:8].upper()}",
            product_id=product_id,
            inventory_code=inventory_code,
            status='available',
            location=item_data.get('location'),
            notes=item_data.get('note'),
            last_movement_at=datetime.now()
        )
        
        db.add(new_item)
        
        # Створити запис в історії
        history_event = DecorProductHistory(
            id=f"H-{uuid.uuid4().hex[:8].upper()}",
            product_id=product_id,
            inventory_item_id=new_item.id,
            event_type='created',
            actor=item_data.get('actor', 'Система'),
            notes=f"Додано нову одиницю: {inventory_code}"
        )
        db.add(history_event)
        
        db.commit()
        
        return {
            'success': True,
            'message': 'Інвентарну одиницю додано',
            'item_id': new_item.id,
            'inventory_code': inventory_code
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка додавання одиниці: {str(e)}"
        )
