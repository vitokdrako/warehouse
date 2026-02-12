# RentalHub + Ivent-tool Project PRD

## Original Problem Statement
Enhance the "Damage Hub" and integrate "Ivent-tool" into RentalHub. Later focus shifted to Finance Hub optimization and restructuring, then to Documents Engine.

---

## Latest Update: February 12, 2026

### Phase 3.3: Email Provider + Print + Expiration UI - COMPLETE ✅

**Email Provider Abstraction - DONE ✅**
- `/app/backend/services/email_provider.py` with:
  - `EmailProvider` abstract base class
  - `DummyEmailProvider` (default, logs without sending)
  - `ResendEmailProvider` (requires RESEND_API_KEY)
  - `SendGridEmailProvider` (requires SENDGRID_API_KEY)
- Environment variables: `EMAIL_PROVIDER`, `RESEND_API_KEY`, `SENDGRID_API_KEY`, `EMAIL_FROM`
- Factory function `get_email_provider()` with automatic fallback to Dummy

**Print / PDF Button - DONE ✅**
- "🖨️ Друк / PDF" button in DocumentPreviewModal
- Opens HTML in new window with `window.print()` auto-trigger
- Print CSS in `base.css` with:
  - A4 page size, proper margins
  - Page break controls
  - `.no-print` class for hiding elements in print

**Expiration UI Banners - DONE ✅**
- **Agreements tab:** Full banner with:
  - 🔴 Expired: red background, "Договір закінчився", CTA button
  - ⚠️ Warning: amber background, "Закінчується через X днів"
  - ✅ Active: emerald badge
- **Order header:** Compact status badge
  - `✅ активн.` / `⚠️ Xдн.` / `🔴 закінч.`

**Test Report:** `/app/test_reports/iteration_6.json` - 13/13 backend tests passed

---

### Phase 3.2+: Full Documents Lifecycle - COMPLETE ✅

**P0: Manual Fields Form - DONE ✅**
- JSON schema per document type via `GET /api/documents/schema/{doc_type}`
- ManualFieldsForm component with fields:
  - `annex_to_contract`: contact_person, contact_channel, pickup_time, return_time
  - `return_act`: condition_mode (radio), return_notes, defect_act_number
  - `defect_act`: defect_notes, tenant_refused_to_sign (checkbox), refusal_witnesses
  - `issue_act`: pickup_time, issue_notes
- Form renders based on docType in DocumentPreviewModal
- Templates updated to use manual_fields

**P1: Email Workflow - DONE ✅**
- "📧 Надіслати email" button in DocumentPreviewModal footer
- Email modal with to/subject/message/attachPdf fields
- `POST /api/documents/{id}/send-email` creates audit log
- `GET /api/documents/{id}/email-history` returns send history
- Full audit trail: sent_to, sent_by_user_id, sent_at, document_version
- **NOTE: Email sending is MOCKED** - logs created but no actual SMTP integration

**P1: Payment ↔ Annex Linking - DONE ✅**
- Added `annex_id` column to `fin_payments` table
- Validation rule: `IF deal_mode = "rent" AND payment_type = "rent" THEN annex_id REQUIRED`
- Returns 400 error with Ukrainian message if rent payment without annex_id

**P1: Contract Expiration Warning - DONE ✅**
- Checks `valid_until` date in master_agreements
- Blocks annex creation for expired contracts (returns 400)
- Adds warning to response if contract expires within 30 days

**Bug Fixes Applied:**
- Fixed route ordering (manual_fields/email routers before documents.router)
- Added subject/message columns to document_emails table
- Fixed collation mismatch in recent-emails query

**Test Report:** `/app/test_reports/iteration_5.json` - 16/16 backend tests passed

---

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

## Remaining Tasks

### P0 - Critical (Next Steps):
1. ~~**Frontend SignatureCanvas Component**~~ ✅ DONE
2. ~~**Document Preview Modal**~~ ✅ DONE  
3. ~~**Manual Fields Form**~~ ✅ DONE
4. ~~**Payment-Annex Linking**~~ ✅ DONE
5. ~~**Contract Expiration Warning**~~ ✅ DONE
6. ~~**Email Workflow**~~ ✅ DONE (MOCKED)
7. **PDF Generation** — Install WeasyPrint system dependencies or use alternative
8. **Real Email Integration** — Connect to SendGrid/Resend for actual sending

### P2 - Nice to Have:
- **Document Version Viewer** — History of versions
- **PDF Watermark** — Draft/Signed overlay on generated PDF
- **Expiration UI Banner** — Visual warning in Agreements tab

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
