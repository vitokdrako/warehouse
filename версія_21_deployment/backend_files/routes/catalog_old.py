"""
Catalog API routes - inventory management
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from database import get_db
from models_sqlalchemy import (
    OpenCartProduct,
    OpenCartProductDescription,
    OpenCartCategory,
    OpenCartCategoryDescription,
    OpenCartProductToCategory,
    OpenCartOrder, 
    OpenCartOrderProduct,
    OpenCartOrderSimpleFields,
    DecorProductCatalog,
    ProductReservation
)
from datetime import datetime

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

@router.get("")
async def get_catalog_items(
    category: str = None,
    search: str = None,
    limit: int = 1000,  # Збільшено до 1000
    db: Session = Depends(get_db)
):
    """
    Отримати каталог товарів з інформацією про склад (оптимізовано)
    """
    try:
        # Subquery для отримання ОДНІЄЇ категорії на товар
        category_subquery = db.query(
            OpenCartProductToCategory.product_id,
            OpenCartCategoryDescription.name.label('category_name')
        ).join(
            OpenCartCategoryDescription,
            and_(
                OpenCartProductToCategory.category_id == OpenCartCategoryDescription.category_id,
                OpenCartCategoryDescription.language_id == 1  # Мова 1 (не 3!)
            )
        ).distinct(OpenCartProductToCategory.product_id).subquery()
        
        # Основний запит з усіма JOIN одразу
        query = db.query(
            OpenCartProduct,
            OpenCartProductDescription.name,
            category_subquery.c.category_name,
            DecorProductCatalog
        ).outerjoin(
            OpenCartProductDescription,
            and_(
                OpenCartProduct.product_id == OpenCartProductDescription.product_id,
                OpenCartProductDescription.language_id == 1  # Мова 1 (не 3!)
            )
        ).outerjoin(
            category_subquery,
            OpenCartProduct.product_id == category_subquery.c.product_id
        ).outerjoin(
            DecorProductCatalog,
            OpenCartProduct.product_id == DecorProductCatalog.product_id
        )
        
        # Filters
        if search:
            query = query.filter(
                or_(
                    OpenCartProduct.model.ilike(f"%{search}%"),
                    OpenCartProductDescription.name.ilike(f"%{search}%"),
                    OpenCartProduct.ean.ilike(f"%{search}%")
                )
            )
        
        if category and category != "all":
            query = query.filter(OpenCartCategoryDescription.name == category)
        
        results = query.limit(limit).all()
        
        # Згрупуємо по product_id і додамо (1), (2) до назв якщо є дублікати
        products_map = {}
        for product, product_name, category_name, catalog_data in results:
            pid = product.product_id
            if pid not in products_map:
                products_map[pid] = {
                    'product': product,
                    'names': [],
                    'category_name': category_name,
                    'catalog_data': catalog_data
                }
            if product_name:
                products_map[pid]['names'].append(product_name)
        
        # Отримати всі product_ids для batch запитів
        product_ids = list(products_map.keys())
        
        # Batch запит для in_rent
        in_rent_data = db.query(
            OpenCartOrderProduct.product_id,
            func.sum(OpenCartOrderProduct.quantity).label('qty')
        ).join(
            OpenCartOrder,
            OpenCartOrderProduct.order_id == OpenCartOrder.order_id
        ).filter(
            OpenCartOrderProduct.product_id.in_(product_ids),
            OpenCartOrder.order_status_id == 24
        ).group_by(OpenCartOrderProduct.product_id).all()
        in_rent_map = {pid: int(qty) for pid, qty in in_rent_data}
        
        # Batch запит для reserved
        reserved_data = db.query(
            OpenCartOrderProduct.product_id,
            func.sum(OpenCartOrderProduct.quantity).label('qty')
        ).join(
            OpenCartOrder,
            OpenCartOrderProduct.order_id == OpenCartOrder.order_id
        ).filter(
            OpenCartOrderProduct.product_id.in_(product_ids),
            OpenCartOrder.order_status_id.in_([2, 19, 3])
        ).group_by(OpenCartOrderProduct.product_id).all()
        reserved_map = {pid: int(qty) for pid, qty in reserved_data}
        
        # Формування результату
        result = []
        for pid, data in products_map.items():
            product = data['product']
            category_name = data['category_name']
            catalog_data = data['catalog_data']
            
            # Назва товару - якщо є кілька варіантів, додаємо (1), (2)
            if len(data['names']) > 1:
                product_name = ' / '.join(data['names'])  # Об'єднуємо всі назви через /
            elif data['names']:
                product_name = data['names'][0]
            else:
                product_name = product.model
            # Image URL from oc_product.image
            cover_url = f"https://picsum.photos/seed/{product.product_id}/120/80"
            if product.image:
                cover_url = f"https://farforrent.com.ua/image/{product.image}"
            
            # Calculate stock states
            total_qty = int(product.quantity) if product.quantity else 0
            in_rent = in_rent_map.get(product.product_id, 0)
            reserved = reserved_map.get(product.product_id, 0)
            available = total_qty - in_rent - reserved
            
            # Location from DecorProductCatalog or default from SKU
            location_data = {
                "zone": product.model[:1] if product.model else "A",
                "aisle": product.model[:2] if product.model and len(product.model) > 1 else "A1",
                "shelf": product.model if product.model else "S1",
                "bin": "—"
            }
            if catalog_data:
                location_data = {
                    "zone": catalog_data.location_zone or location_data["zone"],
                    "aisle": catalog_data.location_aisle or location_data["aisle"],
                    "shelf": catalog_data.location_shelf or location_data["shelf"],
                    "bin": catalog_data.location_bin or "—"
                }
            
            # Cleaning status
            cleaning_status = "clean"
            cleaning_last = str(datetime.now().date())
            if catalog_data:
                cleaning_status = catalog_data.cleaning_status or "clean"
                cleaning_last = str(catalog_data.cleaning_last_updated.date()) if catalog_data.cleaning_last_updated else cleaning_last
            
            # Product state
            product_state = "ok" if available > 0 else "ok"
            if catalog_data and catalog_data.product_state:
                product_state = catalog_data.product_state
            
            result.append({
                "id": product.product_id,
                "sku": product.model,
                "name": product_name or product.model,
                "cat": category_name or "Декор",
                "cover": cover_url,
                "total": total_qty,
                "available": max(0, available),
                "reserved": reserved,
                "rented": in_rent,
                "due_back": [],  # Опціонально, можна додати окремим запитом
                "location": location_data,
                "cleaning": {
                    "status": cleaning_status,
                    "last": cleaning_last
                },
                "state": product_state,
                "variants": [],
                "barcodes": [product.ean] if product.ean else []
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка завантаження каталогу: {str(e)}"
        )

@router.get("/{product_id}")
async def get_catalog_item(
    product_id: int,
    db: Session = Depends(get_db)
):
    """
    Отримати детальну інформацію про товар
    """
    try:
        result = db.query(
            OpenCartProduct,
            OpenCartProductDescription.name
        ).outerjoin(
            OpenCartProductDescription,
            OpenCartProduct.product_id == OpenCartProductDescription.product_id
        ).filter(
            OpenCartProduct.product_id == product_id
        ).first()
        
        if not result:
            raise HTTPException(status_code=404, detail="Товар не знайдено")
        
        product, product_name = result
        
        # Get category
        category_mapping = db.query(
            OpenCartProductToCategory,
            OpenCartCategoryDescription.name
        ).join(
            OpenCartCategoryDescription,
            OpenCartProductToCategory.category_id == OpenCartCategoryDescription.category_id
        ).filter(
            OpenCartProductToCategory.product_id == product.product_id,
            OpenCartCategoryDescription.language_id == 3  # Ukrainian
        ).first()
        
        category_name = "Декор"
        if category_mapping:
            _, cat_name = category_mapping
            category_name = cat_name or "Декор"
        
        # Image URL from oc_product.image
        cover_url = f"https://picsum.photos/seed/{product.product_id}/120/80"
        if product.image:
            cover_url = f"https://farforrent.com.ua/image/{product.image}"
        
        # Get extended catalog data
        catalog_data = db.query(DecorProductCatalog).filter(
            DecorProductCatalog.product_id == product.product_id
        ).first()
        
        # Same logic as above but for single product
        total_qty = int(product.quantity) if product.quantity else 0
        
        in_rent = db.query(
            func.sum(OpenCartOrderProduct.quantity)
        ).join(
            OpenCartOrder,
            OpenCartOrderProduct.order_id == OpenCartOrder.order_id
        ).filter(
            OpenCartOrderProduct.product_id == product.product_id,
            OpenCartOrder.order_status_id == 24
        ).scalar() or 0
        
        reserved = db.query(
            func.sum(OpenCartOrderProduct.quantity)
        ).join(
            OpenCartOrder,
            OpenCartOrderProduct.order_id == OpenCartOrder.order_id
        ).filter(
            OpenCartOrderProduct.product_id == product.product_id,
            OpenCartOrder.order_status_id.in_([2, 19, 3])
        ).scalar() or 0
        
        available = total_qty - int(in_rent) - int(reserved)
        
        due_back_orders = db.query(
            OpenCartOrder.order_id,
            OpenCartOrder.firstname,
            OpenCartOrder.lastname,
            OpenCartOrderProduct.quantity,
            OpenCartOrderSimpleFields.rent_return_date
        ).join(
            OpenCartOrderProduct,
            OpenCartOrder.order_id == OpenCartOrderProduct.order_id
        ).outerjoin(
            OpenCartOrderSimpleFields,
            OpenCartOrder.order_id == OpenCartOrderSimpleFields.order_id
        ).filter(
            OpenCartOrderProduct.product_id == product.product_id,
            OpenCartOrder.order_status_id == 24
        ).all()
        
        due_back = []
        for order_id, firstname, lastname, qty, return_date in due_back_orders:
            due_back.append({
                "order_id": order_id,
                "customer": f"{firstname} {lastname}",
                "qty": int(qty),
                "date": str(return_date) if return_date else None
            })
        
        # Location from DecorProductCatalog or default from SKU
        location_data = {
            "zone": product.model[:1] if product.model else "A",
            "aisle": product.model[:2] if product.model and len(product.model) > 1 else "A1",
            "shelf": product.model if product.model else "S1",
            "bin": "—"
        }
        if catalog_data:
            location_data = {
                "zone": catalog_data.location_zone or location_data["zone"],
                "aisle": catalog_data.location_aisle or location_data["aisle"],
                "shelf": catalog_data.location_shelf or location_data["shelf"],
                "bin": catalog_data.location_bin or "—"
            }
        
        # Cleaning status
        cleaning_status = "clean"
        cleaning_last = str(datetime.now().date())
        if catalog_data:
            cleaning_status = catalog_data.cleaning_status or "clean"
            cleaning_last = str(catalog_data.cleaning_last_updated.date()) if catalog_data.cleaning_last_updated else cleaning_last
        
        # Product state
        product_state = "ok" if available > 0 else "fragile"
        if catalog_data and catalog_data.product_state:
            product_state = catalog_data.product_state
        
        return {
            "id": product.product_id,
            "sku": product.model,
            "name": product_name or product.model,
            "cat": category_name,
            "cover": cover_url,
            "total": total_qty,
            "available": max(0, available),
            "reserved": int(reserved),
            "rented": int(in_rent),
            "due_back": due_back,
            "location": location_data,
            "cleaning": {
                "status": cleaning_status,
                "last": cleaning_last
            },
            "state": product_state,
            "variants": [],
            "barcodes": [product.ean] if product.ean else []
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка завантаження товару: {str(e)}"
        )


@router.put("/{product_id}")
async def update_catalog_item(
    product_id: int,
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Оновити інформацію про товар в каталозі
    """
    try:
        # Check if product exists
        product = db.query(OpenCartProduct).filter(
            OpenCartProduct.product_id == product_id
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail="Товар не знайдено")
        
        # Update DecorProductCatalog (location, cleaning, state)
        catalog_data = db.query(DecorProductCatalog).filter(
            DecorProductCatalog.product_id == product_id
        ).first()
        
        if not catalog_data:
            # Create new record if doesn't exist
            catalog_data = DecorProductCatalog(product_id=product_id)
            db.add(catalog_data)
        
        # Update fields
        if 'location' in data:
            loc = data['location']
            if 'zone' in loc:
                catalog_data.location_zone = loc['zone']
            if 'aisle' in loc:
                catalog_data.location_aisle = loc['aisle']
            if 'shelf' in loc:
                catalog_data.location_shelf = loc['shelf']
            if 'bin' in loc:
                catalog_data.location_bin = loc['bin']
        
        if 'cleaning' in data:
            clean = data['cleaning']
            if 'status' in clean:
                catalog_data.cleaning_status = clean['status']
            catalog_data.cleaning_last_updated = datetime.now()
        
        if 'state' in data:
            catalog_data.product_state = data['state']
        
        catalog_data.updated_at = datetime.now()
        
        db.commit()
        db.refresh(catalog_data)
        
        return {"success": True, "message": "Товар оновлено"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка оновлення товару: {str(e)}"
        )


@router.get("/check-availability/{sku}")
async def check_product_availability(
    sku: str,
    from_date: str,
    to_date: str,
    quantity: int = 1,
    db: Session = Depends(get_db)
):
    """
    Перевірити доступність товару на певні дати
    Використовує таблицю product_reservations для точного розрахунку
    """
    try:
        from models_sqlalchemy import ProductReservation, OpenCartProduct
        from datetime import datetime as dt
        
        # Парсити дати
        check_from = dt.fromisoformat(from_date.replace('Z', '+00:00'))
        check_to = dt.fromisoformat(to_date.replace('Z', '+00:00'))
        
        # Знайти товар
        product = db.query(OpenCartProduct).filter(
            OpenCartProduct.sku == sku
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail="Товар не знайдено")
        
        # Загальна кількість в інвентарі
        total_quantity = int(product.quantity) if product.quantity else 0
        
        # Знайти всі активні резервації які перетинаються з нашими датами
        overlapping_reservations = db.query(ProductReservation).filter(
            ProductReservation.sku == sku,
            ProductReservation.status.in_(['active', 'issued']),  # Тільки активні та видані
            # Перевірка перетину дат
            or_(
                # Резервація починається в нашому періоді
                and_(
                    ProductReservation.reserved_from >= check_from,
                    ProductReservation.reserved_from < check_to
                ),
                # Резервація закінчується в нашому періоді
                and_(
                    ProductReservation.reserved_to > check_from,
                    ProductReservation.reserved_to <= check_to
                ),
                # Наш період всередині резервації
                and_(
                    ProductReservation.reserved_from <= check_from,
                    ProductReservation.reserved_to >= check_to
                )
            )
        ).all()
        
        # Порахувати загальну зарезервовану кількість
        reserved_quantity = sum(r.quantity_reserved for r in overlapping_reservations)
        
        # Доступна кількість
        available_quantity = total_quantity - reserved_quantity
        
        # Список конфліктних замовлень
        conflicts = []
        if reserved_quantity > 0:
            for res in overlapping_reservations:
                conflicts.append({
                    "order_number": res.order_number,
                    "client_name": res.client_name,
                    "quantity": res.quantity_reserved,
                    "from": str(res.reserved_from),
                    "to": str(res.reserved_to),
                    "status": res.status
                })
        
        return {
            "sku": sku,
            "product_name": product.model,
            "total_quantity": total_quantity,
            "reserved_quantity": reserved_quantity,
            "available_quantity": max(0, available_quantity),
            "requested_quantity": quantity,
            "is_available": available_quantity >= quantity,
            "check_period": {
                "from": from_date,
                "to": to_date
            },
            "conflicts": conflicts
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Неправильний формат дати: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка перевірки доступності: {str(e)}"
        )

