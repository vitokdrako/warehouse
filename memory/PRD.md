# RentalHub + Ivent-tool Project PRD

## Original Problem Statement
Enhance the "Damage Hub" and integrate "Ivent-tool" into RentalHub. Later focus shifted to Finance Hub optimization and restructuring, then to Documents Engine.

---

## Latest Update: February 12, 2026

### Phase 3.2: Production Documents Features - COMPLETE ✅

**DocumentPreviewModal Integration:**
- Modal opens when clicking document buttons (quote, invoice_offer, contract_rent)
- HTML renders in iframe with watermark "ЧЕРНЕТКА"
- Sign button opens SignatureCanvas modal
- PDF download button (falls back to HTML due to missing WeasyPrint deps)
- Edit/Back button for modifying fields

**New Templates Added:**
- `invoice_offer.html` — Рахунок-оферта

**Bug Fixes Applied:**
- Fixed localStorage token key (`authToken` → `token`)
- Fixed WeasyPrint import error (OSError handling)

**Test Report:** `/app/test_reports/iteration_4.json` - 18/18 backend tests passed

---

### Phase 3.1: Production Documents Engine - COMPLETE ✅

**New Template-Based Document System:**

#### Template Structure Created:
```
/backend/templates/documents/
├── _partials/
│   ├── base.css           # A4 styling, watermarks
│   ├── header.html        # Document header
│   └── footer_sign.html   # Signature blocks
├── master_agreement.html  # Рамковий договір (full legal text)
├── annex_to_contract.html # Додаток до договору
├── issue_act.html         # Акт передачі
├── return_act.html        # Акт повернення
├── defect_act.html        # Дефектний акт
├── quote.html             # Кошторис (non-legal)
└── invoice_offer.html     # Рахунок-оферта

/docs/
└── document-data-mapping.md  # Field mapping specification
```

#### API Endpoints:
- `POST /api/documents/render` — Render document from template (7 types)
- `GET /api/documents/render/preview/{doc_type}` — HTML preview
- `GET /api/documents/render/templates` — List available templates
- `GET /api/documents/render/context/{doc_type}` — Get context data
- `POST /api/documents/signatures/sign` — Sign document with canvas
- `GET /api/documents/signatures/status/{doc_id}` — Get signature status

#### Features Implemented:
1. **Jinja2 Template Engine** — Renders HTML from templates
2. **Data Context Builder** — Aggregates order, payer, agreement, items data
3. **Watermark Support** — "ЧЕРНЕТКА" for draft, "ПІДПИСАНО" for signed
4. **Ukrainian Date Formatting** — Day, month name (українською), year
5. **Signature Storage** — document_signatures table ready
6. **Legal Text** — Full contract text from client's legal documents

---

### Phase 3: Documents Engine - COMPLETE ✅

**Database Tables:**
1. `master_agreements` — Рамкові договори (12-month contracts)
2. `order_annexes` — Додатки до замовлень (immutable snapshots)
3. `document_emails` — Email log
4. `document_signatures` — Digital signatures

**API Endpoints:**
- `/api/agreements` — Master agreements CRUD
- `/api/annexes` — Order annexes generation
- `/api/documents/policy` — Policy matrix (19 doc types)

**Frontend:**
- FinanceHub DocumentsTab with 3 sub-tabs: Документи, Договори, Додатки
- DocumentPreviewModal with iframe preview
- SignatureCanvas for digital signatures

---

### Phase 2: Finance Hub - COMPLETE ✅
- 7-Tab Architecture
- Snapshot API optimization
- Deposit vs Advance separation

### Phase 1: Backend Optimization - COMPLETE ✅
- `/api/finance/orders/{id}/snapshot` endpoint
- `/api/finance/payouts-stats-v2` optimized

---

## Project Architecture

```
/app/
├── backend/
│   ├── routes/
│   │   ├── finance.py
│   │   ├── master_agreements.py
│   │   ├── order_annexes.py
│   │   ├── document_policy.py
│   │   ├── document_render.py      # NEW: Jinja2 rendering
│   │   ├── document_signatures.py  # NEW: Signature API
│   │   └── migrations.py
│   ├── templates/
│   │   └── documents/              # NEW: HTML templates
│   │       ├── _partials/
│   │       ├── master_agreement.html
│   │       ├── annex_to_contract.html
│   │       ├── issue_act.html
│   │       ├── return_act.html
│   │       ├── defect_act.html
│   │       └── quote.html
│   └── server.py
├── frontend/
│   └── src/pages/FinanceHub.jsx
├── docs/
│   └── document-data-mapping.md    # NEW: Field mapping
└── memory/
    └── PRD.md
```

---

## Remaining Tasks (Phase 3.1)

### P0 - Critical (Next Steps):
1. **Frontend SignatureCanvas Component** — Touch/mouse signature capture
2. **PDF Generation** — HTML → PDF with WeasyPrint or similar
3. **Document Preview Modal** — Show rendered HTML in UI
4. **Manual Fields Input** — Contact person, condition mode, notes

### P1 - Important:
5. **Payment-Annex Linking** — `fin_payments.annex_id` column + validation
6. **Contract Expiration Warning** — Banner in UI
7. **Email Workflow** — Send document via email with sign link

### P2 - Nice to Have:
8. **Document Version Viewer** — History of versions
9. **PDF Watermark** — Draft/Signed overlay on generated PDF

---

## Known Issues

### P1 - Moodboard Export
**Status:** BLOCKED — awaiting backend CORS fix deployment

### P2 - Calendar Timezone Bug
**Status:** NOT STARTED — recurring issue

### P3 - Image 404s in Catalog
**Status:** NOT STARTED

---

## Future Tasks

- **Database Refactoring** — Unify item status tables
- **Full RBAC** — Role-based access control
- **Monthly Financial Report** — PDF export
- **Digital Signature Integration** — E-sign service
- **HR/Ops Module** — Employee management

---

## Test Credentials
- **Admin:** vitokdrako@gmail.com / test123
- **Test payer_profile_id:** 1 (Хук Тетяна, fop_simple)
- **Test order_id:** 7325 (issued, has payer)
- **Test agreement:** MA-2026-001 (signed)

---

## API Testing Examples

```bash
# Render quote
curl -X POST "$API/api/documents/render" \
  -H "Content-Type: application/json" \
  -d '{"doc_type": "quote", "order_id": 7325}'

# Preview annex
curl "$API/api/documents/render/preview/annex_to_contract?order_id=7325"

# Sign document
curl -X POST "$API/api/documents/signatures/sign" \
  -H "Content-Type: application/json" \
  -d '{"document_id": "...", "signer_role": "tenant", "signature_png_base64": "..."}'
```
