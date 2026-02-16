"""
Client Users API - CRUD для клієнтів/контактів
Один email = один клієнт
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from datetime import datetime
import logging

from database_rentalhub import get_rh_db

router = APIRouter(prefix="/api/clients", tags=["clients"])
logger = logging.getLogger(__name__)


# ============================================================================
# SCHEMAS
# ============================================================================

class ClientCreate(BaseModel):
    email: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    company_hint: Optional[str] = None
    notes: Optional[str] = None
    preferred_contact: Optional[str] = None  # telegram/viber/whatsapp/email/phone
    source: Optional[str] = "rentalhub"
    payer_type: Optional[str] = "individual"  # individual, fop, fop_simple, tov
    tax_id: Optional[str] = None  # ЄДРПОУ / ІПН

class ClientUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    company_hint: Optional[str] = None
    notes: Optional[str] = None
    preferred_contact: Optional[str] = None
    is_active: Optional[bool] = None
    payer_type: Optional[str] = None
    tax_id: Optional[str] = None
    bank_details: Optional[dict] = None  # {bank_name, iban, mfo}

class ClientResponse(BaseModel):
    id: int
    email: str
    email_normalized: str
    full_name: Optional[str]
    phone: Optional[str]
    company_hint: Optional[str]
    source: Optional[str]
    notes: Optional[str]
    preferred_contact: Optional[str]
    is_active: bool
    created_at: Optional[str]
    updated_at: Optional[str]
    # Нові поля платника
    payer_type: Optional[str] = "individual"
    tax_id: Optional[str] = None
    bank_details: Optional[dict] = None
    # MA info
    has_agreement: Optional[bool] = False
    agreement_status: Optional[str] = None
    agreement_number: Optional[str] = None
    # Статистика
    orders_count: Optional[int] = 0
    payers_count: Optional[int] = 0
    default_payer_id: Optional[int] = None
    default_payer_name: Optional[str] = None


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("")
async def list_clients(
    search: Optional[str] = None,
    source: Optional[str] = None,
    has_payer: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_rh_db)
):
    """Список клієнтів з пошуком та фільтрами"""
    
    sql = """
        SELECT 
            c.id, c.email, c.email_normalized, c.full_name, c.phone,
            c.company_hint, c.source, c.notes, c.preferred_contact,
            c.is_active, c.created_at, c.updated_at,
            c.payer_type, c.tax_id, c.bank_details,
            COUNT(DISTINCT o.order_id) as orders_count,
            COUNT(DISTINCT cpl.payer_profile_id) as payers_count,
            (SELECT payer_profile_id FROM client_payer_links 
             WHERE client_user_id = c.id AND is_default = TRUE LIMIT 1) as default_payer_id,
            ma.id as ma_id, ma.contract_number as ma_number, ma.status as ma_status
        FROM client_users c
        LEFT JOIN orders o ON o.client_user_id = c.id
        LEFT JOIN client_payer_links cpl ON cpl.client_user_id = c.id
        LEFT JOIN master_agreements ma ON ma.client_user_id = c.id 
            AND ma.status IN ('draft', 'sent', 'signed')
            AND (ma.valid_until IS NULL OR ma.valid_until >= CURDATE())
        WHERE 1=1
    """
    params = {}
    
    if search:
        sql += """ AND (
            c.email LIKE :search OR 
            c.full_name LIKE :search OR 
            c.phone LIKE :search OR
            c.company_hint LIKE :search
        )"""
        params["search"] = f"%{search}%"
    
    if source:
        sql += " AND c.source = :source"
        params["source"] = source
    
    sql += " GROUP BY c.id ORDER BY c.updated_at DESC LIMIT :limit OFFSET :skip"
    params["limit"] = limit
    params["skip"] = skip
    
    result = db.execute(text(sql), params)
    
    clients = []
    for row in result:
        clients.append({
            "id": row[0],
            "email": row[1],
            "email_normalized": row[2],
            "full_name": row[3],
            "phone": row[4],
            "company_hint": row[5],
            "source": row[6],
            "notes": row[7],
            "preferred_contact": row[8],
            "is_active": bool(row[9]),
            "created_at": row[10].isoformat() if row[10] else None,
            "updated_at": row[11].isoformat() if row[11] else None,
            "orders_count": row[12] or 0,
            "payers_count": row[13] or 0,
            "default_payer_id": row[14]
        })
    
    # Фільтр has_payer після агрегації
    if has_payer is not None:
        if has_payer:
            clients = [c for c in clients if c["payers_count"] > 0]
        else:
            clients = [c for c in clients if c["payers_count"] == 0]
    
    return clients


@router.get("/{client_id}")
async def get_client(client_id: int, db: Session = Depends(get_rh_db)):
    """Отримати клієнта за ID з усіма деталями"""
    
    result = db.execute(text("""
        SELECT 
            c.id, c.email, c.email_normalized, c.full_name, c.phone,
            c.company_hint, c.source, c.notes, c.preferred_contact,
            c.is_active, c.created_at, c.updated_at
        FROM client_users c
        WHERE c.id = :id
    """), {"id": client_id})
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Клієнта не знайдено")
    
    client = {
        "id": row[0],
        "email": row[1],
        "email_normalized": row[2],
        "full_name": row[3],
        "phone": row[4],
        "company_hint": row[5],
        "source": row[6],
        "notes": row[7],
        "preferred_contact": row[8],
        "is_active": bool(row[9]),
        "created_at": row[10].isoformat() if row[10] else None,
        "updated_at": row[11].isoformat() if row[11] else None
    }
    
    # Отримати платників клієнта
    payers_result = db.execute(text("""
        SELECT 
            pp.id, pp.type, pp.display_name, pp.tax_mode, pp.edrpou,
            cpl.is_default, cpl.label
        FROM client_payer_links cpl
        JOIN payer_profiles pp ON pp.id = cpl.payer_profile_id
        WHERE cpl.client_user_id = :client_id AND pp.is_active = TRUE
        ORDER BY cpl.is_default DESC, pp.display_name
    """), {"client_id": client_id})
    
    client["payers"] = [{
        "id": p[0],
        "type": p[1],
        "display_name": p[2],
        "tax_mode": p[3],
        "edrpou": p[4],
        "is_default": bool(p[5]),
        "label": p[6]
    } for p in payers_result]
    
    # Отримати останні замовлення
    orders_result = db.execute(text("""
        SELECT 
            o.order_id, o.order_number, o.status, o.total_price,
            o.rental_start_date, o.created_at, o.source,
            pp.display_name as payer_name
        FROM orders o
        LEFT JOIN payer_profiles pp ON pp.id = o.payer_profile_id
        WHERE o.client_user_id = :client_id
        ORDER BY o.created_at DESC
        LIMIT 10
    """), {"client_id": client_id})
    
    client["recent_orders"] = [{
        "order_id": o[0],
        "order_number": o[1],
        "status": o[2],
        "total_price": float(o[3]) if o[3] else 0,
        "rental_start_date": o[4].isoformat() if o[4] else None,
        "created_at": o[5].isoformat() if o[5] else None,
        "source": o[6],
        "payer_name": o[7]
    } for o in orders_result]
    
    # Статистика
    stats = db.execute(text("""
        SELECT 
            COUNT(*) as total_orders,
            SUM(CASE WHEN source = 'event_tool' THEN 1 ELSE 0 END) as event_orders,
            SUM(CASE WHEN source = 'opencart' OR source IS NULL THEN 1 ELSE 0 END) as oc_orders
        FROM orders WHERE client_user_id = :client_id
    """), {"client_id": client_id}).fetchone()
    
    client["stats"] = {
        "total_orders": stats[0] or 0,
        "event_orders": stats[1] or 0,
        "oc_orders": stats[2] or 0
    }
    
    return client


@router.post("")
async def create_client(data: ClientCreate, db: Session = Depends(get_rh_db)):
    """Створити нового клієнта"""
    
    email_normalized = data.email.lower().strip()
    
    # Перевірити чи email вже існує
    existing = db.execute(text("""
        SELECT id FROM client_users WHERE email_normalized = :email
    """), {"email": email_normalized}).fetchone()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Клієнт з email {data.email} вже існує (ID: {existing[0]})"
        )
    
    db.execute(text("""
        INSERT INTO client_users 
        (email, email_normalized, full_name, phone, company_hint, notes, preferred_contact, source)
        VALUES 
        (:email, :email_norm, :name, :phone, :company, :notes, :contact, :source)
    """), {
        "email": data.email,
        "email_norm": email_normalized,
        "name": data.full_name,
        "phone": data.phone,
        "company": data.company_hint,
        "notes": data.notes,
        "contact": data.preferred_contact,
        "source": data.source or "rentalhub"
    })
    db.commit()
    
    # Отримати створеного клієнта
    result = db.execute(text("""
        SELECT id FROM client_users WHERE email_normalized = :email
    """), {"email": email_normalized}).fetchone()
    
    logger.info(f"✅ Created client: {email_normalized} (ID: {result[0]})")
    
    return await get_client(result[0], db)


@router.patch("/{client_id}")
async def update_client(client_id: int, data: ClientUpdate, db: Session = Depends(get_rh_db)):
    """Оновити клієнта"""
    
    # Перевірити існування
    existing = db.execute(text("SELECT id FROM client_users WHERE id = :id"), {"id": client_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Клієнта не знайдено")
    
    updates = []
    params = {"id": client_id}
    
    if data.full_name is not None:
        updates.append("full_name = :name")
        params["name"] = data.full_name
    if data.phone is not None:
        updates.append("phone = :phone")
        params["phone"] = data.phone
    if data.company_hint is not None:
        updates.append("company_hint = :company")
        params["company"] = data.company_hint
    if data.notes is not None:
        updates.append("notes = :notes")
        params["notes"] = data.notes
    if data.preferred_contact is not None:
        updates.append("preferred_contact = :contact")
        params["contact"] = data.preferred_contact
    if data.is_active is not None:
        updates.append("is_active = :active")
        params["active"] = data.is_active
    
    if updates:
        sql = f"UPDATE client_users SET {', '.join(updates)} WHERE id = :id"
        db.execute(text(sql), params)
        db.commit()
    
    return await get_client(client_id, db)


@router.get("/{client_id}/payers")
async def get_client_payers(client_id: int, db: Session = Depends(get_rh_db)):
    """Отримати платників клієнта"""
    
    result = db.execute(text("""
        SELECT 
            pp.id, pp.type, pp.display_name, pp.tax_mode, pp.details_json,
            pp.legal_name, pp.edrpou, pp.iban, pp.email_for_docs, pp.phone_for_docs,
            pp.signatory_name, pp.signatory_basis, pp.is_active, pp.created_at,
            cpl.is_default, cpl.label
        FROM client_payer_links cpl
        JOIN payer_profiles pp ON pp.id = cpl.payer_profile_id
        WHERE cpl.client_user_id = :client_id
        ORDER BY cpl.is_default DESC, pp.display_name
    """), {"client_id": client_id})
    
    return [{
        "id": row[0],
        "type": row[1],
        "display_name": row[2],
        "tax_mode": row[3],
        "details_json": row[4],
        "legal_name": row[5],
        "edrpou": row[6],
        "iban": row[7],
        "email_for_docs": row[8],
        "phone_for_docs": row[9],
        "signatory_name": row[10],
        "signatory_basis": row[11],
        "is_active": bool(row[12]),
        "created_at": row[13].isoformat() if row[13] else None,
        "is_default": bool(row[14]),
        "label": row[15]
    } for row in result]


@router.post("/{client_id}/payers/{payer_id}/link")
async def link_payer_to_client(
    client_id: int, 
    payer_id: int, 
    is_default: bool = False,
    label: Optional[str] = None,
    db: Session = Depends(get_rh_db)
):
    """Прив'язати платника до клієнта"""
    
    # Перевірити існування
    client = db.execute(text("SELECT id FROM client_users WHERE id = :id"), {"id": client_id}).fetchone()
    if not client:
        raise HTTPException(status_code=404, detail="Клієнта не знайдено")
    
    payer = db.execute(text("SELECT id FROM payer_profiles WHERE id = :id"), {"id": payer_id}).fetchone()
    if not payer:
        raise HTTPException(status_code=404, detail="Платника не знайдено")
    
    # Перевірити чи вже є зв'язок
    existing = db.execute(text("""
        SELECT id FROM client_payer_links 
        WHERE client_user_id = :client AND payer_profile_id = :payer
    """), {"client": client_id, "payer": payer_id}).fetchone()
    
    if existing:
        # Оновити
        db.execute(text("""
            UPDATE client_payer_links 
            SET is_default = :default, label = :label
            WHERE id = :id
        """), {"id": existing[0], "default": is_default, "label": label})
    else:
        # Створити
        db.execute(text("""
            INSERT INTO client_payer_links (client_user_id, payer_profile_id, is_default, label)
            VALUES (:client, :payer, :default, :label)
        """), {"client": client_id, "payer": payer_id, "default": is_default, "label": label})
    
    # Якщо is_default - зняти з інших
    if is_default:
        db.execute(text("""
            UPDATE client_payer_links 
            SET is_default = FALSE 
            WHERE client_user_id = :client AND payer_profile_id != :payer
        """), {"client": client_id, "payer": payer_id})
    
    db.commit()
    
    return {"success": True, "message": "Платника прив'язано"}


@router.delete("/{client_id}/payers/{payer_id}/unlink")
async def unlink_payer_from_client(client_id: int, payer_id: int, db: Session = Depends(get_rh_db)):
    """Відв'язати платника від клієнта"""
    
    result = db.execute(text("""
        DELETE FROM client_payer_links 
        WHERE client_user_id = :client AND payer_profile_id = :payer
    """), {"client": client_id, "payer": payer_id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Зв'язок не знайдено")
    
    return {"success": True, "message": "Платника відв'язано"}


@router.get("/resolve/by-email")
async def resolve_client_by_email(email: str, db: Session = Depends(get_rh_db)):
    """
    Знайти або отримати інформацію про клієнта по email.
    Використовується при checkout в EventTool.
    
    Повертає:
    - exists: чи існує клієнт
    - client: дані клієнта (id, name, phone, email)
    - payers: список платників [{id, type, display_name, tax_mode, is_default}]
    - default_payer_id: ID платника за замовчуванням
    """
    email_normalized = email.lower().strip()
    
    if not email_normalized or '@' not in email_normalized:
        return {
            "exists": False,
            "email": email,
            "error": "Invalid email format"
        }
    
    result = db.execute(text("""
        SELECT id, email, full_name, phone, company_hint, source
        FROM client_users 
        WHERE email_normalized = :email
    """), {"email": email_normalized}).fetchone()
    
    if not result:
        return {
            "exists": False,
            "email": email,
            "email_normalized": email_normalized,
            "client": None,
            "payers": [],
            "default_payer_id": None
        }
    
    client_id = result[0]
    
    # Отримати платників
    payers_result = db.execute(text("""
        SELECT 
            pp.id, pp.type, pp.display_name, pp.tax_mode, pp.edrpou,
            cpl.is_default
        FROM client_payer_links cpl
        JOIN payer_profiles pp ON pp.id = cpl.payer_profile_id
        WHERE cpl.client_user_id = :client_id AND pp.is_active = TRUE
        ORDER BY cpl.is_default DESC, pp.display_name
    """), {"client_id": client_id})
    
    payers = []
    default_payer_id = None
    for p in payers_result:
        payer = {
            "id": p[0],
            "type": p[1],
            "display_name": p[2],
            "tax_mode": p[3],
            "edrpou": p[4],
            "is_default": bool(p[5])
        }
        payers.append(payer)
        if payer["is_default"]:
            default_payer_id = payer["id"]
    
    return {
        "exists": True,
        "client_user_id": client_id,
        "client": {
            "id": client_id,
            "email": result[1],
            "full_name": result[2],
            "phone": result[3],
            "company_hint": result[4],
            "source": result[5]
        },
        "payers": payers,
        "default_payer_id": default_payer_id,
        "payer_status": "ok" if any(p["type"] != "pending" for p in payers) else ("pending" if payers else "missing")
    }
