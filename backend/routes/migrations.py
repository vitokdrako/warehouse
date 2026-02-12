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


@router.post("/finance-hub-v2")
async def migrate_finance_hub_v2():
    """
    Finance Hub 2.0 - Міграція для підтримки:
    - deal_mode в orders (rent/sale)
    - Розширення fin_payments для advance/discount
    - Оптимізовані індекси
    
    Safe to run multiple times.
    """
    try:
        db = get_rh_db_sync()
        results = []
        
        # === 1. ADD deal_mode TO orders ===
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' 
                AND COLUMN_NAME = 'deal_mode'
            """)).scalar()
            
            if not check:
                db.execute(text("""
                    ALTER TABLE orders 
                    ADD COLUMN deal_mode VARCHAR(20) DEFAULT 'rent' 
                    COMMENT 'rent=оренда, sale=продаж'
                """))
                db.commit()
                results.append("deal_mode: added to orders")
            else:
                results.append("deal_mode: already exists")
        except Exception as e:
            results.append(f"deal_mode: error - {str(e)}")
            db.rollback()
        
        # === 2. ADD INDEX on fin_payments (order_id, payment_type) ===
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.STATISTICS 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fin_payments' 
                AND INDEX_NAME = 'idx_payments_order_type'
            """)).scalar()
            
            if not check:
                db.execute(text("""
                    CREATE INDEX idx_payments_order_type 
                    ON fin_payments(order_id, payment_type)
                """))
                db.commit()
                results.append("idx_payments_order_type: created")
            else:
                results.append("idx_payments_order_type: already exists")
        except Exception as e:
            results.append(f"idx_payments_order_type: error - {str(e)}")
            db.rollback()
        
        # === 3. ADD INDEX on fin_payments (payment_type, method, status) for stats ===
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.STATISTICS 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fin_payments' 
                AND INDEX_NAME = 'idx_payments_stats'
            """)).scalar()
            
            if not check:
                db.execute(text("""
                    CREATE INDEX idx_payments_stats 
                    ON fin_payments(payment_type, method, status)
                """))
                db.commit()
                results.append("idx_payments_stats: created")
            else:
                results.append("idx_payments_stats: already exists")
        except Exception as e:
            results.append(f"idx_payments_stats: error - {str(e)}")
            db.rollback()
        
        # === 4. ADD INDEX on fin_expenses for category aggregation ===
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.STATISTICS 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fin_expenses' 
                AND INDEX_NAME = 'idx_expenses_category_method'
            """)).scalar()
            
            if not check:
                db.execute(text("""
                    CREATE INDEX idx_expenses_category_method 
                    ON fin_expenses(category_id, method)
                """))
                db.commit()
                results.append("idx_expenses_category_method: created")
            else:
                results.append("idx_expenses_category_method: already exists")
        except Exception as e:
            results.append(f"idx_expenses_category_method: error - {str(e)}")
            db.rollback()
        
        # === 5. Ensure 'advance' payment type works ===
        # fin_payments.payment_type is VARCHAR, no enum migration needed
        results.append("payment_type 'advance': VARCHAR field supports it")
        
        db.close()
        
        return {
            "success": True,
            "migration": "finance-hub-v2",
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Finance Hub V2 migration failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Помилка міграції: {str(e)}"
        )


@router.post("/documents-engine-v3")
async def migrate_documents_engine_v3():
    """
    Phase 3: Documents Engine Migration
    
    Creates:
    - master_agreements table (рамкові договори)
    - order_annexes table (додатки до замовлень)
    - Updates documents table (snapshot_json, is_legal, etc.)
    - Updates orders table (active_annex_id)
    
    Safe to run multiple times.
    """
    try:
        db = get_rh_db_sync()
        results = []
        
        # === 1. CREATE master_agreements TABLE ===
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'master_agreements'
            """)).scalar()
            
            if not check:
                db.execute(text("""
                    CREATE TABLE master_agreements (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        payer_profile_id INT NOT NULL,
                        contract_number VARCHAR(50) NOT NULL UNIQUE,
                        template_version VARCHAR(20) DEFAULT 'v1',
                        signed_at DATETIME NULL,
                        valid_from DATE NOT NULL,
                        valid_until DATE NOT NULL,
                        status ENUM('draft', 'sent', 'signed', 'expired', 'cancelled') DEFAULT 'draft',
                        snapshot_json JSON,
                        pdf_path VARCHAR(500),
                        note TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        
                        INDEX idx_ma_payer (payer_profile_id),
                        INDEX idx_ma_status (status),
                        INDEX idx_ma_valid (valid_until),
                        
                        CONSTRAINT fk_ma_payer FOREIGN KEY (payer_profile_id) 
                            REFERENCES payer_profiles(id) ON DELETE RESTRICT
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 
                    COMMENT='Рамкові договори (Phase 3)'
                """))
                db.commit()
                results.append("master_agreements: created")
            else:
                results.append("master_agreements: already exists")
        except Exception as e:
            results.append(f"master_agreements: error - {str(e)}")
            db.rollback()
        
        # === 2. CREATE order_annexes TABLE ===
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_annexes'
            """)).scalar()
            
            if not check:
                db.execute(text("""
                    CREATE TABLE order_annexes (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        order_id INT NOT NULL,
                        master_agreement_id INT NOT NULL,
                        annex_number VARCHAR(50) NOT NULL,
                        version INT DEFAULT 1,
                        snapshot_json JSON,
                        pdf_path VARCHAR(500),
                        status ENUM('draft', 'generated', 'signed') DEFAULT 'draft',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        
                        INDEX idx_annex_order (order_id),
                        INDEX idx_annex_agreement (master_agreement_id),
                        UNIQUE KEY uk_annex_order_version (order_id, version),
                        
                        CONSTRAINT fk_annex_order FOREIGN KEY (order_id) 
                            REFERENCES orders(order_id) ON DELETE CASCADE,
                        CONSTRAINT fk_annex_agreement FOREIGN KEY (master_agreement_id) 
                            REFERENCES master_agreements(id) ON DELETE RESTRICT
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 
                    COMMENT='Додатки до договорів (Phase 3)'
                """))
                db.commit()
                results.append("order_annexes: created")
            else:
                results.append("order_annexes: already exists")
        except Exception as e:
            results.append(f"order_annexes: error - {str(e)}")
            db.rollback()
        
        # === 3. ADD active_annex_id TO orders ===
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' 
                AND COLUMN_NAME = 'active_annex_id'
            """)).scalar()
            
            if not check:
                db.execute(text("""
                    ALTER TABLE orders 
                    ADD COLUMN active_annex_id INT NULL 
                    COMMENT 'Активний додаток до договору'
                """))
                db.commit()
                results.append("orders.active_annex_id: added")
            else:
                results.append("orders.active_annex_id: already exists")
        except Exception as e:
            results.append(f"orders.active_annex_id: error - {str(e)}")
            db.rollback()
        
        # === 4. ADD snapshot_json TO documents ===
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' 
                AND COLUMN_NAME = 'snapshot_json'
            """)).scalar()
            
            if not check:
                db.execute(text("""
                    ALTER TABLE documents 
                    ADD COLUMN snapshot_json JSON COMMENT 'Immutable snapshot of document data'
                """))
                db.commit()
                results.append("documents.snapshot_json: added")
            else:
                results.append("documents.snapshot_json: already exists")
        except Exception as e:
            results.append(f"documents.snapshot_json: error - {str(e)}")
            db.rollback()
        
        # === 5. ADD is_legal TO documents ===
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' 
                AND COLUMN_NAME = 'is_legal'
            """)).scalar()
            
            if not check:
                db.execute(text("""
                    ALTER TABLE documents 
                    ADD COLUMN is_legal BOOLEAN DEFAULT FALSE 
                    COMMENT 'TRUE = юридичний документ'
                """))
                db.commit()
                results.append("documents.is_legal: added")
            else:
                results.append("documents.is_legal: already exists")
        except Exception as e:
            results.append(f"documents.is_legal: error - {str(e)}")
            db.rollback()
        
        # === 6. ADD category TO documents ===
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' 
                AND COLUMN_NAME = 'category'
            """)).scalar()
            
            if not check:
                db.execute(text("""
                    ALTER TABLE documents 
                    ADD COLUMN category VARCHAR(50) DEFAULT 'quote' 
                    COMMENT 'quote|contract|annex|act|finance|operations'
                """))
                db.commit()
                results.append("documents.category: added")
            else:
                results.append("documents.category: already exists")
        except Exception as e:
            results.append(f"documents.category: error - {str(e)}")
            db.rollback()
        
        # === 7. ADD master_agreement_id TO documents ===
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' 
                AND COLUMN_NAME = 'master_agreement_id'
            """)).scalar()
            
            if not check:
                db.execute(text("""
                    ALTER TABLE documents 
                    ADD COLUMN master_agreement_id INT NULL 
                    COMMENT 'Reference to master agreement'
                """))
                db.commit()
                results.append("documents.master_agreement_id: added")
            else:
                results.append("documents.master_agreement_id: already exists")
        except Exception as e:
            results.append(f"documents.master_agreement_id: error - {str(e)}")
            db.rollback()
        
        # === 8. ADD annex_id TO documents ===
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' 
                AND COLUMN_NAME = 'annex_id'
            """)).scalar()
            
            if not check:
                db.execute(text("""
                    ALTER TABLE documents 
                    ADD COLUMN annex_id INT NULL 
                    COMMENT 'Reference to order annex'
                """))
                db.commit()
                results.append("documents.annex_id: added")
            else:
                results.append("documents.annex_id: already exists")
        except Exception as e:
            results.append(f"documents.annex_id: error - {str(e)}")
            db.rollback()
        
        # === 9. CREATE document_emails TABLE ===
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_emails'
            """)).scalar()
            
            if not check:
                db.execute(text("""
                    CREATE TABLE document_emails (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        document_id VARCHAR(100) NOT NULL,
                        sent_to VARCHAR(255) NOT NULL,
                        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        status ENUM('sent', 'failed', 'opened') DEFAULT 'sent',
                        error_message TEXT,
                        
                        INDEX idx_de_document (document_id),
                        INDEX idx_de_sent_at (sent_at)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 
                    COMMENT='Email log for documents'
                """))
                db.commit()
                results.append("document_emails: created")
            else:
                results.append("document_emails: already exists")
        except Exception as e:
            results.append(f"document_emails: error - {str(e)}")
            db.rollback()
        
        # === 10. CREATE document_signatures TABLE (for future) ===
        try:
            check = db.execute(text("""
                SELECT COUNT(*) FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'document_signatures'
            """)).scalar()
            
            if not check:
                db.execute(text("""
                    CREATE TABLE document_signatures (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        document_id VARCHAR(100) NOT NULL,
                        signature_image MEDIUMTEXT COMMENT 'Base64 signature',
                        signer_name VARCHAR(255),
                        signer_role VARCHAR(100),
                        signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        ip_address VARCHAR(50),
                        user_agent TEXT,
                        
                        INDEX idx_ds_document (document_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 
                    COMMENT='Digital signatures for documents'
                """))
                db.commit()
                results.append("document_signatures: created")
            else:
                results.append("document_signatures: already exists")
        except Exception as e:
            results.append(f"document_signatures: error - {str(e)}")
            db.rollback()
        
        db.close()
        
        return {
            "success": True,
            "migration": "documents-engine-v3",
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Documents Engine V3 migration failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Помилка міграції: {str(e)}"
        )


@router.post("/payment-annex-linking")
async def migrate_payment_annex_linking():
    """
    Phase 3.2: Add annex_id to fin_payments for legal linking
    
    - Adds annex_id column to fin_payments
    - Creates index for efficient lookups
    """
    try:
        from database_rentalhub import get_rh_db_sync
        db = get_rh_db_sync()
        results = []
        
        # === 1. ADD annex_id TO fin_payments ===
        try:
            check = db.execute(text("""
                SELECT 1 FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'fin_payments'
                AND COLUMN_NAME = 'annex_id'
            """)).fetchone()
            
            if not check:
                db.execute(text("""
                    ALTER TABLE fin_payments 
                    ADD COLUMN annex_id INT NULL 
                    COMMENT 'Link to order_annexes for legal documents',
                    ADD INDEX idx_payments_annex (annex_id)
                """))
                db.commit()
                results.append("fin_payments.annex_id: added")
            else:
                results.append("fin_payments.annex_id: already exists")
        except Exception as e:
            results.append(f"fin_payments.annex_id: error - {str(e)}")
            db.rollback()
        
        # === 2. ADD document_version TO document_emails ===
        try:
            check = db.execute(text("""
                SELECT 1 FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'document_emails'
                AND COLUMN_NAME = 'document_version'
            """)).fetchone()
            
            if not check:
                db.execute(text("""
                    ALTER TABLE document_emails 
                    ADD COLUMN document_version INT DEFAULT 1,
                    ADD COLUMN sent_by_user_id INT NULL,
                    ADD COLUMN sent_by_user_name VARCHAR(255)
                """))
                db.commit()
                results.append("document_emails: added version/user columns")
            else:
                results.append("document_emails: columns already exist")
        except Exception as e:
            results.append(f"document_emails: error - {str(e)}")
            db.rollback()
        
        db.close()
        
        return {
            "success": True,
            "migration": "payment-annex-linking",
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Payment-Annex Linking migration failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Помилка міграції: {str(e)}"
        )
