"""
Data Builders - збирання даних для документів
"""
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
import json

def build_document_data(db: Session, doc_type: str, entity_id: str, options: dict = None) -> dict:
    """
    Збирає всі дані для генерації документа.
    Повертає словник з даними для шаблону.
    """
    options = options or {}
    
    if doc_type in ["invoice_offer", "contract_rent", "return_act", "deposit_settlement_act", "invoice_additional", "return_intake_checklist"]:
        return build_order_data(db, entity_id, options)
    elif doc_type in ["issue_act", "picking_list"]:
        return build_issue_card_data(db, entity_id, options)
    elif doc_type == "damage_report_client":
        return build_damage_data(db, entity_id, options)
    else:
        raise ValueError(f"No data builder for doc_type: {doc_type}")

def build_order_data(db: Session, order_id: str, options: dict) -> dict:
    """Збирає дані замовлення для документа"""
    
    # Основні дані замовлення
    result = db.execute(text("""
        SELECT 
            o.order_id, o.order_number, o.status,
            o.customer_name, o.customer_phone, o.customer_email,
            o.rental_start_date, o.rental_end_date, o.rental_days,
            o.total_price, o.deposit_amount, o.discount_amount,
            o.delivery_type, o.delivery_address, o.notes,
            o.created_at
        FROM orders o
        WHERE o.order_id = :order_id OR o.id = :order_id
    """), {"order_id": order_id})
    
    order_row = result.fetchone()
    if not order_row:
        raise ValueError(f"Order not found: {order_id}")
    
    order = {
        "id": order_row[0],
        "order_number": order_row[1],
        "status": order_row[2],
        "customer_name": order_row[3],
        "customer_phone": order_row[4],
        "customer_email": order_row[5],
        "rental_start_date": order_row[6].strftime("%d.%m.%Y") if order_row[6] else "",
        "rental_end_date": order_row[7].strftime("%d.%m.%Y") if order_row[7] else "",
        "rental_days": order_row[8] or 1,
        "total_price": float(order_row[9] or 0),
        "deposit_amount": float(order_row[10] or 0),
        "discount_amount": float(order_row[11] or 0),
        "delivery_type": order_row[12],
        "delivery_address": order_row[13],
        "notes": order_row[14],
        "created_at": order_row[15].strftime("%d.%m.%Y %H:%M") if order_row[15] else ""
    }
    
    # Позиції замовлення
    items_result = db.execute(text("""
        SELECT 
            oi.product_name, oi.sku, oi.quantity, 
            oi.price_per_day, oi.deposit_per_item,
            p.image_url, p.zone, p.aisle, p.shelf
        FROM order_items oi
        LEFT JOIN products p ON p.sku = oi.sku
        WHERE oi.order_id = :order_id
    """), {"order_id": order["id"]})
    
    items = []
    total_rent = 0
    total_deposit = 0
    
    for row in items_result:
        qty = int(row[2] or 1)
        price = float(row[3] or 0)
        deposit = float(row[4] or 0)
        
        item_rent = price * qty * order["rental_days"]
        item_deposit = deposit * qty
        
        location = None
        if row[6] or row[7] or row[8]:
            location = "-".join(filter(None, [row[6], row[7], row[8]]))
        
        items.append({
            "name": row[0],
            "sku": row[1],
            "quantity": qty,
            "price_per_day": price,
            "deposit_per_item": deposit,
            "total_rent": item_rent,
            "total_deposit": item_deposit,
            "image_url": row[5],
            "location": location
        })
        
        total_rent += item_rent
        total_deposit += item_deposit
    
    # Компанія (з налаштувань або дефолт)
    company = {
        "name": "FarforRent",
        "legal_name": "ФОП Прізвище І.Б.",
        "address": "м. Київ, вул. Прикладна, 1",
        "phone": "+380 XX XXX XX XX",
        "email": "info@farforrent.com",
        "iban": "UA00 0000 0000 0000 0000 0000 00000",
        "edrpou": "00000000"
    }
    
    return {
        "order": order,
        "items": items,
        "totals": {
            "rent": total_rent,
            "deposit": total_deposit,
            "discount": order["discount_amount"],
            "grand_total": total_rent + total_deposit - order["discount_amount"]
        },
        "company": company,
        "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "options": options
    }

def build_issue_card_data(db: Session, issue_card_id: str, options: dict) -> dict:
    """Збирає дані картки видачі для документа"""
    
    result = db.execute(text("""
        SELECT 
            ic.id, ic.order_id, ic.order_number, ic.status,
            ic.customer_name, ic.customer_phone,
            ic.items_json, ic.requisitors_json,
            ic.prepared_at, ic.issued_at,
            o.rental_start_date, o.rental_end_date, o.rental_days,
            o.delivery_type, o.delivery_address, o.notes
        FROM issue_cards ic
        JOIN orders o ON o.order_id = ic.order_id
        WHERE ic.id = :id
    """), {"id": issue_card_id})
    
    row = result.fetchone()
    if not row:
        raise ValueError(f"Issue card not found: {issue_card_id}")
    
    items_json = row[6]
    items = json.loads(items_json) if isinstance(items_json, str) else (items_json or [])
    
    requisitors_json = row[7]
    requisitors = json.loads(requisitors_json) if isinstance(requisitors_json, str) else (requisitors_json or [])
    
    # Збагачуємо items локацією
    for item in items:
        sku = item.get('sku')
        if sku:
            loc_result = db.execute(text("""
                SELECT zone, aisle, shelf FROM products WHERE sku = :sku
            """), {"sku": sku})
            loc_row = loc_result.fetchone()
            if loc_row and (loc_row[0] or loc_row[1] or loc_row[2]):
                item['location'] = "-".join(filter(None, [loc_row[0], loc_row[1], loc_row[2]]))
    
    issue_card = {
        "id": row[0],
        "order_id": row[1],
        "order_number": row[2],
        "status": row[3],
        "customer_name": row[4],
        "customer_phone": row[5],
        "requisitors": requisitors,
        "prepared_at": row[8].strftime("%d.%m.%Y %H:%M") if row[8] else "",
        "issued_at": row[9].strftime("%d.%m.%Y %H:%M") if row[9] else "",
        "rental_start_date": row[10].strftime("%d.%m.%Y") if row[10] else "",
        "rental_end_date": row[11].strftime("%d.%m.%Y") if row[11] else "",
        "rental_days": row[12] or 1,
        "delivery_type": row[13],
        "delivery_address": row[14],
        "notes": row[15]
    }
    
    company = {
        "name": "FarforRent",
        "legal_name": "ФОП Прізвище І.Б.",
        "phone": "+380 XX XXX XX XX"
    }
    
    return {
        "issue_card": issue_card,
        "items": items,
        "company": company,
        "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "options": options
    }

def build_damage_data(db: Session, damage_case_id: str, options: dict) -> dict:
    """Збирає дані кейсу пошкодження для документа"""
    # TODO: Implement when damage_cases table is ready
    return {
        "damage_case": {},
        "items": [],
        "company": {"name": "FarforRent"},
        "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "options": options
    }
