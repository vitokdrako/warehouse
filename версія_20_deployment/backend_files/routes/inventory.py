"""
Inventory routes - MySQL version
✅ MIGRATED: Using RentalHub DB
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, text
from datetime import datetime

from database_rentalhub import get_rh_db  # ✅ Using RentalHub DB

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

# ============================================================
# PYDANTIC MODELS
# ============================================================

class InventoryItem(BaseModel):
    id: str
    article: str
    name: str
    category: Optional[str]
    price_per_day: float
    quantity: int
    image_url: Optional[str]
    description: Optional[str]
    replacement_price: Optional[float]
    damage_category: Optional[str]

# ============================================================
# API ENDPOINTS
# ============================================================

@router.get("")
async def get_inventory(
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_rh_db)  # ✅ MIGRATED
):
    """
    Get inventory from RentalHub DB
    ✅ MIGRATED: Using products + inventory tables
    """
    
    # ✅ Build SQL query
    sql_query = """
        SELECT 
            p.product_id, p.sku, p.name, p.price, p.image_url, p.description,
            i.quantity, i.zone, i.aisle, i.shelf
        FROM products p
        LEFT JOIN inventory i ON p.product_id = i.product_id
        WHERE p.status = 1
    """
    
    params = {}
    
    # Search by SKU or name
    if search:
        sql_query += " AND (p.sku LIKE :search OR p.name LIKE :search)"
        params['search'] = f"%{search}%"
    
    sql_query += f" LIMIT {limit}"
    
    result_db = db.execute(text(sql_query), params)
    
    result = []
    for row in result_db:
        product_id, sku, name, price, image_url, description, quantity, zone, aisle, shelf = row
        
        result.append({
            "id": str(product_id),
            "article": sku or str(product_id),
            "name": name or f"Product {product_id}",
            "category": None,  # TODO: add category from products table
            "price_per_day": float(price) if price else 0.0,
            "quantity": quantity or 0,
            "image_url": image_url,
            "description": description,
            "replacement_price": None,  # TODO: add from extended data
            "damage_category": None,
            "location": f"{zone}-{aisle}-{shelf}" if zone else None
        })
    
    return result

@router.get("/{item_id}")
async def get_inventory_item(item_id: str, db: Session = Depends(get_rh_db)):  # ✅ MIGRATED
    """
    Get single inventory item
    ✅ MIGRATED: Using RentalHub DB
    """
    
    try:
        # ✅ Query from RentalHub DB
        result_db = db.execute(text("""
            SELECT 
                p.product_id, p.sku, p.name, p.price, p.image_url, p.description,
                i.quantity, i.zone, i.aisle, i.shelf, i.cleaning_status, i.product_state
            FROM products p
            LEFT JOIN inventory i ON p.product_id = i.product_id
            WHERE p.product_id = :product_id
        """), {"product_id": int(item_id)})
        
        row = result_db.fetchone()
    except ValueError:
        row = None
    
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # ✅ Parse row data
    (product_id, sku, name, price, image_url, description, 
     quantity, zone, aisle, shelf, cleaning_status, product_state) = row
    
    return {
        "id": str(product_id),
        "article": sku or str(product_id),
        "name": name or f"Product {product_id}",
        "category": None,
        "price_per_day": float(price) if price else 0.0,
        "quantity": quantity or 0,
        "image_url": image_url,
        "description": description,
        "replacement_price": None,
        "damage_category": None,
        "location": {
            "zone": zone,
            "aisle": aisle,
            "shelf": shelf
        },
        "cleaning_status": cleaning_status,
        "product_state": product_state
    }
