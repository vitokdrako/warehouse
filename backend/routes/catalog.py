"""
Catalog API routes - inventory management
✅ MIGRATED: Using RentalHub DB
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime

from database_rentalhub import get_rh_db
from utils.image_helper import normalize_image_url

router = APIRouter(prefix="/api/catalog", tags=["catalog"])

@router.get("")
async def get_catalog_items(
    category: str = None,
    search: str = None,
    limit: int = 1000,
    include_reservations: bool = False,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати каталог товарів (оптимізовано)
    ✅ MIGRATED: Using products + categories from RentalHub DB
    """
    sql = """
        SELECT 
            p.product_id, p.sku, p.name, p.price, p.image_url, p.status,
            p.category_id, p.category_name, 
            p.subcategory_id, p.subcategory_name,
            p.quantity, p.zone, p.aisle, p.shelf,
            p.family_id, pf.name as family_name, pf.description as family_description
        FROM products p
        LEFT JOIN product_families pf ON p.family_id = pf.id
        WHERE p.status = 1
    """
    
    params = {}
    
    if search:
        sql += " AND (p.name LIKE :search OR p.sku LIKE :search)"
        params['search'] = f"%{search}%"
    
    if category:
        sql += " AND (p.category_name LIKE :category OR p.subcategory_name LIKE :category)"
        params['category'] = f"%{category}%"
    
    sql += f" ORDER BY p.product_id DESC LIMIT {limit}"
    
    result = db.execute(text(sql), params)
    
    # Оптимізація: отримати статистику для всіх товарів одним запитом
    reserved_dict = {}
    in_rent_dict = {}
    in_restore_dict = {}
    
    if include_reservations:
        # Резерви (order_items де замовлення заморожені)
        reserved_result = db.execute(text("""
            SELECT oi.product_id, COALESCE(SUM(oi.quantity), 0) as reserved
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            WHERE o.status IN ('processing', 'ready_for_issue', 'issued', 'on_rent')
            AND o.rental_end_date >= CURDATE()
            GROUP BY oi.product_id
        """))
        reserved_dict = {row[0]: int(row[1]) for row in reserved_result}
        
        # В оренді (видані замовлення)
        in_rent_result = db.execute(text("""
            SELECT oi.product_id, COALESCE(SUM(oi.quantity), 0) as in_rent
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            WHERE o.status IN ('issued', 'on_rent')
            GROUP BY oi.product_id
        """))
        in_rent_dict = {row[0]: int(row[1]) for row in in_rent_result}
        
        # На реставрації (товари зі статусом cleaning.status = 'repair')
        # TODO: Потребує таблиці product_cleaning_status або окремого поля
        # Поки що залишаємо пусту логіку, бо немає таблиці для зберігання cleaning status
        in_restore_result = db.execute(text("""
            SELECT product_id, 0 as in_restore
            FROM products
            WHERE 1=0
        """))
        in_restore_dict = {}
    
    items = []
    for row in result:
        family_id = row[14] if len(row) > 14 else None
        family_name = row[15] if len(row) > 15 else None
        family_description = row[16] if len(row) > 16 else None
        
        normalized_image = normalize_image_url(row[4])
        product_id = row[0]
        total_qty = row[10] or 0
        
        # Отримати статистику з pre-loaded словників
        reserved_qty = reserved_dict.get(product_id, 0)
        in_rent_qty = in_rent_dict.get(product_id, 0)
        in_restore_qty = in_restore_dict.get(product_id, 0)
        
        available_qty = max(0, total_qty - reserved_qty - in_rent_qty)
        
        items.append({
            "id": row[0],
            "product_id": row[0],
            "sku": row[1],
            "name": row[2],
            "price": float(row[3]) if row[3] else 0.0,
            "damage_cost": float(row[3]) if row[3] else 0.0,  # EAN/збиток
            "image": normalized_image,
            "photo": normalized_image,
            "cover": normalized_image,
            "status": row[5],
            "state": "ok" if available_qty > 0 else "unavailable",
            "cat": row[7],  # Frontend очікує cat
            "category": row[7],
            "category_id": row[6],
            "category_name": row[7],
            "subcategory_id": row[8],
            "subcategory": row[9],
            "subcategory_name": row[9],
            "quantity": row[10] or 0,
            "total": total_qty,
            "available": available_qty,
            "reserved": reserved_qty,
            "in_rent": in_rent_qty,
            "rented": in_rent_qty,
            "in_restore": in_restore_qty,
            "location": {
                "zone": row[11] or "",
                "aisle": row[12] or "",
                "shelf": row[13] or "",
                "state": "shelf"
            },
            "cleaning": {
                "status": "clean",  # За замовчуванням
                "date": None
            },
            "barcode": row[1] or "",  # SKU як barcode
            "barcodes": [row[1]] if row[1] else [],  # Список штрихкодів
            "who_has": [],  # TODO: список активних замовлень
            "due_back": [],  # TODO: список замовлень на повернення
            "variants": [],  # TODO: варіанти товару
            # Family Groups (набори)
            "family_id": family_id,
            "family": {
                "id": family_id,
                "name": family_name,
                "description": family_description
            } if family_id else None
        })
    
    return items


@router.get("/families/{family_id}/products")
async def get_family_products(
    family_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Отримати всі товари з набору (Family Group)
    """
    try:
        result = db.execute(text("""
            SELECT p.product_id, p.sku, p.name, p.price, p.image_url, 
                   p.quantity, p.zone, p.aisle, p.shelf
            FROM products p
            WHERE p.family_id = :family_id
            ORDER BY p.sku
        """), {"family_id": family_id})
        
        products = []
        for row in result:
            products.append({
                "product_id": row[0],
                "sku": row[1],
                "name": row[2],
                "price": float(row[3]) if row[3] else 0.0,
                "image": row[4],
                "quantity": row[5] or 0,
                "location": {
                    "zone": row[6],
                    "aisle": row[7],
                    "shelf": row[8]
                }
            })
        
        return products
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка: {str(e)}"
        )




@router.get("/families")
async def get_all_families(
    db: Session = Depends(get_rh_db)
):
    """
    Отримати всі набори з їх товарами
    """
    try:
        # Отримати всі набори
        families_result = db.execute(text("""
            SELECT id, name, description FROM product_families ORDER BY name
        """))
        
        families = []
        for fam_row in families_result:
            family_id = fam_row[0]
            
            # Отримати товари для кожного набору
            products_result = db.execute(text("""
                SELECT p.product_id, p.sku, p.name, p.image_url
                FROM products p
                WHERE p.family_id = :family_id
                ORDER BY p.sku
            """), {"family_id": family_id})
            
            products = []
            for prod_row in products_result:
                products.append({
                    "product_id": prod_row[0],
                    "sku": prod_row[1],
                    "name": prod_row[2],
                    "cover": normalize_image_url(prod_row[3])
                })
            
            families.append({
                "id": family_id,
                "name": fam_row[1],
                "description": fam_row[2],
                "products": products
            })
        
        return families
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка: {str(e)}"
        )


@router.post("/families")
async def create_family(
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Створити новий набір
    """
    try:
        result = db.execute(text("""
            INSERT INTO product_families (name, description)
            VALUES (:name, :description)
        """), {
            "name": data.get("name"),
            "description": data.get("description", "")
        })
        
        db.commit()
        
        return {
            "success": True,
            "family_id": result.lastrowid,
            "message": "Набір створено"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка: {str(e)}"
        )


@router.post("/families/{family_id}/assign")
async def assign_products_to_family(
    family_id: int,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Прив'язати товари до набору
    """
    try:
        product_ids = data.get("product_ids", [])
        
        for product_id in product_ids:
            db.execute(text("""
                UPDATE products SET family_id = :family_id WHERE product_id = :product_id
            """), {"family_id": family_id, "product_id": product_id})
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Прив'язано {len(product_ids)} товарів"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка: {str(e)}"
        )


@router.post("/products/{product_id}/remove-family")
async def remove_product_from_family(
    product_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Видалити товар з набору
    """
    try:
        db.execute(text("""
            UPDATE products SET family_id = NULL WHERE product_id = :product_id
        """), {"product_id": product_id})
        
        db.commit()
        
        return {
            "success": True,
            "message": "Товар видалено з набору"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка: {str(e)}"
        )


@router.delete("/families/{family_id}")
async def delete_family(
    family_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Видалити набір
    """
    try:
        # Спочатку відв'язати всі товари
        db.execute(text("""
            UPDATE products SET family_id = NULL WHERE family_id = :family_id
        """), {"family_id": family_id})
        
        # Видалити набір
        db.execute(text("""
            DELETE FROM product_families WHERE id = :family_id
        """), {"family_id": family_id})
        
        db.commit()
        
        return {
            "success": True,
            "message": "Набір видалено"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Помилка: {str(e)}"
        )

@router.get("/{product_id}")
async def get_product_detail(
    product_id: int,
    db: Session = Depends(get_rh_db)
):
    """
    Детальна інформація про товар
    ✅ MIGRATED: Using RentalHub DB
    """
    result = db.execute(text("""
        SELECT 
            p.product_id, p.sku, p.name, p.description, p.price, 
            p.image_url, p.status,
            p.category_id, p.category_name, p.subcategory_id, p.subcategory_name,
            p.quantity, p.zone, p.aisle, p.shelf,
            p.cleaning_status, p.product_state
        FROM products p
        WHERE p.product_id = :product_id
    """), {"product_id": product_id})
    
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get product history
    history_result = db.execute(text("""
        SELECT action, actor, details, created_at
        FROM product_history
        WHERE product_id = :product_id
        ORDER BY created_at DESC
        LIMIT 10
    """), {"product_id": product_id})
    
    history = []
    for h_row in history_result:
        history.append({
            "event_type": h_row[0],
            "changed_by": h_row[1],
            "notes": h_row[2],
            "event_date": h_row[3].isoformat() if h_row[3] else None
        })
    
    return {
        "product_id": row[0],
        "sku": row[1],
        "name": row[2],
        "description": row[3],
        "price": float(row[4]) if row[4] else 0.0,
        "image": row[5],
        "status": row[6],
        "category_id": row[7],
        "category": row[8],
        "category_name": row[8],
        "subcategory_id": row[9],
        "subcategory": row[10],
        "subcategory_name": row[10],
        "quantity": row[11] or 0,
        "inventory": {
            "quantity": row[11] or 0,
            "zone": row[12],
            "aisle": row[13],
            "shelf": row[14],
            "cleaning_status": row[15],
            "product_state": row[16]
        },
        "history": history
    }

@router.put("/{product_id}")
async def update_product(
    product_id: int,
    data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Оновити товар
    ✅ MIGRATED: Using RentalHub DB
    """
    # Check if exists
    result = db.execute(text("SELECT product_id FROM products WHERE product_id = :id"), {"id": product_id})
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Build update query
    set_clauses = []
    params = {"product_id": product_id}
    
    if 'name' in data:
        set_clauses.append("name = :name")
        params['name'] = data['name']
    if 'price' in data:
        set_clauses.append("price = :price")
        params['price'] = data['price']
    if 'quantity' in data:
        set_clauses.append("quantity = :quantity")
        params['quantity'] = data['quantity']
    if 'status' in data:
        set_clauses.append("status = :status")
        params['status'] = data['status']
    if 'description' in data:
        set_clauses.append("description = :description")
        params['description'] = data['description']
    
    if set_clauses:
        sql = f"UPDATE products SET {', '.join(set_clauses)} WHERE product_id = :product_id"
        db.execute(text(sql), params)
        
        # Log to history
        db.execute(text("""
            INSERT INTO product_history (product_id, event_type, event_date, notes, changed_by)
            VALUES (:product_id, 'updated', NOW(), :notes, :user)
        """), {
            "product_id": product_id,
            "notes": f"Updated: {', '.join(data.keys())}",
            "user": data.get('updated_by', 'system')
        })
        
        db.commit()
    
    return {"message": "Product updated successfully"}

@router.get("/check-availability/{sku}")
async def check_availability(
    sku: str,
    db: Session = Depends(get_rh_db)
):
    """
    Перевірити доступність товару
    ✅ MIGRATED: Using RentalHub DB
    """
    result = db.execute(text("""
        SELECT p.product_id, p.name, p.quantity, i.quantity as inventory_qty
        FROM products p
        LEFT JOIN inventory i ON p.product_id = i.product_id
        WHERE p.sku = :sku AND p.status = 1
    """), {"sku": sku})
    
    row = result.fetchone()
    if not row:
        return {
            "available": False,
            "message": "Product not found or inactive"
        }
    
    quantity = row[3] if row[3] is not None else row[2]
    
    return {
        "available": quantity > 0,
        "product_id": row[0],
        "name": row[1],
        "quantity": quantity,
        "message": f"Available: {quantity} units" if quantity > 0 else "Out of stock"
    }
