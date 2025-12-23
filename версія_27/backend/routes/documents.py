"""
Documents API - генерація, перегляд та управління документами
"""
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
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
    Відправляє документ на email.
    """
    from routes.email import send_email_with_attachment
    
    doc = get_document_by_id(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не знайдено")
    
    # Отримуємо HTML документа
    html_content = doc.get("html_content")
    if not html_content:
        raise HTTPException(status_code=400, detail="Документ не має HTML вмісту")
    
    # Генеруємо PDF
    try:
        pdf_bytes = render_pdf(html_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка генерації PDF: {str(e)}")
    
    # Відправляємо email
    doc_type_name = DOC_REGISTRY.get(doc["doc_type"], {}).get("name", doc["doc_type"])
    subject = f"FarforRent - {doc_type_name} {doc['doc_number']}"
    body = f"""
    <h2>Документ від FarforRent</h2>
    <p>Доброго дня!</p>
    <p>Вам надіслано документ: <strong>{doc_type_name}</strong></p>
    <p>Номер документа: <strong>{doc['doc_number']}</strong></p>
    <br>
    <p>Документ у вкладенні.</p>
    <br>
    <p>З повагою,<br>Команда FarforRent</p>
    """
    
    try:
        await send_email_with_attachment(
            to_email=request.email,
            subject=subject,
            body=body,
            attachment=pdf_bytes,
            attachment_filename=f"{doc['doc_number']}.pdf"
        )
        
        # Логуємо відправку
        db.execute(text("""
            INSERT INTO document_email_log (document_id, email, sent_at, status)
            VALUES (:doc_id, :email, NOW(), 'sent')
        """), {"doc_id": document_id, "email": request.email})
        db.commit()
        
        return {"success": True, "message": f"Документ відправлено на {request.email}"}
    except Exception as e:
        # Логуємо помилку
        db.execute(text("""
            INSERT INTO document_email_log (document_id, email, sent_at, status, error)
            VALUES (:doc_id, :email, NOW(), 'failed', :error)
        """), {"doc_id": document_id, "email": request.email, "error": str(e)})
        db.commit()
        
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
