"""
Documents API - генерація, перегляд та управління документами
"""
from fastapi import APIRouter, Depends, HTTPException, Response, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from typing import Optional, List
import json

from database_rentalhub import get_rh_db
from services.doc_engine.registry import DOC_REGISTRY, get_doc_config, get_docs_for_entity
from services.doc_engine.data_builders import build_document_data
from services.doc_engine.render import render_html, render_pdf, get_template_path
from services.doc_engine.numbering import generate_doc_number

router = APIRouter(prefix="/api/documents", tags=["documents"])


# ============ Довідники ============

@router.get("/types")
async def list_document_types():
    """Список всіх типів документів"""
    return [
        {"doc_type": key, **value}
        for key, value in DOC_REGISTRY.items()
    ]

@router.get("/types/{entity_type}")
async def list_documents_for_entity(entity_type: str):
    """Список документів для типу сутності (order, issue, return, damage_case)"""
    return get_docs_for_entity(entity_type)


# ============ Генерація документів ============

from pydantic import BaseModel
from typing import Optional

class GenerateDocumentRequest(BaseModel):
    doc_type: str
    entity_id: str
    format: Optional[str] = "html"
    options: Optional[dict] = None

@router.post("/generate")
async def generate_document(
    request: GenerateDocumentRequest,
    db: Session = Depends(get_rh_db)
):
    """
    Генерує новий документ.
    
    Args:
        doc_type: Тип документа (invoice_offer, contract_rent, etc.)
        entity_id: ID сутності (order_id, issue_card_id, etc.)
        format: Формат виводу (html, pdf)
        options: Додаткові опції (lang, notes, etc.)
    
    Returns:
        Інформація про згенерований документ
    """
    doc_type = request.doc_type
    entity_id = request.entity_id
    options = request.options
    try:
        # Отримуємо конфігурацію
        config = get_doc_config(doc_type)
        
        # Генеруємо номер документа
        doc_number = generate_doc_number(db, config["series"])
        
        # Збираємо дані
        data = build_document_data(db, doc_type, entity_id, options or {})
        data["doc_number"] = doc_number
        
        # Рендеримо HTML
        template_path = get_template_path(doc_type, "v1", options.get("lang", "uk") if options else "uk")
        html_content = render_html(template_path, data)
        
        # Зберігаємо в БД
        doc_id = save_document(
            db=db,
            doc_type=doc_type,
            doc_number=doc_number,
            entity_type=config["entity_type"],
            entity_id=entity_id,
            data_snapshot=data,
            html_content=html_content,
            options=options
        )
        
        # Повертаємо результат з HTML контентом
        result = {
            "success": True,
            "document_id": doc_id,
            "doc_number": doc_number,
            "doc_type": doc_type,
            "entity_id": entity_id,
            "preview_url": f"/api/documents/{doc_id}/preview",
            "download_url": f"/api/documents/{doc_id}/pdf",
            "html_content": html_content  # Додаємо HTML для прямого рендерингу
        }
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка генерації: {str(e)}")


@router.get("/{document_id}/preview", response_class=HTMLResponse)
async def preview_document(document_id: str, db: Session = Depends(get_rh_db)):
    """Повертає HTML-превʼю документа"""
    
    doc = get_document_by_id(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не знайдено")
    
    return HTMLResponse(content=doc["html_content"])


@router.get("/{document_id}/pdf")
async def download_pdf(document_id: str, db: Session = Depends(get_rh_db)):
    """Повертає PDF документа"""
    
    doc = get_document_by_id(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не знайдено")
    
    # Генеруємо PDF з HTML
    pdf_bytes = render_pdf(doc["html_content"])
    
    filename = f"{doc['doc_number']}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/{document_id}")
async def get_document(document_id: str, db: Session = Depends(get_rh_db)):
    """Отримує інформацію про документ включаючи html_content"""
    
    doc = get_document_by_id(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не знайдено")
    
    return {
        "id": doc["id"],
        "doc_type": doc["doc_type"],
        "doc_number": doc["doc_number"],
        "entity_type": doc["entity_type"],
        "entity_id": doc["entity_id"],
        "version": doc["version"],
        "status": doc["status"],
        "signed_at": doc["signed_at"],
        "created_at": doc["created_at"],
        "html_content": doc.get("html_content", ""),
        "preview_url": f"/api/documents/{doc['id']}/preview",
        "pdf_url": f"/api/documents/{doc['id']}/pdf"
    }


# ============ Список документів для сутності ============

@router.get("/entity/{entity_type}/{entity_id}")
async def list_entity_documents(
    entity_type: str, 
    entity_id: str, 
    db: Session = Depends(get_rh_db)
):
    """Список документів для конкретної сутності"""
    
    result = db.execute(text("""
        SELECT id, doc_type, doc_number, version, status, signed_at, created_at
        FROM documents
        WHERE entity_type = :entity_type AND entity_id = :entity_id
        ORDER BY created_at DESC
    """), {"entity_type": entity_type, "entity_id": entity_id})
    
    documents = []
    for row in result:
        config = DOC_REGISTRY.get(row[1], {})
        documents.append({
            "id": row[0],
            "doc_type": row[1],
            "doc_type_name": config.get("name", row[1]),
            "doc_number": row[2],
            "version": row[3],
            "status": row[4],
            "signed_at": row[5].isoformat() if row[5] else None,
            "created_at": row[6].isoformat() if row[6] else None,
            "preview_url": f"/api/documents/{row[0]}/preview",
            "pdf_url": f"/api/documents/{row[0]}/pdf"
        })
    
    # Додаємо доступні типи документів
    available_types = get_docs_for_entity(entity_type)
    
    return {
        "documents": documents,
        "available_types": available_types
    }


# ============ Підписання ============

@router.post("/{document_id}/sign")
async def sign_document(
    document_id: str,
    signature_data: dict = None,
    db: Session = Depends(get_rh_db)
):
    """
    Позначає документ як підписаний.
    
    Args:
        signature_data: Опційні дані підпису (signature_image, signer_name, etc.)
    """
    
    doc = get_document_by_id(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не знайдено")
    
    db.execute(text("""
        UPDATE documents 
        SET status = 'signed', 
            signed_at = NOW(),
            signature_payload = :signature_payload
        WHERE id = :doc_id
    """), {
        "doc_id": document_id,
        "signature_payload": json.dumps(signature_data) if signature_data else None
    })
    
    db.commit()
    
    return {"success": True, "message": "Документ позначено як підписаний"}


# ============ Відправка Email ============

class SendEmailRequest(BaseModel):
    email: str

@router.post("/{document_id}/send-email")
async def send_document_email(
    document_id: str,
    request: SendEmailRequest,
    db: Session = Depends(get_rh_db)
):
    """
    Відправляє документ на email як HTML в тілі листа.
    Відправляється тільки сам документ без додаткових обгорток.
    """
    from services.email_service import send_email
    
    doc = get_document_by_id(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не знайдено")
    
    # Отримуємо HTML документа
    html_content = doc.get("html_content")
    if not html_content:
        raise HTTPException(status_code=400, detail="Документ не має HTML вмісту")
    
    # Тема листа
    doc_type_name = DOC_REGISTRY.get(doc["doc_type"], {}).get("name", doc["doc_type"])
    subject = f"FarforDecorOrenda - {doc_type_name} {doc['doc_number']}"
    
    try:
        result = send_email(
            to_email=request.email,
            subject=subject,
            html_content=html_content  # Відправляємо документ як є
        )
        
        if not result["success"]:
            raise Exception(result["message"])
        
        # Логуємо відправку
        db.execute(text("""
            INSERT INTO document_email_log (document_id, email, sent_at, status)
            VALUES (:doc_id, :email, NOW(), 'sent')
        """), {"doc_id": document_id, "email": request.email})
        db.commit()
        
        return {"success": True, "message": f"Документ відправлено на {request.email}"}
    except Exception as e:
        # Логуємо помилку
        try:
            db.execute(text("""
                INSERT INTO document_email_log (document_id, email, sent_at, status, error)
                VALUES (:doc_id, :email, NOW(), 'failed', :error)
            """), {"doc_id": document_id, "email": request.email, "error": str(e)})
            db.commit()
        except:
            pass
        
        raise HTTPException(status_code=500, detail=f"Помилка відправки email: {str(e)}")


@router.post("/{document_id}/regenerate")
async def regenerate_document(
    document_id: str,
    options: dict = None,
    db: Session = Depends(get_rh_db)
):
    """
    Перегенеровує документ (створює нову версію).
    Використовується якщо потрібно оновити дані.
    """
    
    doc = get_document_by_id(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не знайдено")
    
    # Генеруємо новий документ з тим самим номером, але новою версією
    return await generate_document(
        doc_type=doc["doc_type"],
        entity_id=doc["entity_id"],
        options=options,
        db=db
    )


# ============ Допоміжні функції ============

def save_document(
    db: Session,
    doc_type: str,
    doc_number: str,
    entity_type: str,
    entity_id: str,
    data_snapshot: dict,
    html_content: str,
    options: dict = None
) -> str:
    """Зберігає документ в БД"""
    
    # Перевіряємо чи є попередні версії
    result = db.execute(text("""
        SELECT MAX(version) FROM documents 
        WHERE entity_type = :entity_type AND entity_id = :entity_id AND doc_type = :doc_type
    """), {"entity_type": entity_type, "entity_id": entity_id, "doc_type": doc_type})
    
    max_version = result.fetchone()[0]
    version = (max_version or 0) + 1
    
    # Генеруємо ID
    doc_id = f"DOC-{doc_number.replace('-', '')}-V{version}"
    
    # Зберігаємо
    db.execute(text("""
        INSERT INTO documents (
            id, doc_type, doc_number, entity_type, entity_id,
            version, status, data_snapshot, html_content, options_json,
            created_at
        ) VALUES (
            :id, :doc_type, :doc_number, :entity_type, :entity_id,
            :version, 'draft', :data_snapshot, :html_content, :options_json,
            NOW()
        )
    """), {
        "id": doc_id,
        "doc_type": doc_type,
        "doc_number": doc_number,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "version": version,
        "data_snapshot": json.dumps(data_snapshot, default=str, ensure_ascii=False),
        "html_content": html_content,
        "options_json": json.dumps(options, ensure_ascii=False) if options else None
    })
    
    db.commit()
    
    return doc_id


def get_document_by_id(db: Session, document_id: str) -> dict:
    """Отримує документ за ID"""
    
    result = db.execute(text("""
        SELECT id, doc_type, doc_number, entity_type, entity_id,
               version, status, signed_at, html_content, created_at
        FROM documents
        WHERE id = :doc_id
    """), {"doc_id": document_id})
    
    row = result.fetchone()
    if not row:
        return None
    
    return {
        "id": row[0],
        "doc_type": row[1],
        "doc_number": row[2],
        "entity_type": row[3],
        "entity_id": row[4],
        "version": row[5],
        "status": row[6],
        "signed_at": row[7],
        "html_content": row[8],
        "created_at": row[9]
    }



def get_latest_document(db: Session, entity_type: str, entity_id: str, doc_type: str) -> dict:
    """Отримує останній згенерований документ певного типу для сутності"""
    
    result = db.execute(text("""
        SELECT id, doc_type, doc_number, entity_type, entity_id,
               version, status, signed_at, html_content, created_at
        FROM documents
        WHERE entity_type = :entity_type 
          AND entity_id = :entity_id 
          AND doc_type = :doc_type
        ORDER BY version DESC
        LIMIT 1
    """), {"entity_type": entity_type, "entity_id": entity_id, "doc_type": doc_type})
    
    row = result.fetchone()
    if not row:
        return None
    
    return {
        "id": row[0],
        "doc_type": row[1],
        "doc_number": row[2],
        "entity_type": row[3],
        "entity_id": row[4],
        "version": row[5],
        "status": row[6],
        "signed_at": row[7],
        "html_content": row[8],
        "created_at": row[9]
    }


# ============ Останній документ для перегляду ============

@router.get("/latest/{entity_type}/{entity_id}/{doc_type}")
async def get_latest_entity_document(
    entity_type: str,
    entity_id: str,
    doc_type: str,
    db: Session = Depends(get_rh_db)
):
    """
    Отримує останній згенерований документ певного типу.
    Використовується для перегляду без повторної генерації.
    """
    doc = get_latest_document(db, entity_type, entity_id, doc_type)
    
    if not doc:
        return {
            "exists": False,
            "message": "Документ ще не згенеровано"
        }
    
    config = DOC_REGISTRY.get(doc_type, {})
    
    return {
        "exists": True,
        "id": doc["id"],
        "doc_type": doc["doc_type"],
        "doc_type_name": config.get("name", doc_type),
        "doc_number": doc["doc_number"],
        "version": doc["version"],
        "status": doc["status"],
        "signed_at": doc["signed_at"].isoformat() if doc["signed_at"] else None,
        "created_at": doc["created_at"].isoformat() if doc["created_at"] else None,
        "preview_url": f"/api/documents/{doc['id']}/preview",
        "pdf_url": f"/api/documents/{doc['id']}/pdf",
        "html_content": doc["html_content"]
    }


# ============ Batch endpoint для паралельного завантаження версій ============

class LatestBatchRequest(BaseModel):
    """Запит на отримання останніх версій документів batch"""
    entity_type: str
    entity_id: str
    doc_types: List[str]

@router.post("/latest-batch")
async def get_latest_batch(request: LatestBatchRequest, db: Session = Depends(get_rh_db)):
    """Get latest versions of multiple document types in one request"""
    results = {}
    for doc_type in request.doc_types:
        doc = get_latest_document(db, request.entity_type, request.entity_id, doc_type)
        if doc:
            results[doc_type] = {
                "id": doc["id"],
                "doc_number": doc["doc_number"],
                "version": doc["version"],
                "status": doc["status"]
            }
    return results


# ============================================================
# ESTIMATE (КОШТОРИС) - Quick Preview
# ============================================================

from services.pdf_generator import jinja_env, EXECUTORS
from weasyprint import HTML as WeasyHTML, CSS as WeasyCSS
from weasyprint.text.fonts import FontConfiguration as WeasyFontConfig

def _format_date_ua(date_val) -> str:
    """Format date to DD.MM.YYYY"""
    if not date_val:
        return "—"
    if isinstance(date_val, str):
        try:
            date_val = datetime.fromisoformat(date_val.replace('Z', '+00:00'))
        except:
            return date_val
    return date_val.strftime("%d.%m.%Y")

def _format_date_ua_long(date_val) -> str:
    """Format date to «DD» місяця YYYY року"""
    if not date_val:
        return "«____» ____________ 202_ року"
    if isinstance(date_val, str):
        try:
            date_val = datetime.fromisoformat(date_val.replace('Z', '+00:00'))
        except:
            return date_val
    months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
              'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня']
    return f"«{date_val.day}» {months[date_val.month - 1]} {date_val.year} року"

def _format_currency(value) -> str:
    """Format number as currency"""
    if value is None:
        return "0,00"
    return f"{float(value):,.2f}".replace(",", " ").replace(".", ",")

def _get_order_with_items(db: Session, order_id: int):
    """Get order with all items including extended fields for documents"""
    order = db.execute(text("""
        SELECT 
            o.order_id,           -- 0
            o.order_number,       -- 1
            o.customer_id,        -- 2
            o.customer_name,      -- 3
            o.customer_phone,     -- 4
            o.customer_email,     -- 5
            o.rental_start_date,  -- 6
            o.rental_end_date,    -- 7
            o.issue_date,         -- 8
            o.return_date,        -- 9
            o.status,             -- 10
            o.total_price,        -- 11
            o.deposit_amount,     -- 12
            o.notes,              -- 13
            o.created_at,         -- 14
            o.rental_days,        -- 15
            o.city,               -- 16
            o.delivery_address,   -- 17
            o.delivery_type,      -- 18
            o.event_type,         -- 19
            o.customer_comment,   -- 20
            o.phone,              -- 21
            o.email,              -- 22
            o.discount_amount,    -- 23
            o.discount_percent    -- 24
        FROM orders o WHERE o.order_id = :id
    """), {"id": order_id}).fetchone()
    
    if not order:
        return None, None
    
    # Join with products to get SKU
    items = db.execute(text("""
        SELECT 
            oi.id,                -- 0
            oi.product_id,        -- 1
            oi.product_name,      -- 2
            oi.quantity,          -- 3
            oi.price,             -- 4
            oi.total_rental,      -- 5
            oi.image_url,         -- 6
            p.sku,                -- 7
            p.rental_price        -- 8 (deposit often equals rental_price)
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.product_id
        WHERE oi.order_id = :id AND oi.status = 'active'
    """), {"id": order_id}).fetchall()
    
    return order, items


@router.get("/estimate/{order_id}/preview", response_class=HTMLResponse)
async def preview_estimate(order_id: int, db: Session = Depends(get_rh_db)):
    """Generate HTML preview of estimate (Кошторис) using new quote.html template"""
    
    order, items = _get_order_with_items(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Замовлення не знайдено")
    
    # Calculate rental days
    rental_days = order[15] if order[15] else 1
    if not rental_days and order[6] and order[7]:
        rental_days = (order[7] - order[6]).days + 1
    
    # Format items for template
    formatted_items = []
    rent_total = 0.0
    deposit_total = 0.0
    
    for item in items:
        # item: [id, product_id, product_name, quantity, price, total_rental, image_url, sku, rental_price]
        qty = item[3] or 1
        price_per_day = float(item[4] or 0)
        total_rental = float(item[5] or 0)
        # Deposit = price * quantity (using rental_price from products or price as fallback)
        deposit_per_item = float(item[8] or item[4] or 0) * qty
        
        rent_total += total_rental
        deposit_total += deposit_per_item
        
        formatted_items.append({
            "product_name": item[2],
            "sku": item[7] or "—",
            "quantity": qty,
            "price_per_day_fmt": _format_currency(price_per_day),
            "total_rental_fmt": _format_currency(total_rental),
            "deposit_fmt": _format_currency(deposit_per_item),
            "image_url": item[6],
            "note": None
        })
    
    # Calculate totals (use order values if available, otherwise calculated)
    order_rent = float(order[11] or 0) if order[11] else rent_total
    order_deposit = float(order[12] or 0) if order[12] else deposit_total
    discount_amount = float(order[23] or 0) if order[23] else 0
    discount_percent = order[24] or 0
    grand_total = order_rent + order_deposit - discount_amount
    
    # Delivery type label mapping
    delivery_type_labels = {
        "self_pickup": "Самовивіз",
        "delivery": "Доставка",
        "self": "Самовивіз",
        None: "Самовивіз"
    }
    delivery_type_label = delivery_type_labels.get(order[18], order[18] or "Самовивіз")
    
    # Build template data matching quote.html structure
    template_data = {
        "order": {
            "order_number": order[1],
            "customer_name": order[3],
            "customer_phone": order[4] or order[21],  # customer_phone or phone
            "customer_email": order[5] or order[22],  # customer_email or email
            "phone": order[4] or order[21],
            "email": order[5] or order[22],
            "rental_start_date": _format_date_ua(order[6]),
            "rental_end_date": _format_date_ua(order[7]),
            "rental_days": rental_days,
            "delivery_type": order[18],
            "delivery_type_label": delivery_type_label,
            "city": order[16] or "—",
            "delivery_address": order[17] or "—",
            "event_type": order[19],
            "event_name": None,
            "event_location": None,
            "customer_comment": order[20],
            "total_price": order_rent,
            "total_price_fmt": _format_currency(order_rent),
            "deposit_amount": order_deposit,
            "deposit_amount_fmt": _format_currency(order_deposit),
            "discount_amount": discount_amount,
            "discount_percent": discount_percent
        },
        "items": formatted_items,
        "totals": {
            "rent_total_fmt": _format_currency(order_rent),
            "deposit_total_fmt": _format_currency(order_deposit),
            "discount_fmt": _format_currency(discount_amount) if discount_amount > 0 else None,
            "grand_total_fmt": _format_currency(grand_total),
            "grand_total": grand_total
        },
        "company": {
            "phone": "+38 (050) 415-23-23",
            "email": "farfordecororenda@gmail.com"
        },
        "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "watermark": None  # Can be set to "ПОПЕРЕДНІЙ" or "ЗАТВЕРДЖЕНО"
    }
    
    template = jinja_env.get_template("documents/quote.html")
    return HTMLResponse(content=template.render(**template_data), media_type="text/html")


@router.get("/estimate/{order_id}/pdf")
async def download_estimate_pdf(order_id: int, db: Session = Depends(get_rh_db)):
    """Download estimate (Кошторис) as PDF using new quote.html template"""
    
    order, items = _get_order_with_items(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Замовлення не знайдено")
    
    # Calculate rental days
    rental_days = order[15] if order[15] else 1
    if not rental_days and order[6] and order[7]:
        rental_days = (order[7] - order[6]).days + 1
    
    # Format items for template
    formatted_items = []
    rent_total = 0.0
    deposit_total = 0.0
    
    for item in items:
        qty = item[3] or 1
        price_per_day = float(item[4] or 0)
        total_rental = float(item[5] or 0)
        deposit_per_item = float(item[8] or item[4] or 0) * qty
        
        rent_total += total_rental
        deposit_total += deposit_per_item
        
        formatted_items.append({
            "product_name": item[2],
            "sku": item[7] or "—",
            "quantity": qty,
            "price_per_day_fmt": _format_currency(price_per_day),
            "total_rental_fmt": _format_currency(total_rental),
            "deposit_fmt": _format_currency(deposit_per_item),
            "image_url": item[6],
            "note": None
        })
    
    # Calculate totals
    order_rent = float(order[11] or 0) if order[11] else rent_total
    order_deposit = float(order[12] or 0) if order[12] else deposit_total
    discount_amount = float(order[23] or 0) if order[23] else 0
    grand_total = order_rent + order_deposit - discount_amount
    
    # Delivery type label
    delivery_type_labels = {
        "self_pickup": "Самовивіз",
        "delivery": "Доставка",
        "self": "Самовивіз",
        None: "Самовивіз"
    }
    delivery_type_label = delivery_type_labels.get(order[18], order[18] or "Самовивіз")
    
    template_data = {
        "order": {
            "order_number": order[1],
            "customer_name": order[3],
            "customer_phone": order[4] or order[21],
            "customer_email": order[5] or order[22],
            "phone": order[4] or order[21],
            "email": order[5] or order[22],
            "rental_start_date": _format_date_ua(order[6]),
            "rental_end_date": _format_date_ua(order[7]),
            "rental_days": rental_days,
            "delivery_type": order[18],
            "delivery_type_label": delivery_type_label,
            "city": order[16] or "—",
            "delivery_address": order[17] or "—",
            "event_type": order[19],
            "event_name": None,
            "event_location": None,
            "customer_comment": order[20],
            "total_price": order_rent,
            "total_price_fmt": _format_currency(order_rent),
            "deposit_amount": order_deposit,
            "deposit_amount_fmt": _format_currency(order_deposit)
        },
        "items": formatted_items,
        "totals": {
            "rent_total_fmt": _format_currency(order_rent),
            "deposit_total_fmt": _format_currency(order_deposit),
            "discount_fmt": _format_currency(discount_amount) if discount_amount > 0 else None,
            "grand_total_fmt": _format_currency(grand_total),
            "grand_total": grand_total
        },
        "company": {
            "phone": "+38 (050) 415-23-23",
            "email": "farfordecororenda@gmail.com"
        },
        "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "watermark": None
    }
    
    template = jinja_env.get_template("documents/quote.html")
    html_content = template.render(**template_data)
    
    font_config = WeasyFontConfig()
    pdf_bytes = WeasyHTML(string=html_content).write_pdf(
        stylesheets=[WeasyCSS(string='@page { size: A4; margin: 10mm; }', font_config=font_config)],
        font_config=font_config
    )
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Koshtorys_{order[1]}.pdf"}
    )


# ============================================================
# ANNEX (ДОДАТОК) - Quick Preview  
# ============================================================

@router.get("/annex/{order_id}/preview", response_class=HTMLResponse)
async def preview_annex(
    order_id: int,
    agreement_id: Optional[int] = Query(None),
    db: Session = Depends(get_rh_db)
):
    """Generate HTML preview of annex (Додаток)"""
    
    order, items = _get_order_with_items(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Замовлення не знайдено")
    
    agreement = None
    executor = EXECUTORS["tov"]
    
    if agreement_id:
        agreement_row = db.execute(text("""
            SELECT ma.id, ma.contract_number, ma.valid_from, ma.snapshot_json
            FROM master_agreements ma WHERE ma.id = :id
        """), {"id": agreement_id}).fetchone()
        
        if agreement_row:
            agreement = {"id": agreement_row[0], "number": agreement_row[1], "date": _format_date_ua(agreement_row[2])}
            if agreement_row[3]:
                try:
                    snapshot = json.loads(agreement_row[3]) if isinstance(agreement_row[3], str) else agreement_row[3]
                    executor = snapshot.get("executor") or EXECUTORS.get(snapshot.get("executor_type", "tov"), EXECUTORS["tov"])
                except:
                    pass
    
    if not agreement:
        agreement = {"number": "_____", "date": "«___» _______ 202_ р."}
    
    rental_days = order[15] or 1
    if not rental_days and order[6] and order[7]:
        rental_days = (order[7] - order[6]).days + 1
    
    annex_number = 1
    if agreement_id:
        count = db.execute(text("SELECT COUNT(*) FROM order_annexes WHERE master_agreement_id = :aid"), {"aid": agreement_id}).fetchone()[0]
        annex_number = count + 1
    
    formatted_items = []
    total_qty = 0
    for item in items:
        # New structure: [id, product_id, product_name, quantity, price, total_rental, image_url, sku, rental_price]
        formatted_items.append({"name": item[2], "quantity": item[3], "total_rental": _format_currency(item[5]), "packing_type": None})
        total_qty += item[3]
    
    client = {"name": order[3], "phone": order[4] or order[21], "email": order[5] or order[22], "payer_type": "individual", "director_name": None,
              "contact_person": order[3], "contact_channel": "phone", "contact_value": order[4] or order[21]}


# ============================================================
# INVOICE OFFER (РАХУНОК-ОФЕРТА)
# ============================================================

@router.get("/invoice-offer/{order_id}/preview", response_class=HTMLResponse)
async def preview_invoice_offer(
    order_id: int,
    executor_type: str = Query("tov", description="tov or fop"),
    db: Session = Depends(get_rh_db)
):
    """Generate HTML preview of invoice offer (Рахунок-оферта)"""
    
    order, items = _get_order_with_items(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Замовлення не знайдено")
    
    executor = EXECUTORS.get(executor_type, EXECUTORS["tov"])
    rental_days = order[15] or 1
    
    formatted_items = []
    for item in items:
        # New structure: [id, product_id, product_name, quantity, price, total_rental, image_url, sku, rental_price]
        formatted_items.append({
            "name": item[2],
            "quantity": item[3],
            "price_per_day": _format_currency(item[4]),
            "total_rental": _format_currency(item[5]),
            "deposit": _format_currency(float(item[8] or item[4] or 0) * (item[3] or 1))
        })
    
    invoice_number = f"Р-{datetime.now().strftime('%Y')}-{order[0]:06d}"
    
    template_data = {
        "invoice_number": invoice_number,
        "invoice_date": datetime.now().strftime("%d.%m.%Y"),
        "executor": executor,
        "client": {"name": order[3], "phone": order[4], "email": order[5], "tax_id": None},
        "order": {
            "number": order[1],
            "rental_period": f"{_format_date_ua(order[6])} — {_format_date_ua(order[7])}",
            "rental_days": rental_days,
            "delivery_method": "Самовивіз"
        },
        "items": formatted_items,
        "rental_days": rental_days,
        "totals": {
            "rental": _format_currency(order[11]),
            "deposit": _format_currency(order[12]),
            "discount": "0,00",
            "total": _format_currency((float(order[11] or 0) + float(order[12] or 0)))
        },
        "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M")
    }
    
    template = jinja_env.get_template("documents/invoice_offer.html")
    return HTMLResponse(content=template.render(**template_data), media_type="text/html")


@router.get("/invoice-offer/{order_id}/pdf")
async def download_invoice_offer_pdf(
    order_id: int,
    executor_type: str = Query("tov"),
    db: Session = Depends(get_rh_db)
):
    """Download invoice offer as PDF"""
    
    order, items = _get_order_with_items(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Замовлення не знайдено")
    
    executor = EXECUTORS.get(executor_type, EXECUTORS["tov"])
    rental_days = order[15] or 1
    
    formatted_items = [{"name": it[3], "quantity": it[4], "price_per_day": _format_currency(it[5]),
                        "total_rental": _format_currency(it[6]), "deposit": _format_currency(it[8])} for it in items]
    
    invoice_number = f"Р-{datetime.now().strftime('%Y')}-{order[0]:06d}"
    
    template_data = {
        "invoice_number": invoice_number, "invoice_date": datetime.now().strftime("%d.%m.%Y"),
        "executor": executor,
        "client": {"name": order[3], "phone": order[4], "email": order[5], "tax_id": None},
        "order": {"number": order[1], "rental_period": f"{_format_date_ua(order[6])} — {_format_date_ua(order[7])}", "rental_days": rental_days, "delivery_method": "Самовивіз"},
        "items": formatted_items, "rental_days": rental_days,
        "totals": {"rental": _format_currency(order[11]), "deposit": _format_currency(order[12]), "discount": "0,00", "total": _format_currency((float(order[11] or 0) + float(order[12] or 0)))},
        "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M")
    }
    
    template = jinja_env.get_template("documents/invoice_offer.html")
    html_content = template.render(**template_data)
    
    font_config = WeasyFontConfig()
    pdf_bytes = WeasyHTML(string=html_content).write_pdf(stylesheets=[WeasyCSS(string='@page { size: A4; margin: 10mm; }', font_config=font_config)], font_config=font_config)
    
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=Rahunok_{order[1]}.pdf"})


# ============================================================
# ISSUE ACT (АКТ ВИДАЧІ)
# ============================================================

@router.get("/issue-act/{order_id}/preview", response_class=HTMLResponse)
async def preview_issue_act(
    order_id: int,
    executor_type: str = Query("tov"),
    db: Session = Depends(get_rh_db)
):
    """Generate HTML preview of issue act (Акт видачі)"""
    
    order, items = _get_order_with_items(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Замовлення не знайдено")
    
    executor = EXECUTORS.get(executor_type, EXECUTORS["tov"])
    rental_days = order[15] or 1
    
    formatted_items = [{"name": it[3], "quantity": it[4]} for it in items]
    total_qty = sum(it[4] for it in items)
    
    act_number = f"В-{datetime.now().strftime('%Y')}-{order[0]:06d}"
    
    template_data = {
        "act_number": act_number,
        "act_date": datetime.now().strftime("%d.%m.%Y"),
        "executor": executor,
        "client": {"name": order[3], "phone": order[4], "contact_person": order[3]},
        "order": {"number": order[1]},
        "items": formatted_items,
        "rental_days": rental_days,
        "rental_start_date": _format_date_ua(order[6]),
        "rental_end_date": _format_date_ua(order[7]),
        "return_date": _format_date_ua(order[9] or order[7]),
        "totals": {"items_count": len(items), "quantity": total_qty}
    }
    
    template = jinja_env.get_template("documents/issue_act.html")
    return HTMLResponse(content=template.render(**template_data), media_type="text/html")


@router.get("/issue-act/{order_id}/pdf")
async def download_issue_act_pdf(
    order_id: int,
    executor_type: str = Query("tov"),
    db: Session = Depends(get_rh_db)
):
    """Download issue act as PDF"""
    
    order, items = _get_order_with_items(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Замовлення не знайдено")
    
    executor = EXECUTORS.get(executor_type, EXECUTORS["tov"])
    rental_days = order[15] or 1
    
    formatted_items = [{"name": it[3], "quantity": it[4]} for it in items]
    total_qty = sum(it[4] for it in items)
    
    act_number = f"В-{datetime.now().strftime('%Y')}-{order[0]:06d}"
    
    template_data = {
        "act_number": act_number, "act_date": datetime.now().strftime("%d.%m.%Y"),
        "executor": executor,
        "client": {"name": order[3], "phone": order[4], "contact_person": order[3]},
        "order": {"number": order[1]},
        "items": formatted_items, "rental_days": rental_days,
        "rental_start_date": _format_date_ua(order[6]), "rental_end_date": _format_date_ua(order[7]),
        "return_date": _format_date_ua(order[9] or order[7]),
        "totals": {"items_count": len(items), "quantity": total_qty}
    }
    
    template = jinja_env.get_template("documents/issue_act.html")
    html_content = template.render(**template_data)
    
    font_config = WeasyFontConfig()
    pdf_bytes = WeasyHTML(string=html_content).write_pdf(stylesheets=[WeasyCSS(string='@page { size: A4; margin: 15mm; }', font_config=font_config)], font_config=font_config)
    
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=Akt_vydachi_{order[1]}.pdf"})

    
    if order[2]:
        client_row = db.execute(text("SELECT payer_type FROM client_users WHERE id = :id"), {"id": order[2]}).fetchone()
        if client_row:
            client["payer_type"] = client_row[0] or "individual"
    
    template_data = {
        "annex": {"number": annex_number, "date": _format_date_ua(datetime.now())},
        "agreement": agreement, "executor": executor, "client": client, "items": formatted_items,
        "rental_days": rental_days,
        "rental_start_date": _format_date_ua_long(order[6]), "rental_end_date": _format_date_ua_long(order[7]),
        "issue_date": _format_date_ua_long(order[8] or order[6]), "return_date": _format_date_ua_long(order[9] or order[7]),
        "totals": {"quantity": total_qty, "rental": _format_currency(order[11]), "deposit": _format_currency(order[12])}
    }
    
    template = jinja_env.get_template("documents/annex.html")
    return HTMLResponse(content=template.render(**template_data), media_type="text/html")


@router.get("/annex/{order_id}/pdf")
async def download_annex_pdf(order_id: int, agreement_id: Optional[int] = Query(None), db: Session = Depends(get_rh_db)):
    """Download annex as PDF"""
    
    order, items = _get_order_with_items(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Замовлення не знайдено")
    
    agreement = None
    executor = EXECUTORS["tov"]
    
    if agreement_id:
        agreement_row = db.execute(text("SELECT id, contract_number, valid_from, snapshot_json FROM master_agreements WHERE id = :id"), {"id": agreement_id}).fetchone()
        if agreement_row:
            agreement = {"number": agreement_row[1], "date": _format_date_ua(agreement_row[2])}
            if agreement_row[3]:
                try:
                    snapshot = json.loads(agreement_row[3]) if isinstance(agreement_row[3], str) else agreement_row[3]
                    executor = snapshot.get("executor") or EXECUTORS.get(snapshot.get("executor_type", "tov"), EXECUTORS["tov"])
                except:
                    pass
    
    if not agreement:
        agreement = {"number": "_____", "date": "«___» _______ 202_ р."}
    
    rental_days = order[15] or 1
    annex_number = 1
    if agreement_id:
        count = db.execute(text("SELECT COUNT(*) FROM order_annexes WHERE master_agreement_id = :aid"), {"aid": agreement_id}).fetchone()[0]
        annex_number = count + 1
    
    formatted_items = [{"name": it[3], "quantity": it[4], "total_rental": _format_currency(it[6]), "packing_type": None} for it in items]
    total_qty = sum(it[4] for it in items)
    
    client = {"name": order[3], "payer_type": "individual", "director_name": None, "contact_person": order[3], "contact_channel": "phone", "contact_value": order[4]}
    
    template_data = {
        "annex": {"number": annex_number, "date": _format_date_ua(datetime.now())},
        "agreement": agreement, "executor": executor, "client": client, "items": formatted_items,
        "rental_days": rental_days,
        "rental_start_date": _format_date_ua_long(order[6]), "rental_end_date": _format_date_ua_long(order[7]),
        "issue_date": _format_date_ua_long(order[8] or order[6]), "return_date": _format_date_ua_long(order[9] or order[7]),
        "totals": {"quantity": total_qty, "rental": _format_currency(order[11]), "deposit": _format_currency(order[12])}
    }
    
    template = jinja_env.get_template("documents/annex.html")
    html_content = template.render(**template_data)
    
    font_config = WeasyFontConfig()
    pdf_bytes = WeasyHTML(string=html_content).write_pdf(stylesheets=[WeasyCSS(string='@page { size: A4; margin: 15mm; }', font_config=font_config)], font_config=font_config)
    
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=Dodatok_{annex_number}_{order[1]}.pdf"})

async def get_latest_documents_batch(
    request: LatestBatchRequest,
    db: Session = Depends(get_rh_db)
):
    """
    ОПТИМІЗОВАНИЙ endpoint: Отримує останні версії кількох документів одним запитом.
    Замість N окремих запитів на /latest/{type}/{id}/{doc_type} - один запит.
    """
    if not request.doc_types:
        return {"documents": {}}
    
    # Один SQL запит для всіх типів документів
    placeholders = ", ".join([f":doc_type_{i}" for i in range(len(request.doc_types))])
    params = {
        "entity_type": request.entity_type,
        "entity_id": str(request.entity_id),
    }
    for i, dt in enumerate(request.doc_types):
        params[f"doc_type_{i}"] = dt
    
    result = db.execute(text(f"""
        SELECT d1.id, d1.doc_type, d1.doc_number, d1.version, d1.status, 
               d1.signed_at, d1.created_at, d1.html_content
        FROM documents d1
        INNER JOIN (
            SELECT doc_type, MAX(version) as max_version
            FROM documents
            WHERE entity_type = :entity_type AND entity_id = :entity_id
              AND doc_type IN ({placeholders})
            GROUP BY doc_type
        ) d2 ON d1.doc_type = d2.doc_type AND d1.version = d2.max_version
        WHERE d1.entity_type = :entity_type AND d1.entity_id = :entity_id
    """), params)
    
    documents = {}
    for row in result:
        doc_type = row[1]
        config = DOC_REGISTRY.get(doc_type, {})
        documents[doc_type] = {
            "exists": True,
            "id": row[0],
            "doc_type": doc_type,
            "doc_type_name": config.get("name", doc_type),
            "doc_number": row[2],
            "version": row[3],
            "status": row[4],
            "signed_at": row[5].isoformat() if row[5] else None,
            "created_at": row[6].isoformat() if row[6] else None,
            "preview_url": f"/api/documents/{row[0]}/preview",
            "pdf_url": f"/api/documents/{row[0]}/pdf",
            "html_content": row[7]
        }
    
    # Для типів без документів - повертаємо exists: false
    for doc_type in request.doc_types:
        if doc_type not in documents:
            documents[doc_type] = {
                "exists": False,
                "message": "Документ ще не згенеровано"
            }
    
    return {"documents": documents}


@router.get("/history/{entity_type}/{entity_id}/{doc_type}")
async def get_document_history(
    entity_type: str,
    entity_id: str,
    doc_type: str,
    db: Session = Depends(get_rh_db)
):
    """
    Отримує історію всіх версій документа певного типу.
    """
    result = db.execute(text("""
        SELECT id, doc_type, doc_number, version, status, signed_at, created_at
        FROM documents
        WHERE entity_type = :entity_type 
          AND entity_id = :entity_id 
          AND doc_type = :doc_type
        ORDER BY version DESC
    """), {"entity_type": entity_type, "entity_id": entity_id, "doc_type": doc_type})
    
    config = DOC_REGISTRY.get(doc_type, {})
    
    versions = []
    for row in result:
        versions.append({
            "id": row[0],
            "doc_type": row[1],
            "doc_type_name": config.get("name", doc_type),
            "doc_number": row[2],
            "version": row[3],
            "status": row[4],
            "signed_at": row[5].isoformat() if row[5] else None,
            "created_at": row[6].isoformat() if row[6] else None,
            "preview_url": f"/api/documents/{row[0]}/preview",
            "pdf_url": f"/api/documents/{row[0]}/pdf"
        })
    
    return {
        "doc_type": doc_type,
        "doc_type_name": config.get("name", doc_type),
        "total_versions": len(versions),
        "versions": versions
    }
