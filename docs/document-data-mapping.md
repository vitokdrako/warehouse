# Document Data Mapping — RentalHub

Цей файл описує звідки береться кожне поле для шаблонів документів.

## 📊 Data Contract Structure

```json
{
  "meta": {},        // Метадані документа
  "agreement": {},   // Дані рамкового договору
  "order": {},       // Дані замовлення
  "landlord": {},    // Дані орендодавця (компанія)
  "tenant": {},      // Дані орендаря (платник)
  "items": [],       // Позиції замовлення
  "totals": {},      // Підсумки
  "damage": {},      // Дані про пошкодження (для defect_act)
  "return_data": {}, // Дані повернення (для return_act)
  "signatures": {}   // Підписи
}
```

---

## 🔗 Field Mapping

### meta (Метадані документа)

| Field | Source | Notes |
|-------|--------|-------|
| `doc_type` | API request | `master_agreement`, `annex_to_contract`, `issue_act`, `return_act`, `defect_act`, `quote` |
| `doc_number` | Generated | `MA-YYYY-NNN`, `ANN-YYYY-NNN`, `ACT-YYYY-NNN` |
| `annex_seq` | `order_annexes.version` | Порядковий номер додатку для цього ордера |
| `version` | `documents.version` or `order_annexes.version` | Версія документа |
| `status` | `documents.status` | `draft`, `generated`, `sent`, `signed` |
| `watermark_text` | Derived from status | `ЧЕРНЕТКА` if draft, `ПІДПИСАНО` if signed, empty otherwise |
| `generated_at` | `NOW()` | ISO datetime |
| `contract_day` | Parsed from date | День створення |
| `contract_month` | Parsed from date | Місяць (українською) |
| `contract_year` | Parsed from date | Рік |
| `doc_day`, `doc_month`, `doc_year` | Same as above | Для актів/додатків |
| `act_day`, `act_month`, `act_year` | Same as above | Для актів |
| `issue_notes` | Manual input | Примітки при видачі |
| `return_notes` | Manual input | Примітки при поверненні |
| `defect_notes` | Manual input | Примітки до дефектного акту |
| `defect_act_number` | Reference | Номер дефектного акту (для return_act) |
| `prepared_by_name` | `users.firstname + lastname` | Менеджер, що підготував |
| `quote_valid_until` | `generated_at + 7 days` | Термін дії кошторису |

### agreement (Рамковий договір)

| Field | Source | Notes |
|-------|--------|-------|
| `contract_number` | `master_agreements.contract_number` | `MA-YYYY-NNN` |
| `contract_date` | `master_agreements.created_at` | Дата створення |
| `contract_day`, `contract_month`, `contract_year` | Parsed from `created_at` | |
| `signed_at` | `master_agreements.signed_at` | Дата підписання |
| `valid_from` | `master_agreements.valid_from` | Початок дії |
| `valid_until` | `master_agreements.valid_until` | Кінець дії |

### order (Замовлення)

| Field | Source | Notes |
|-------|--------|-------|
| `order_id` | `orders.order_id` | |
| `order_number` | `orders.order_number` | `OC-NNNN` |
| `issue_date` | `orders.rental_start_date` | Формат: DD.MM.YYYY |
| `return_date` | `orders.rental_end_date` | Формат: DD.MM.YYYY |
| `days` | `orders.rental_days` | Кількість днів оренди |
| `warehouse_address` | Config or `orders.pickup_address` | Default: `м. Київ, вул. Будіндустрії 4` |
| `pickup_time` | Config | Default: `17:00` |
| `deal_mode` | `orders.deal_mode` | `rent` or `sale` |

### landlord (Орендодавець)

| Field | Source | Notes |
|-------|--------|-------|
| `name` | Config | `ФОП Николенко Наталя Станіславівна` |
| `tax_status` | Config | `єдиний податок` |
| `tax_id` | Config | ІПН/ЄДРПОУ |
| `iban` | Config | Рахунок |
| `address` | Config | Юридична адреса |
| `signer_name` | Config | Ім'я підписанта |
| `signer_role` | Config | Optional |

### tenant (Орендар/Платник)

| Field | Source | Notes |
|-------|--------|-------|
| `payer_profile_id` | `payer_profiles.id` | |
| `type` | `payer_profiles.payer_type` | `individual`, `fop_simple`, `fop_general`, `llc_simple`, `llc_general` |
| `type_label` | Derived | Людська назва типу |
| `legal_name` | `payer_profiles.company_name` | Назва компанії/ФОП |
| `tax_id` | `payer_profiles.edrpou` | ЄДРПОУ/ІПН |
| `iban` | `payer_profiles.iban` | Рахунок |
| `bank_name` | `payer_profiles.bank_name` | Банк |
| `address` | `payer_profiles.address` | Адреса |
| `signer_name` | `payer_profiles.director_name` | Ім'я підписанта |
| `signer_role` | Derived from type | `Директор` for LLC, empty for FOP |
| `contact_person` | **Manual input** | Контактна особа |
| `contact_channel` | **Manual input** | `Telegram`, `Viber`, `WhatsApp`, `Email` |
| `contact_value` | **Manual input** | Номер/email |
| `phone` | `payer_profiles.phone` | |
| `email` | `payer_profiles.email` | |

### items (Позиції)

| Field | Source | Notes |
|-------|--------|-------|
| `name` | `order_items.product_name` | |
| `sku` | `products.sku` | |
| `qty` | `order_items.quantity` | |
| `rent_price_total` | `order_items.total_rental` | Загальна вартість оренди |
| `packaging_type` | `products.packaging_type` or **Manual** | Тип пакування |
| `days` | `order.days` | Кількість днів |

### totals (Підсумки)

| Field | Source | Notes |
|-------|--------|-------|
| `rent_total` | `orders.total_price` or SUM(`order_items.total_rental`) | |
| `rent_per_day` | `rent_total / days` | |
| `deposit_security` | `orders.deposit_amount` | Забезпечувальний платіж |
| `advance_payment` | `fin_payments` where `payment_type = 'advance'` | Передоплата |
| `currency` | Default `UAH` | |

### damage (Пошкодження)

| Field | Source | Notes |
|-------|--------|-------|
| `has_damage` | `product_damage_history` exists | |
| `rows[]` | `product_damage_history` | |
| `rows[].name` | `product_damage_history.product_name` | |
| `rows[].description` | `product_damage_history.defect_description` | |
| `rows[].amount` | `product_damage_history.fee` | Сума компенсації |
| `total` | SUM(`rows[].amount`) | |
| `photos[]` | `damage_photos` or **Manual upload** | |

### return_data (Повернення)

| Field | Source | Notes |
|-------|--------|-------|
| `condition_mode` | **Manual input** | `excellent`, `ok`, `damaged` |

### signatures (Підписи)

| Field | Source | Notes |
|-------|--------|-------|
| `landlord.signed` | `document_signatures` | Boolean |
| `landlord.image_url` | `document_signatures.signature_image` | Base64 or URL |
| `landlord.signed_at` | `document_signatures.signed_at` | |
| `tenant.signed` | Same | |
| `tenant.image_url` | Same | |
| `tenant.signed_at` | Same | |

---

## 📝 Manual Input Fields (UI required)

Ці поля вводяться менеджером перед генерацією документа:

### Annex/Acts:
- `tenant.contact_person` — Контактна особа
- `tenant.contact_channel` — Канал зв'язку (dropdown)
- `tenant.contact_value` — Номер/email

### Return Act:
- `return_data.condition_mode` — Стан повернення (radio: excellent/ok/damaged)

### Defect Act:
- `damage.rows[].description` — Опис дефекту (кожна позиція)
- `damage.rows[].amount` — Сума компенсації
- `meta.defect_notes` — Загальні примітки
- `damage.photos[]` — Фото пошкоджень (upload)

### Quote:
- `meta.quote_valid_until` — Термін дії (default: +7 days)

---

## 🔐 Watermark Rules

| Status | Watermark Text |
|--------|----------------|
| `draft` | `ЧЕРНЕТКА` |
| `generated` | — (none) |
| `sent` | — (none) |
| `signed` | `ПІДПИСАНО` |

---

## 📁 Template Files

```
/backend/templates/documents/
├── _partials/
│   ├── base.css           # Спільні стилі
│   ├── header.html        # Шапка документа
│   └── footer_sign.html   # Блок підписів
├── master_agreement.html  # Рамковий договір
├── annex_to_contract.html # Додаток до договору
├── issue_act.html         # Акт передачі
├── return_act.html        # Акт повернення
├── defect_act.html        # Дефектний акт
└── quote.html             # Кошторис
```

---

## 🔄 Snapshot Rules

### Legal Documents (immutable after generation):
- `master_agreement` — Snapshot at creation
- `annex_to_contract` — Snapshot at generation
- `issue_act` — Snapshot from annex
- `return_act` — Snapshot from annex
- `defect_act` — Snapshot from annex + damage data

### Non-Legal Documents:
- `quote` — Can be regenerated from live order data

---

## 🚀 API Endpoints

```
POST /api/documents/render
Body: {
  "doc_type": "annex_to_contract",
  "order_id": 7325,
  "manual_fields": {
    "contact_person": "...",
    "contact_channel": "Telegram",
    "contact_value": "@username"
  }
}
Response: { "html": "...", "pdf_url": "..." }

POST /api/documents/{doc_id}/sign
Body: {
  "signer_role": "tenant",
  "signature_png_base64": "data:image/png;base64,..."
}
Response: { "success": true, "signed_pdf_url": "..." }
```
