"""
Document Registry - повний реєстр з 14 типів документів
FarforRent Document Engine v2.0
"""

DOC_REGISTRY = {
    # ═══════════════════════════════════════════════════════════════
    # 1. Рахунок-оферта (Invoice / Offer)
    # ═══════════════════════════════════════════════════════════════
    "invoice_offer": {
        "name": "Рахунок-оферта",
        "name_en": "Invoice Offer",
        "entity_type": "order",
        "series": "INV",
        "template": "invoice_offer/v1.html",
        "requirements": ["order_id"],
        "description": "Рахунок на передоплату з переліком позицій",
        # Коли генерувати
        "trigger_stage": "draft_to_confirm",
        "trigger_before": "payment",
        # Друк
        "print_required": False,
        "pdf_always": True,
        # Критичність
        "critical_for": ["legal", "finance"],
        "purpose": "юридичний акцепт, фіксація сум, дат, застави"
    },
    
    # ═══════════════════════════════════════════════════════════════
    # 2. Договір оренди (Rental Contract)
    # ═══════════════════════════════════════════════════════════════
    "contract_rent": {
        "name": "Договір оренди",
        "name_en": "Rental Contract",
        "entity_type": "order",
        "series": "CTR",
        "template": "contract_rent/v1.html",
        "requirements": ["order_id"],
        "description": "Універсальний договір оренди декору",
        "trigger_stage": "confirm_to_ready",
        "trigger_before": "issue",
        "print_required": True,  # Бажано перед видачею
        "pdf_always": True,
        "critical_for": ["legal"],
        "purpose": "правила, відповідальність, застава, прострочка, збитки"
    },
    
    # ═══════════════════════════════════════════════════════════════
    # 3. Акт передачі (Issue Act) — ОБОВ'ЯЗКОВИЙ ДРУК
    # ═══════════════════════════════════════════════════════════════
    "issue_act": {
        "name": "Акт передачі",
        "name_en": "Issue Act",
        "entity_type": "issue",
        "series": "ISS",
        "template": "issue_act/v1.html",
        "requirements": ["issue_card_id"],
        "description": "Акт передачі товарів клієнту",
        "trigger_stage": "ready_to_issued",
        "trigger_at": "issue",
        "print_required": True,  # ОБОВ'ЯЗКОВО при видачі
        "pdf_always": True,
        "critical_for": ["legal"],
        "purpose": "що саме передали, старт відповідальності клієнта"
    },
    
    # ═══════════════════════════════════════════════════════════════
    # 4. Чеклист видачі (Issue Checklist) — для складу
    # ═══════════════════════════════════════════════════════════════
    "issue_checklist": {
        "name": "Чеклист видачі",
        "name_en": "Issue Checklist",
        "entity_type": "issue",
        "series": "ICH",
        "template": "issue_checklist/v1.html",
        "requirements": ["issue_card_id"],
        "description": "Чеклист для складу: упаковка, маркування, QR, комплектація",
        "trigger_stage": "packing",
        "trigger_at": "issue_packing",
        "print_required": True,  # Для складу (внутрішній)
        "pdf_always": True,
        "critical_for": ["operations"],
        "purpose": "упаковка, маркування, QR/фото, комплектація"
    },
    
    # ═══════════════════════════════════════════════════════════════
    # 5. Лист комплектації (Packing List) — для складу
    # ═══════════════════════════════════════════════════════════════
    "picking_list": {
        "name": "Лист комплектації",
        "name_en": "Picking List",
        "entity_type": "issue",
        "series": "PCK",
        "template": "picking_list/v1.html",
        "requirements": ["issue_card_id"],
        "description": "Список товарів для збору на складі",
        "trigger_stage": "packing_shipping",
        "trigger_at": "picking",
        "print_required": True,  # Для складу, не клієнту
        "pdf_always": True,
        "critical_for": ["operations"],
        "purpose": "склад → видача, контроль кількості"
    },
    
    # ═══════════════════════════════════════════════════════════════
    # 6. ТТН / Накладна доставки — ОБОВ'ЯЗКОВИЙ при доставці
    # ═══════════════════════════════════════════════════════════════
    "delivery_note": {
        "name": "ТТН / Накладна доставки",
        "name_en": "Delivery Note / Waybill",
        "entity_type": "order",
        "series": "TTN",
        "template": "delivery_note/v1.html",
        "requirements": ["order_id"],
        "description": "Товарно-транспортна накладна для доставки",
        "trigger_stage": "shipping",
        "trigger_condition": "delivery_type != 'pickup'",
        "print_required": True,  # ОБОВ'ЯЗКОВО при доставці
        "pdf_always": True,
        "critical_for": ["legal", "operations"],
        "purpose": "логістика, відповідальність під час перевезення"
    },
    
    # ═══════════════════════════════════════════════════════════════
    # 7. Додаткова угода / Продовження оренди
    # ═══════════════════════════════════════════════════════════════
    "rental_extension": {
        "name": "Додаткова угода",
        "name_en": "Rental Extension Agreement",
        "entity_type": "order",
        "series": "EXT",
        "template": "rental_extension/v1.html",
        "requirements": ["order_id"],
        "description": "Угода про продовження/зміну умов оренди",
        "trigger_stage": "on_rent_dates_changed",
        "trigger_at": "dates_modified",
        "print_required": False,  # Опціонально
        "pdf_always": True,
        "critical_for": ["legal", "finance"],
        "purpose": "легалізує зміну дат/складу, основа для донарахування"
    },
    
    # ═══════════════════════════════════════════════════════════════
    # 8. Акт часткового повернення
    # ═══════════════════════════════════════════════════════════════
    "partial_return_act": {
        "name": "Акт часткового повернення",
        "name_en": "Partial Return Act",
        "entity_type": "return",
        "series": "PRT",
        "template": "partial_return_act/v1.html",
        "requirements": ["order_id", "return_items"],
        "description": "Акт приймання частини товарів",
        "trigger_stage": "returning_partial",
        "trigger_at": "partial_return",
        "print_required": True,  # РЕКОМЕНДОВАНО
        "pdf_always": True,
        "critical_for": ["legal"],
        "purpose": "повернення частинами, знімає спори 'ми вже віддали'"
    },
    
    # ═══════════════════════════════════════════════════════════════
    # 9. Акт приймання / повернення (Return Act) — ОБОВ'ЯЗКОВИЙ
    # ═══════════════════════════════════════════════════════════════
    "return_act": {
        "name": "Акт приймання",
        "name_en": "Return Act",
        "entity_type": "return",
        "series": "RET",
        "template": "return_act/v1.html",
        "requirements": ["order_id"],
        "description": "Акт повернення товарів від клієнта",
        "trigger_stage": "return_intake",
        "trigger_at": "return",
        "print_required": True,  # ОБОВ'ЯЗКОВО, клієнту копія
        "pdf_always": True,
        "critical_for": ["legal"],
        "purpose": "що прийнято, початок перевірки"
    },
    
    # ═══════════════════════════════════════════════════════════════
    # 10. Акт фіксації пошкоджень (Damage Report)
    # ═══════════════════════════════════════════════════════════════
    "damage_report": {
        "name": "Акт фіксації пошкоджень",
        "name_en": "Damage Report",
        "entity_type": "damage_case",
        "series": "DMG",
        "template": "damage_report/v1.html",
        "requirements": ["damage_case_id"],
        "description": "Акт з фото та описом пошкоджень",
        "trigger_stage": "damage_detected",
        "trigger_at": "damage_found",
        "print_required": False,  # Опціонально
        "pdf_always": True,
        "critical_for": ["legal"],
        "purpose": "фото, опис, прив'язка до SKU/серій"
    },
    
    # ═══════════════════════════════════════════════════════════════
    # 11. Акт нарахування збитків / утримання із застави
    # ═══════════════════════════════════════════════════════════════
    "damage_settlement_act": {
        "name": "Акт утримання із застави",
        "name_en": "Damage Settlement Act",
        "entity_type": "order",
        "series": "DSA",
        "template": "damage_settlement_act/v1.html",
        "requirements": ["order_id"],
        "description": "Акт взаєморозрахунків по збитках",
        "trigger_stage": "after_check_settlement",
        "trigger_at": "settlement",
        "print_required": True,  # Бажано
        "pdf_always": True,
        "critical_for": ["legal", "finance"],
        "purpose": "юридична підстава утримання, суми списання"
    },
    
    # ═══════════════════════════════════════════════════════════════
    # 12. Рахунок на пошкодження (Damage Invoice)
    # ═══════════════════════════════════════════════════════════════
    "damage_invoice": {
        "name": "Рахунок на пошкодження",
        "name_en": "Damage Invoice",
        "entity_type": "damage_case",
        "series": "DIN",
        "template": "damage_invoice/v1.html",
        "requirements": ["damage_case_id"],
        "description": "Рахунок на доплату за пошкодження",
        "trigger_stage": "damage_exceeds_deposit",
        "trigger_condition": "damage_amount > deposit_amount",
        "print_required": False,  # За потреби
        "pdf_always": True,
        "critical_for": ["finance"],
        "purpose": "відокремити damage budget від rent, фіскалізація"
    },
    
    # ═══════════════════════════════════════════════════════════════
    # 13. Акт повернення застави — РЕКОМЕНДОВАНО ДРУК
    # ═══════════════════════════════════════════════════════════════
    "deposit_refund_act": {
        "name": "Акт повернення застави",
        "name_en": "Deposit Refund Act",
        "entity_type": "order",
        "series": "DRA",
        "template": "deposit_refund_act/v1.html",
        "requirements": ["order_id"],
        "description": "Підтвердження повернення застави клієнту",
        "trigger_stage": "settlement_closed",
        "trigger_at": "deposit_refund",
        "print_required": True,  # РЕКОМЕНДОВАНО
        "pdf_always": True,
        "critical_for": ["legal", "finance"],
        "purpose": "підтвердження повернення застави, 'претензій немає'"
    },
    
    # ═══════════════════════════════════════════════════════════════
    # 14. Акт виконаних робіт підрядника (хімчистка / реставрація)
    # ═══════════════════════════════════════════════════════════════
    "vendor_work_act": {
        "name": "Акт виконаних робіт",
        "name_en": "Vendor Work Completion Act",
        "entity_type": "vendor_task",
        "series": "VWA",
        "template": "vendor_work_act/v1.html",
        "requirements": ["vendor_task_id"],
        "description": "Акт виконання робіт підрядником",
        "trigger_stage": "vendor_task_completed",
        "trigger_at": "vendor_completion",
        "print_required": False,  # Для бухгалтера
        "pdf_always": True,
        "critical_for": ["finance"],
        "purpose": "підтвердження витрат, бухгалтерія, payroll/vendors"
    },
    
    # ═══════════════════════════════════════════════════════════════
    # LEGACY / Aliases
    # ═══════════════════════════════════════════════════════════════
    "return_intake_checklist": {
        "name": "Чеклист приймання",
        "name_en": "Return Intake Checklist",
        "entity_type": "return",
        "series": "RIC",
        "template": "return_intake_checklist/v1.html",
        "requirements": ["order_id"],
        "description": "Чеклист перевірки стану товарів при поверненні",
        "trigger_stage": "return_intake",
        "print_required": True,
        "pdf_always": True,
        "critical_for": ["operations"],
        "purpose": "перевірка стану при поверненні"
    },
    "deposit_settlement_act": {
        "name": "Акт взаєморозрахунків",
        "name_en": "Deposit Settlement Act",
        "entity_type": "order",
        "series": "DSA",
        "template": "deposit_settlement_act/v1.html",
        "requirements": ["order_id"],
        "description": "Акт взаєморозрахунків по заставі (legacy)",
        "trigger_stage": "settlement",
        "print_required": True,
        "pdf_always": True,
        "critical_for": ["finance"],
        "purpose": "legacy alias for damage_settlement_act"
    },
    "invoice_additional": {
        "name": "Додатковий рахунок",
        "name_en": "Additional Invoice",
        "entity_type": "order",
        "series": "INV",
        "template": "invoice_additional/v1.html",
        "requirements": ["order_id"],
        "description": "Рахунок на доплату (прострочка, додаткові послуги)",
        "trigger_stage": "after_return",
        "print_required": False,
        "pdf_always": True,
        "critical_for": ["finance"],
        "purpose": "донарахування за прострочку або послуги"
    },
    "damage_report_client": {
        "name": "Акт пошкоджень (клієнт)",
        "name_en": "Damage Report Client",
        "entity_type": "damage_case",
        "series": "DMG",
        "template": "damage_report/v1.html",
        "requirements": ["damage_case_id"],
        "description": "Акт пошкоджень для клієнта (legacy)",
        "trigger_stage": "damage_detected",
        "print_required": False,
        "pdf_always": True,
        "critical_for": ["legal"],
        "purpose": "legacy alias for damage_report"
    },
}

# ═══════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════

def get_doc_config(doc_type: str) -> dict:
    """Отримати конфігурацію документа за типом"""
    if doc_type not in DOC_REGISTRY:
        raise ValueError(f"Unknown document type: {doc_type}")
    return DOC_REGISTRY[doc_type]

def get_docs_for_entity(entity_type: str) -> list:
    """Отримати список доступних документів для типу сутності"""
    return [
        {"doc_type": key, **value}
        for key, value in DOC_REGISTRY.items()
        if value["entity_type"] == entity_type
    ]

def get_required_print_docs() -> list:
    """Отримати список документів з обов'язковим друком"""
    return [
        {"doc_type": key, **value}
        for key, value in DOC_REGISTRY.items()
        if value.get("print_required") == True
    ]

def get_docs_by_trigger(trigger_stage: str) -> list:
    """Отримати документи за стадією тригера"""
    return [
        {"doc_type": key, **value}
        for key, value in DOC_REGISTRY.items()
        if value.get("trigger_stage") == trigger_stage
    ]

def get_critical_docs(critical_type: str) -> list:
    """Отримати критичні документи (legal/finance/operations)"""
    return [
        {"doc_type": key, **value}
        for key, value in DOC_REGISTRY.items()
        if critical_type in value.get("critical_for", [])
    ]
