"""
Database migrations API endpoint
Safe way to run database schema changes
"""
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from database_rentalhub import get_rh_db_sync
import logging

router = APIRouter(prefix="/api/migrations", tags=["migrations"])
logger = logging.getLogger(__name__)


@router.post("/add-manager-fields")
async def add_manager_fields_to_orders():
    """
    Add manager_comment and damage_fee columns to orders table
    Safe to run multiple times - checks if columns exist first
    """
    try:
        db = get_rh_db_sync()
        
        # Check if columns already exist
        check_query = text("""
            SELECT COUNT(*) as count
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'orders' 
            AND COLUMN_NAME IN ('manager_comment', 'damage_fee')
        """)
        
        result = db.execute(check_query).fetchone()
        existing_columns = result[0] if result else 0
        
        if existing_columns == 2:
            logger.info("Columns manager_comment and damage_fee already exist")
            db.close()
            return {
                "success": True,
                "message": "Колонки вже існують",
                "columns_added": 0
            }
        
        # Add columns if they don't exist
        columns_added = []
        
        # Add manager_comment if not exists
        if existing_columns == 0 or existing_columns == 1:
            try:
                check_manager = text("""
                    SELECT COUNT(*) 
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'orders' 
                    AND COLUMN_NAME = 'manager_comment'
                """)
                has_manager = db.execute(check_manager).fetchone()[0]
                
                if not has_manager:
                    alter_manager = text("ALTER TABLE orders ADD COLUMN manager_comment TEXT")
                    db.execute(alter_manager)
                    db.commit()
                    columns_added.append('manager_comment')
                    logger.info("Added column: manager_comment")
            except Exception as e:
                logger.error(f"Error adding manager_comment: {str(e)}")
                db.rollback()
                raise
        
        # Add damage_fee if not exists
        if existing_columns == 0 or existing_columns == 1:
            try:
                check_fee = text("""
                    SELECT COUNT(*) 
                    FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE()
                    AND TABLE_NAME = 'orders' 
                    AND COLUMN_NAME = 'damage_fee'
                """)
                has_fee = db.execute(check_fee).fetchone()[0]
                
                if not has_fee:
                    alter_fee = text("ALTER TABLE orders ADD COLUMN damage_fee DECIMAL(10, 2) DEFAULT 0.00")
                    db.execute(alter_fee)
                    db.commit()
                    columns_added.append('damage_fee')
                    logger.info("Added column: damage_fee")
            except Exception as e:
                logger.error(f"Error adding damage_fee: {str(e)}")
                db.rollback()
                raise
        
        db.close()
        
        return {
            "success": True,
            "message": f"Міграція успішна! Додано колонок: {len(columns_added)}",
            "columns_added": columns_added
        }
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Помилка міграції: {str(e)}"
        )


@router.get("/check-schema")
async def check_orders_schema():
    """
    Check current schema of orders table
    """
    try:
        db = get_rh_db_sync()
        
        query = text("""
            SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'orders'
            ORDER BY ORDINAL_POSITION
        """)
        
        result = db.execute(query).fetchall()
        
        columns = [
            {
                "name": row[0],
                "type": row[1],
                "nullable": row[2],
                "default": row[3]
            }
            for row in result
        ]
        
        db.close()
        
        return {
            "table": "orders",
            "total_columns": len(columns),
            "columns": columns
        }
        
    except Exception as e:
        logger.error(f"Schema check failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Помилка перевірки схеми: {str(e)}"
        )
