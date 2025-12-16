"""
Document Registry - конфігурація всіх типів документів
"""

DOC_REGISTRY = {
    # === P0: Критичні ===
    "invoice_offer": {
        "name": "Рахунок-оферта",
        "name_en": "Invoice Offer",
        "entity_type": "order",
        "series": "INV",
        "template": "invoice_offer/v1.html",
        "requirements": ["order_id"],
        "description": "Рахунок на передоплату з переліком позицій"
    },
    "contract_rent": {
        "name": "Договір оренди",
        "name_en": "Rental Contract",
        "entity_type": "order",
        "series": "CTR",
        "template": "contract_rent/v1.html",
        "requirements": ["order_id"],
        "description": "Універсальний договір оренди декору"
    },
    "issue_act": {
        "name": "Акт передачі",
        "name_en": "Issue Act",
        "entity_type": "issue",
        "series": "ISS",
        "template": "issue_act/v1.html",
        "requirements": ["issue_card_id"],
        "description": "Акт передачі товарів клієнту"
    },
    "return_act": {
        "name": "Акт повернення",
        "name_en": "Return Act",
        "entity_type": "return",
        "series": "RET",
        "template": "return_act/v1.html",
        "requirements": ["order_id"],
        "description": "Акт повернення товарів від клієнта"
    },
    "picking_list": {
        "name": "Лист комплектації",
        "name_en": "Picking List",
        "entity_type": "issue",
        "series": "PCK",
        "template": "picking_list/v1.html",
        "requirements": ["issue_card_id"],
        "description": "Список товарів для збору на складі"
    },
    "return_intake_checklist": {
        "name": "Чеклист приймання",
        "name_en": "Return Intake Checklist",
        "entity_type": "return",
        "series": "RIC",
        "template": "return_intake_checklist/v1.html",
        "requirements": ["order_id"],
        "description": "Чеклист перевірки стану товарів при поверненні"
    },
    
    # === P1: Важливі ===
    "damage_report_client": {
        "name": "Акт пошкоджень",
        "name_en": "Damage Report",
        "entity_type": "damage_case",
        "series": "DMG",
        "template": "damage_report_client/v1.html",
        "requirements": ["damage_case_id"],
        "description": "Акт пошкоджень для клієнта"
    },
    "deposit_settlement_act": {
        "name": "Акт взаєморозрахунків",
        "name_en": "Deposit Settlement Act",
        "entity_type": "order",
        "series": "DSA",
        "template": "deposit_settlement_act/v1.html",
        "requirements": ["order_id"],
        "description": "Акт взаєморозрахунків по заставі"
    },
    "invoice_additional": {
        "name": "Додатковий рахунок",
        "name_en": "Additional Invoice",
        "entity_type": "order",
        "series": "INV",
        "template": "invoice_additional/v1.html",
        "requirements": ["order_id"],
        "description": "Рахунок на доплату після повернення"
    },
}

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
