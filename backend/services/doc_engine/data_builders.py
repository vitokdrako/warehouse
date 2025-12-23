"""
Data Builders - збирання даних для документів
RentalHub database compatible version
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
    
    # Order-based documents
    order_docs = [
        "invoice_offer", "contract_rent", "deposit_settlement_act", 
        "invoice_additional", "return_intake_checklist", "delivery_note", 
        "rental_extension", "partial_return_act", "damage_settlement_act",
        "deposit_refund_act"
    ]
    
    # Return act - окремо, бо читає з return_cards
    return_docs = ["return_act"]
    
    # Issue card based documents
    issue_docs = ["issue_act", "picking_list", "issue_checklist"]
    
    # Damage case based documents
    damage_docs = ["damage_report", "damage_report_client", "damage_invoice"]
    
    # Vendor task based documents
    vendor_docs = ["vendor_work_act"]
    
    if doc_type in return_docs:
        return build_return_data(db, entity_id, options)
    elif doc_type in order_docs:
        return build_order_data(db, entity_id, options)
    elif doc_type in issue_docs:
        return build_issue_card_data(db, entity_id, options)
    elif doc_type in damage_docs:
        return build_damage_data(db, entity_id, options)
    elif doc_type in vendor_docs:
        return build_vendor_task_data(db, entity_id, options)
    else:
        raise ValueError(f"No data builder for doc_type: {doc_type}")

def build_order_data(db: Session, order_id: str, options: dict) -> dict:
    """Збирає дані замовлення для документа (RentalHub schema)"""
    
    # Основні дані замовлення
    result = db.execute(text("""
        SELECT 
            o.order_id, o.order_number, o.status,
            o.customer_name, o.customer_phone, o.customer_email,
            o.rental_start_date, o.rental_end_date, o.rental_days,
            o.total_price, o.deposit_amount, o.discount_amount,
            o.delivery_type, o.delivery_address, o.notes,
            o.created_at, o.phone
        FROM orders o
        WHERE o.order_id = :order_id
    """), {"order_id": order_id})
    
    order_row = result.fetchone()
    if not order_row:
        raise ValueError(f"Order not found: {order_id}")
    
    # Use customer_phone or phone fallback
    phone = order_row[4] or order_row[16] or ""
    
    order = {
        "id": order_row[0],
        "order_number": order_row[1] or f"OC-{order_row[0]}",
        "status": order_row[2],
        "customer_name": order_row[3] or "",
        "customer_phone": phone,
        "customer_email": order_row[5] or "",
        "rental_start_date": order_row[6].strftime("%d.%m.%Y") if order_row[6] else "",
        "rental_end_date": order_row[7].strftime("%d.%m.%Y") if order_row[7] else "",
        "rental_days": order_row[8] or 1,
        "total_price": float(order_row[9] or 0),
        "deposit_amount": float(order_row[10] or 0),
        "discount_amount": float(order_row[11] or 0),
        "delivery_type": order_row[12] or "pickup",
        "delivery_address": order_row[13] or "",
        "notes": order_row[14] or "",
        "created_at": order_row[15].strftime("%d.%m.%Y %H:%M") if order_row[15] else ""
    }
    
    # Позиції замовлення (RentalHub schema)
    items_result = db.execute(text("""
        SELECT 
            oi.product_name, oi.product_id, oi.quantity, 
            oi.price, oi.total_rental, oi.image_url,
            p.sku, p.zone, p.aisle, p.shelf, p.price as damage_price
        FROM order_items oi
        LEFT JOIN products p ON p.product_id = oi.product_id
        WHERE oi.order_id = :order_id
    """), {"order_id": order["id"]})
    
    items = []
    total_rent = 0
    total_deposit = 0
    
    for row in items_result:
        qty = int(row[2] or 1)
        price_per_day = float(row[3] or 0)
        total_rental = float(row[4] or 0) or (price_per_day * qty * order["rental_days"])
        # Застава = 50% від повного збитку (damage_price)
        damage_price = float(row[10] or 0) if row[10] else 0
        full_damage_cost = damage_price if damage_price else price_per_day * 6  # fallback: 6 днів оренди
        deposit_per_item = full_damage_cost / 2  # Застава = 50% від повного збитку
        
        item_deposit = deposit_per_item * qty
        
        # Build location
        location = None
        if row[7] or row[8] or row[9]:
            location = "-".join(filter(None, [row[7], row[8], row[9]]))
        
        items.append({
            "name": row[0] or "",
            "sku": row[6] or f"P-{row[1]}" if row[1] else "",
            "quantity": qty,
            "price_per_day": price_per_day,
            "deposit_per_item": deposit_per_item,
            "total_rent": total_rental,
            "total_deposit": item_deposit,
            "image_url": row[5],
            "location": location
        })
        
        total_rent += total_rental
        total_deposit += item_deposit
    
    # Use calculated totals or order totals
    if not total_rent:
        total_rent = order["total_price"]
    if not total_deposit:
        total_deposit = order["deposit_amount"]
    
    # Компанія - FarforDecorOrenda
    # © FarforDecorOrenda 2025
    # Реальні дані з офіційних документів farforrent.com.ua
    company = {
        "name": "FarforDecorOrenda",
        "legal_name": "ФОП Арсалані Олександра Ігорівна",
        "address": "61082, Харківська обл., м. Харків, просп. Московський, буд. 216/3А, кв. 46",
        "warehouse": "м. Харків, Військовий провулок, 1",
        "phone": "+380 XX XXX XX XX",  # TODO: додати реальний номер
        "email": "rfarfordecor@gmail.com.ua",
        "website": "https://www.farforrent.com.ua",
        "tax_id": "3234423422",
        "edrpou": "3234423422",  # ІПН для ФОП
        "iban": "UA00 0000 0000 0000 0000 0000 00000",  # TODO: додати реальний IBAN
        # Правові документи
        "terms_url": "https://www.farforrent.com.ua/terms",
        "privacy_url": "https://www.farforrent.com.ua/privacy",
        "offer_url": "https://www.farforrent.com.ua/oferta",
        "damage_url": "https://www.farforrent.com.ua/opis-zbitk%D1%96v",
        # Умови оренди
        "min_order": 2000,
        "discount_threshold": 30000,
        "discount_percent": 10,
        "deposit_rule": "50% від повної вартості можливого збитку",
        "prepayment_percent": 50,
        "cancellation_days": 2,
        "penalty_daily_percent": 0.5,
        # Робочі години
        "working_hours": "пн-пт 10:00-18:00",
        "issue_hours": "пн-сб 10:00-17:00",
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
    """Збирає дані картки видачі для документа (RentalHub schema)"""
    
    result = db.execute(text("""
        SELECT 
            ic.id, ic.order_id, ic.order_number, ic.status,
            ic.items, ic.prepared_at, ic.issued_at,
            o.customer_name, o.customer_phone, o.phone,
            o.rental_start_date, o.rental_end_date, o.rental_days,
            o.delivery_type, o.delivery_address, o.notes,
            ic.requisitors, ic.preparation_notes
        FROM issue_cards ic
        JOIN orders o ON o.order_id = ic.order_id
        WHERE ic.id = :id
    """), {"id": issue_card_id})
    
    row = result.fetchone()
    if not row:
        raise ValueError(f"Issue card not found: {issue_card_id}")
    
    order_id = row[1]
    
    # Parse items JSON
    items_json = row[4]
    items = json.loads(items_json) if isinstance(items_json, str) else (items_json or [])
    
    # If items are empty, fallback to order_items
    if not items and order_id:
        items_result = db.execute(text("""
            SELECT 
                oi.product_name as name, oi.product_id, oi.quantity,
                p.sku, p.zone, p.aisle, p.shelf
            FROM order_items oi
            LEFT JOIN products p ON p.product_id = oi.product_id
            WHERE oi.order_id = :order_id
        """), {"order_id": order_id})
        
        items = []
        for item_row in items_result:
            location_parts = [item_row[4], item_row[5], item_row[6]]
            location = "-".join(filter(None, location_parts)) if any(location_parts) else "N/A"
            items.append({
                "name": item_row[0] or "",
                "product_id": item_row[1],
                "quantity": item_row[2] or 1,
                "sku": item_row[3] or "",
                "location": location
            })
    
    # Use customer_phone or phone fallback
    phone = row[8] or row[9] or ""
    
    # Parse requisitors (row[16])
    requisitors_json = row[16] if len(row) > 16 else None
    requisitors = []
    if requisitors_json:
        try:
            requisitors = json.loads(requisitors_json) if isinstance(requisitors_json, str) else requisitors_json
        except:
            requisitors = []
    
    # Preparation notes (row[17])
    preparation_notes = row[17] if len(row) > 17 else ""
    
    # Enrich items with location data
    for item in items:
        product_id = item.get('product_id') or item.get('inventory_id')
        sku = item.get('sku')
        if product_id or sku:
            loc_query = "SELECT zone, aisle, shelf, sku FROM products WHERE "
            params = {}
            if product_id:
                loc_query += "product_id = :product_id"
                params["product_id"] = product_id
            else:
                loc_query += "sku = :sku"
                params["sku"] = sku
            
            loc_result = db.execute(text(loc_query), params)
            loc_row = loc_result.fetchone()
            if loc_row:
                if loc_row[0] or loc_row[1] or loc_row[2]:
                    item['location'] = "-".join(filter(None, [loc_row[0], loc_row[1], loc_row[2]]))
                if not item.get('sku') and loc_row[3]:
                    item['sku'] = loc_row[3]
    
    issue_card = {
        "id": row[0],
        "order_id": row[1],
        "order_number": row[2] or f"OC-{row[1]}",
        "status": row[3],
        "customer_name": row[7] or "",
        "customer_phone": phone,
        "prepared_at": row[5].strftime("%d.%m.%Y %H:%M") if row[5] else "",
        "issued_at": row[6].strftime("%d.%m.%Y %H:%M") if row[6] else "",
        "rental_start_date": row[10].strftime("%d.%m.%Y") if row[10] else "",
        "rental_end_date": row[11].strftime("%d.%m.%Y") if row[11] else "",
        "rental_days": row[12] or 1,
        "delivery_type": row[13] or "pickup",
        "delivery_address": row[14] or "",
        "notes": row[15] or "",
        "preparation_notes": preparation_notes or ""
    }
    
    company = {
        "name": "FarforRent",
        "legal_name": "ФОП Прізвище І.Б.",
        "phone": "+380 XX XXX XX XX"
    }
    
    return {
        "issue_card": issue_card,
        "items": items,
        "requisitors": requisitors,
        "company": company,
        "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "options": options
    }

def build_return_data(db: Session, order_id: str, options: dict) -> dict:
    """Збирає дані повернення для Акту приймання - читає з return_cards"""
    
    # Спочатку отримаємо базові дані замовлення
    order_data = build_order_data(db, order_id, options)
    
    # Company data
    company = {
        "name": "FarforRent",
        "legal_name": "ФОП Арсалані Олександра Ігорівна",
        "address": "61082, Харківська обл., м. Харків, просп. Московський, буд. 216/3А, кв. 46",
        "warehouse": "м. Харків, Військовий провулок, 1",
        "phone": "+380 XX XXX XX XX",
        "email": "info@farforrent.com.ua",
    }
    
    # Спробуємо отримати дані з return_cards
    receivers = []
    return_items = []
    fees = {}
    
    try:
        result = db.execute(text("""
            SELECT items, receivers, notes, fees
            FROM return_cards
            WHERE order_id = :order_id
        """), {"order_id": order_id})
        
        row = result.fetchone()
        if row:
            # Парсимо JSON поля
            if row[0]:  # items
                return_items = json.loads(row[0]) if isinstance(row[0], str) else row[0]
            if row[1]:  # receivers
                receivers = json.loads(row[1]) if isinstance(row[1], str) else row[1]
            if row[3]:  # fees
                fees = json.loads(row[3]) if isinstance(row[3], str) else row[3]
    except Exception as e:
        # Якщо таблиці немає або помилка - використовуємо items з замовлення
        pass
    
    # Якщо return_items порожній - використовуємо items з замовлення
    if not return_items:
        return_items = order_data.get("items", [])
    
    return {
        "order": order_data.get("order", {}),
        "items": return_items,
        "receivers": receivers,
        "fees": fees,
        "totals": order_data.get("totals", {}),
        "company": company,
        "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "options": options
    }


def build_damage_data(db: Session, damage_case_id: str, options: dict) -> dict:
    """Збирає дані кейсу пошкодження для документа"""
    # Company data
    company = {
        "name": "FarforDecorOrenda",
        "legal_name": "ФОП Арсалані Олександра Ігорівна",
        "address": "61082, Харківська обл., м. Харків, просп. Московський, буд. 216/3А, кв. 46",
        "warehouse": "м. Харків, Військовий провулок, 1",
        "phone": "+380 XX XXX XX XX",
        "email": "rfarfordecor@gmail.com.ua",
        "iban": "UA00 0000 0000 0000 0000 0000 00000",
        "edrpou": "3234423422",
    }
    
    # If damage_case_id is actually an order_id, get order data
    if damage_case_id:
        order_data = build_order_data(db, damage_case_id, options)
        return {
            "damage_case": options.get("damage_case", {}),
            "order": order_data.get("order", {}),
            "items": options.get("damage_items", order_data.get("items", [])),
            "totals": order_data.get("totals", {}),
            "company": company,
            "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
            "options": options
        }
    
    return {
        "damage_case": options.get("damage_case", {}),
        "items": options.get("damage_items", []),
        "totals": {},
        "company": company,
        "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "options": options
    }


def build_vendor_task_data(db: Session, vendor_task_id: str, options: dict) -> dict:
    """Збирає дані завдання підрядника для документа"""
    company = {
        "name": "FarforDecorOrenda",
        "legal_name": "ФОП Арсалані Олександра Ігорівна",
        "address": "61082, Харківська обл., м. Харків, просп. Московський, буд. 216/3А, кв. 46",
    }
    
    # Try to get vendor task from database
    vendor_task = options.get("vendor_task", {
        "vendor_name": options.get("vendor_name", ""),
        "work_type": options.get("work_type", "Хімчистка"),
        "items_description": options.get("items_description", ""),
        "total_cost": options.get("total_cost", 0),
        "items": options.get("items", [])
    })
    
    return {
        "vendor_task": vendor_task,
        "company": company,
        "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "options": options
    }
