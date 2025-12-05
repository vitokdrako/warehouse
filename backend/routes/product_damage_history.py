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


@router.post("/")
async def create_damage_record(
    damage_data: dict,
    db: Session = Depends(get_rh_db)
):
    """
    Створити запис про пошкодження
    
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
    - fee: Сума збитку
    - photo_url: URL фото (опціонально)
    - note: Примітка (опціонально)
    - created_by: Хто зафіксував (опціонально)
    """
    try:
        damage_id = str(uuid.uuid4())
        
        db.execute(text("""
            INSERT INTO product_damage_history (
                id, product_id, sku, product_name, category,
                order_id, order_number, stage,
                damage_type, damage_code, severity, fee,
                photo_url, note, created_by, created_at
            ) VALUES (
                :id, :product_id, :sku, :product_name, :category,
                :order_id, :order_number, :stage,
                :damage_type, :damage_code, :severity, :fee,
                :photo_url, :note, :created_by, NOW()
            )
        """), {
            "id": damage_id,
            "product_id": damage_data.get("product_id"),
            "sku": damage_data.get("sku"),
            "product_name": damage_data.get("product_name"),
            "category": damage_data.get("category"),
            "order_id": damage_data.get("order_id"),
            "order_number": damage_data.get("order_number"),
            "stage": damage_data.get("stage", "return"),
            "damage_type": damage_data.get("damage_type"),
            "damage_code": damage_data.get("damage_code"),
            "severity": damage_data.get("severity", "low"),
            "fee": damage_data.get("fee", 0.0),
            "photo_url": damage_data.get("photo_url"),
            "note": damage_data.get("note"),
            "created_by": damage_data.get("created_by", "system")
        })
        
        db.commit()
        
        return {
            "success": True,
            "message": "Пошкодження зафіксовано",
            "damage_id": damage_id
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
                photo_url, note, created_by, created_at
            FROM product_damage_history
            WHERE product_id = :product_id
            ORDER BY created_at DESC
        """), {"product_id": product_id})
        
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
                photo_url, note, created_by, created_at
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
            LEFT JOIN products p ON p.sku = pdh.sku
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
