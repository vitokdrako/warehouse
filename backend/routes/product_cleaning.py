"""
Product Cleaning Status API - управління статусом чистки/реставрації товарів
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/product-cleaning", tags=["product-cleaning"])


class CleaningStatusUpdate(BaseModel):
    status: str  # clean, wash, dry, repair
    notes: Optional[str] = None
    updated_by: Optional[str] = None


@router.get("/{product_id}")
async def get_cleaning_status(product_id: int, db: Session = Depends(get_rh_db)):
    """
    Отримати статус чистки товару
    """
    result = db.execute(text("""
        SELECT pcs.*, p.sku, p.name
        FROM product_cleaning_status pcs
        JOIN products p ON pcs.product_id = p.product_id
        WHERE pcs.product_id = :product_id
    """), {"product_id": product_id})
    
    row = result.fetchone()
    
    if not row:
        # Повернути дефолтний статус якщо запису немає
        product = db.execute(text("SELECT sku, name FROM products WHERE product_id = :id"), {"id": product_id}).fetchone()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        return {
            "product_id": product_id,
            "sku": product[0],
            "status": "clean",
            "notes": None,
            "updated_by": None,
            "updated_at": None
        }
    
    return {
        "id": row[0],
        "product_id": row[1],
        "sku": row[2],
        "status": row[3],
        "notes": row[4],
        "updated_by": row[5],
        "updated_at": str(row[6]) if row[6] else None
    }


@router.get("/sku/{sku}")
async def get_cleaning_status_by_sku(sku: str, db: Session = Depends(get_rh_db)):
    """
    Отримати статус чистки товару за SKU
    """
    result = db.execute(text("""
        SELECT pcs.*, p.product_id, p.name
        FROM product_cleaning_status pcs
        JOIN products p ON pcs.product_id = p.product_id
        WHERE p.sku = :sku
    """), {"sku": sku})
    
    row = result.fetchone()
    
    if not row:
        # Повернути дефолтний статус
        product = db.execute(text("SELECT product_id, name FROM products WHERE sku = :sku"), {"sku": sku}).fetchone()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        return {
            "product_id": product[0],
            "sku": sku,
            "status": "clean",
            "notes": None,
            "updated_by": None,
            "updated_at": None
        }
    
    return {
        "id": row[0],
        "product_id": row[1],
        "sku": row[2],
        "status": row[3],
        "notes": row[4],
        "updated_by": row[5],
        "updated_at": str(row[6]) if row[6] else None,
        "product_name": row[8] if len(row) > 8 else None
    }


@router.put("/{product_id}")
async def update_cleaning_status(
    product_id: int, 
    data: CleaningStatusUpdate, 
    db: Session = Depends(get_rh_db)
):
    """
    Оновити статус чистки товару
    """
    # Перевірити що товар існує
    product = db.execute(text("SELECT sku FROM products WHERE product_id = :id"), {"id": product_id}).fetchone()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    sku = product[0]
    
    # Перевірити чи існує запис
    existing = db.execute(text("SELECT id FROM product_cleaning_status WHERE product_id = :id"), {"id": product_id}).fetchone()
    
    if existing:
        # Оновити
        db.execute(text("""
            UPDATE product_cleaning_status
            SET status = :status, notes = :notes, updated_by = :updated_by, updated_at = NOW()
            WHERE product_id = :product_id
        """), {
            "product_id": product_id,
            "status": data.status,
            "notes": data.notes,
            "updated_by": data.updated_by or "system"
        })
    else:
        # Створити
        db.execute(text("""
            INSERT INTO product_cleaning_status (product_id, sku, status, notes, updated_by, updated_at)
            VALUES (:product_id, :sku, :status, :notes, :updated_by, NOW())
        """), {
            "product_id": product_id,
            "sku": sku,
            "status": data.status,
            "notes": data.notes,
            "updated_by": data.updated_by or "system"
        })
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Статус чистки оновлено: {data.status}",
        "product_id": product_id,
        "sku": sku,
        "status": data.status
    }


@router.get("/list/in-repair")
async def get_products_in_repair(db: Session = Depends(get_rh_db)):
    """
    Отримати список товарів на реставрації
    """
    result = db.execute(text("""
        SELECT pcs.product_id, pcs.sku, p.name, pcs.notes, pcs.updated_by, pcs.updated_at
        FROM product_cleaning_status pcs
        JOIN products p ON pcs.product_id = p.product_id
        WHERE pcs.status = 'repair'
        ORDER BY pcs.updated_at DESC
    """))
    
    products = []
    for row in result:
        products.append({
            "product_id": row[0],
            "sku": row[1],
            "name": row[2],
            "notes": row[3],
            "updated_by": row[4],
            "updated_at": str(row[5]) if row[5] else None
        })
    
    return {
        "total": len(products),
        "products": products
    }


@router.get("/stats/summary")
async def get_cleaning_stats(db: Session = Depends(get_rh_db)):
    """
    Статистика по статусам чистки
    """
    result = db.execute(text("""
        SELECT status, COUNT(*) as count
        FROM product_cleaning_status
        GROUP BY status
    """))
    
    stats = {
        "clean": 0,
        "wash": 0,
        "dry": 0,
        "repair": 0
    }
    
    for row in result:
        stats[row[0]] = row[1]
    
    return stats
