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
    
    # Damage settlement - special handling for order-based damage
    damage_settlement_docs = ["damage_settlement_act"]
    
    # Damage breakdown - shows pre_issue damages with photos
    damage_breakdown_docs = ["damage_breakdown"]
    
    # Vendor task based documents
    vendor_docs = ["vendor_work_act"]
    
    # Order modification documents
    modification_docs = ["order_modification"]
    
    if doc_type in return_docs:
        return build_return_data(db, entity_id, options)
    elif doc_type in damage_settlement_docs:
        return build_damage_settlement_data(db, entity_id, options)
    elif doc_type in damage_breakdown_docs:
        return build_damage_breakdown_data(db, entity_id, options)
    elif doc_type in modification_docs:
        return build_order_modification_data(db, entity_id, options)
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


def build_damage_settlement_data(db: Session, order_id: str, options: dict) -> dict:
    """
    Збирає дані для Акту утримання із застави з реальними даними шкоди.
    Підтягує product_damage_history для цього ордера.
    """
    
    # Основні дані замовлення
    result = db.execute(text("""
        SELECT 
            order_id, order_number, status, customer_name, customer_phone,
            total_price, deposit_amount, rental_start_date, rental_end_date,
            damage_fee
        FROM orders
        WHERE order_id = :order_id
    """), {"order_id": order_id})
    
    order_row = result.fetchone()
    if not order_row:
        raise ValueError(f"Order not found: {order_id}")
    
    order = {
        "id": order_row[0],
        "order_number": order_row[1] or f"OC-{order_row[0]}",
        "status": order_row[2],
        "customer_name": order_row[3] or "",
        "customer_phone": order_row[4] or "",
        "total_price": float(order_row[5] or 0),
        "deposit_amount": float(order_row[6] or 0),
        "rental_start_date": order_row[7].strftime("%d.%m.%Y") if order_row[7] else "",
        "rental_end_date": order_row[8].strftime("%d.%m.%Y") if order_row[8] else "",
        "damage_fee": float(order_row[9] or 0),
    }
    
    # Отримуємо дані про шкоду з product_damage_history
    damage_result = db.execute(text("""
        SELECT 
            pdh.id, pdh.product_name, pdh.sku, pdh.damage_type, pdh.severity,
            pdh.fee, pdh.note, pdh.processing_type, pdh.processing_status,
            pdh.qty, pdh.fee_per_item,
            DATE_FORMAT(pdh.created_at, '%d.%m.%Y') as damage_date
        FROM product_damage_history pdh
        WHERE pdh.order_id = :order_id
        ORDER BY pdh.created_at DESC
    """), {"order_id": order_id})
    
    damage_items = []
    total_damage_fee = 0
    total_laundry_fee = 0
    
    damage_type_names = {
        "broken": "Зламано",
        "scratched": "Подряпано", 
        "stained": "Плями",
        "chipped": "Відколото",
        "cracked": "Тріщина",
        "missing": "Відсутнє",
        "dirty": "Забруднено",
        "other": "Інше"
    }
    
    severity_names = {
        "low": "Незначна",
        "medium": "Середня",
        "high": "Значна",
        "critical": "Критична"
    }
    
    for row in damage_result:
        fee = float(row[5] or 0)
        qty = int(row[9] or 1)
        fee_per_item = float(row[10] or 0) if row[10] else (fee / qty if qty else fee)
        processing_type = row[7] or "none"
        
        if processing_type == "laundry":
            total_laundry_fee += fee
        else:
            total_damage_fee += fee
        
        damage_items.append({
            "id": row[0],
            "product_name": row[1] or "",
            "sku": row[2] or "",
            "damage_type": damage_type_names.get(row[3], row[3] or ""),
            "damage_type_code": row[3] or "",
            "severity": severity_names.get(row[4], row[4] or ""),
            "severity_code": row[4] or "",
            "fee": fee,
            "fee_per_item": fee_per_item,
            "qty": qty,
            "note": row[6] or "",
            "processing_type": row[7] or "",
            "processing_status": row[8] or "",
            "damage_date": row[11] or ""
        })
    
    # Розрахунки
    deposit = order["deposit_amount"]
    damage_amount = total_damage_fee
    cleaning_fee = total_laundry_fee
    
    # Прострочення (якщо є в options)
    late_days = options.get("late_days", 0)
    late_fee = options.get("late_fee", 0)
    
    total_deduction = damage_amount + cleaning_fee + late_fee
    refund_amount = max(0, deposit - total_deduction)
    
    company = {
        "name": "FarforDecorOrenda",
        "legal_name": "ФОП Арсалані Олександра Ігорівна",
        "address": "61082, Харківська обл., м. Харків, просп. Московський, буд. 216/3А, кв. 46",
        "phone": "+380 XX XXX XX XX",
        "email": "rfarfordecor@gmail.com.ua",
    }
    
    return {
        "order": order,
        "damage_items": damage_items,
        "totals": {
            "deposit": deposit,
            "damage_count": len(damage_items),
        },
        "deductions": {
            "damage_amount": damage_amount,
            "cleaning_fee": cleaning_fee,
            "late_days": late_days,
            "late_fee": late_fee,
            "total_deduction": total_deduction,
            "refund_amount": refund_amount,
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
    
    # ЗАВЖДИ беремо items з order_items для актуальних product_id
    items = []
    if order_id:
        items_result = db.execute(text("""
            SELECT 
                oi.product_name as name, oi.product_id, oi.quantity,
                p.sku, p.zone, p.aisle, p.shelf, p.image_url
            FROM order_items oi
            LEFT JOIN products p ON p.product_id = oi.product_id
            WHERE oi.order_id = :order_id AND (oi.status = 'active' OR oi.status IS NULL)
        """), {"order_id": order_id})
        
        for item_row in items_result:
            location_parts = [item_row[4], item_row[5], item_row[6]]
            location = "-".join(filter(None, [str(x) for x in location_parts if x])) if any(location_parts) else "N/A"
            items.append({
                "name": item_row[0] or "",
                "product_id": item_row[1],
                "quantity": item_row[2] or 1,
                "sku": item_row[3] or "",
                "location": location,
                "image_url": item_row[7]
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
    
    # Load pre_damage (шкода зафіксована при видачі) for each item
    for item in items:
        product_id = item.get('product_id') or item.get('inventory_id')
        if product_id and order_id:
            try:
                damage_result = db.execute(text("""
                    SELECT damage_type, note, severity, photo_url, created_by,
                           DATE_FORMAT(created_at, '%d.%m.%Y %H:%i') as created_at
                    FROM product_damage_history
                    WHERE order_id = :order_id 
                    AND product_id = :product_id 
                    AND stage = 'pre_issue'
                    ORDER BY created_at
                """), {"order_id": order_id, "product_id": product_id})
                
                pre_damage = []
                for d_row in damage_result:
                    pre_damage.append({
                        "damage_type": d_row[0],
                        "type": d_row[0],  # alias for template
                        "note": d_row[1] or "",
                        "severity": d_row[2] or "low",
                        "photo_url": d_row[3],
                        "created_by": d_row[4],
                        "created_at": d_row[5]
                    })
                
                if pre_damage:
                    item['pre_damage'] = pre_damage
                    item['has_pre_damage'] = True
                else:
                    item['pre_damage'] = []
                    item['has_pre_damage'] = False
            except Exception as e:
                print(f"Warning: Could not load pre_damage for product {product_id}: {e}")
                item['pre_damage'] = []
                item['has_pre_damage'] = False
    
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
        "name": "FarforDecorOrenda",
        "legal_name": "ФОП Арсалані Олександра Ігорівна",
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



def build_order_modification_data(db: Session, order_id: str, options: dict) -> dict:
    """
    Збирає дані для документа Дозамовлення
    Включає історію змін та відмовлені позиції
    """
    
    # Основні дані замовлення
    result = db.execute(text("""
        SELECT 
            order_id, order_number, customer_name, customer_phone, customer_email,
            rental_start_date, rental_end_date, rental_days,
            total_price, deposit_amount, status
        FROM orders
        WHERE order_id = :order_id
    """), {"order_id": order_id})
    
    order_row = result.fetchone()
    if not order_row:
        raise ValueError(f"Order not found: {order_id}")
    
    order = {
        "order_id": order_row[0],
        "order_number": order_row[1] or f"OC-{order_row[0]}",
        "customer_name": order_row[2] or "",
        "customer_phone": order_row[3] or "",
        "customer_email": order_row[4] or "",
        "rental_start_date": order_row[5].strftime("%d.%m.%Y") if order_row[5] else "",
        "rental_end_date": order_row[6].strftime("%d.%m.%Y") if order_row[6] else "",
        "rental_days": order_row[7] or 1,
        "status": order_row[10]
    }
    
    # Поточні суми
    new_totals = {
        "total_price": float(order_row[8] or 0),
        "deposit_amount": float(order_row[9] or 0)
    }
    
    # Історія змін
    modifications = []
    total_price_change = 0
    total_deposit_change = 0
    
    try:
        mod_result = db.execute(text("""
            SELECT id, modification_type, product_id, product_name,
                   old_quantity, new_quantity, old_price, new_price,
                   price_change, deposit_change, reason, created_by,
                   DATE_FORMAT(created_at, '%d.%m.%Y %H:%i') as created_at
            FROM order_modifications
            WHERE order_id = :order_id
            ORDER BY created_at ASC
        """), {"order_id": order_id})
        
        for row in mod_result:
            price_change = float(row[8] or 0)
            deposit_change = float(row[9] or 0)
            
            total_price_change += price_change
            total_deposit_change += deposit_change
            
            modifications.append({
                "id": row[0],
                "modification_type": row[1],
                "product_id": row[2],
                "product_name": row[3] or "",
                "old_quantity": row[4] or 0,
                "new_quantity": row[5] or 0,
                "old_price": float(row[6] or 0),
                "new_price": float(row[7] or 0),
                "price_change": price_change,
                "deposit_change": deposit_change,
                "reason": row[10] or "",
                "created_by": row[11] or "",
                "created_at": row[12] or ""
            })
    except Exception as e:
        # Table might not exist yet
        print(f"Warning: Could not fetch modifications: {e}")
    
    # Відмовлені позиції
    refused_items = []
    try:
        refused_result = db.execute(text("""
            SELECT product_id, product_name, quantity, original_quantity, refusal_reason
            FROM order_items
            WHERE order_id = :order_id AND status = 'refused'
        """), {"order_id": order_id})
        
        for row in refused_result:
            refused_items.append({
                "product_id": row[0],
                "product_name": row[1] or "",
                "quantity": row[2] or 0,
                "original_quantity": row[3] or row[2] or 0,
                "refusal_reason": row[4] or "Відмова клієнта"
            })
    except Exception as e:
        print(f"Warning: Could not fetch refused items: {e}")
    
    company = {
        "name": "FarforDecorOrenda",
        "legal_name": "ФОП Арсалані Олександра Ігорівна",
        "address": "61082, Харківська обл., м. Харків, просп. Московський, буд. 216/3А, кв. 46",
        "phone": "+380 XX XXX XX XX",
        "email": "rfarfordecor@gmail.com.ua",
    }
    
    return {
        "order": order,
        "modifications": modifications,
        "refused_items": refused_items,
        "new_totals": new_totals,
        "total_price_change": total_price_change,
        "total_deposit_change": total_deposit_change,
        "company": company,
        "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "options": options
    }


def build_damage_breakdown_data(db: Session, order_id: str, options: dict) -> dict:
    """
    Збирає дані для Розшифровки пошкоджень.
    Включає тільки пошкодження зафіксовані при видачі (pre_issue) з фото.
    Використовується для інформування клієнта про існуючі дефекти.
    """
    
    # Основні дані замовлення
    result = db.execute(text("""
        SELECT 
            order_id, order_number, customer_name, customer_phone, customer_email,
            rental_start_date, rental_end_date, rental_days, status
        FROM orders
        WHERE order_id = :order_id
    """), {"order_id": order_id})
    
    order_row = result.fetchone()
    if not order_row:
        raise ValueError(f"Order not found: {order_id}")
    
    order = {
        "order_id": order_row[0],
        "order_number": order_row[1] or f"OC-{order_row[0]}",
        "customer_name": order_row[2] or "",
        "customer_phone": order_row[3] or "",
        "customer_email": order_row[4] or "",
        "rental_start_date": order_row[5].strftime("%d.%m.%Y") if order_row[5] else "",
        "rental_end_date": order_row[6].strftime("%d.%m.%Y") if order_row[6] else "",
        "rental_days": order_row[7] or 1,
        "status": order_row[8]
    }
    
    # Отримуємо пошкодження зафіксовані при видачі (pre_issue)
    damage_result = db.execute(text("""
        SELECT 
            pdh.id, pdh.product_id, pdh.sku, pdh.product_name,
            pdh.damage_type, pdh.severity, pdh.note,
            pdh.photo_url, pdh.created_by,
            DATE_FORMAT(pdh.created_at, '%d.%m.%Y %H:%i') as created_at
        FROM product_damage_history pdh
        WHERE pdh.order_id = :order_id AND pdh.stage = 'pre_issue'
        ORDER BY pdh.product_name, pdh.created_at
    """), {"order_id": order_id})
    
    damage_type_names = {
        "broken": "Зламано",
        "scratched": "Подряпано", 
        "stained": "Плями",
        "chipped": "Відколото",
        "cracked": "Тріщина",
        "missing": "Відсутнє",
        "dirty": "Забруднено",
        "wax": "Віск / залишки свічок",
        "other": "Інше"
    }
    
    severity_names = {
        "low": "low",
        "medium": "medium",
        "high": "high",
        "critical": "critical"
    }
    
    damages = []
    product_ids_with_damage = set()
    
    # Базовий URL для фото (production)
    # Фото зберігаються на сервері у /uploads/damage_photos/
    import os
    BACKEND_URL = os.environ.get('BACKEND_PUBLIC_URL', 'https://backrentalhub.farforrent.com.ua')
    
    def build_photo_url(photo_path: str) -> str:
        """Формує повний URL до фото пошкодження"""
        if not photo_path:
            return None
        
        # Якщо вже повний URL - повертаємо як є
        if photo_path.startswith('http://') or photo_path.startswith('https://'):
            return photo_path
        
        # Якщо шлях вже містить uploads/
        if photo_path.startswith('/uploads/'):
            return f"{BACKEND_URL}{photo_path}"
        elif photo_path.startswith('uploads/'):
            return f"{BACKEND_URL}/{photo_path}"
        else:
            # Тільки ім'я файлу - додаємо шлях до damage_photos
            return f"{BACKEND_URL}/uploads/damage_photos/{photo_path}"
    
    for row in damage_result:
        product_id = row[1]
        product_ids_with_damage.add(product_id)
        
        # Формуємо URL для фото
        photo_url = build_photo_url(row[7])
        
        damages.append({
            "id": row[0],
            "product_id": product_id,
            "sku": row[2] or "",
            "product_name": row[3] or "",
            "damage_type": damage_type_names.get(row[4], row[4] or "Інше"),
            "damage_type_code": row[4],
            "severity": severity_names.get(row[5], row[5] or "low"),
            "note": row[6] or "",
            "photo_url": photo_url,
            "created_by": row[8] or "Система",
            "created_at": row[9] or ""
        })
    
    # Підрахунок загальної кількості позицій в замовленні
    items_result = db.execute(text("""
        SELECT COUNT(DISTINCT product_id) as total_items
        FROM order_items
        WHERE order_id = :order_id AND (status = 'active' OR status IS NULL)
    """), {"order_id": order_id})
    
    total_items_row = items_result.fetchone()
    total_items = total_items_row[0] if total_items_row else 0
    
    company = {
        "name": "FarforDecorOrenda",
        "legal_name": "ФОП Арсалані Олександра Ігорівна",
        "address": "61082, Харківська обл., м. Харків, просп. Московський, буд. 216/3А, кв. 46",
        "phone": "+380 XX XXX XX XX",
        "email": "rfarfordecor@gmail.com.ua",
    }
    
    return {
        "order": order,
        "damages": damages,
        "items_with_damage": len(product_ids_with_damage),
        "total_items": total_items,
        "company": company,
        "generated_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
        "options": options
    }
