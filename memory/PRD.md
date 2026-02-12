# RentalHub + Ivent-tool Project PRD

## Original Problem Statement
Enhance the "Damage Hub" and integrate "Ivent-tool" into RentalHub. Later focus shifted to Finance Hub optimization and restructuring.

---

## Latest Update: February 12, 2025

### Phase 3: Documents Engine - COMPLETE ✅

**New Document Management System Implemented:**

#### Database Tables Created:
1. **master_agreements** - Рамкові договори (12-month contracts)
   - contract_number (MA-YYYY-NNN)
   - payer_profile_id FK
   - status: draft → sent → signed → expired
   - snapshot_json (immutable)
   - valid_from, valid_until

2. **order_annexes** - Додатки до замовлень
   - annex_number (MA-YYYY-NNN-ANNN)
   - order_id FK
   - master_agreement_id FK
   - version (auto-increment per order)
   - snapshot_json (immutable)
   - status: draft → generated → signed

3. **document_emails** - Email log for documents
4. **document_signatures** - Digital signatures (for future)

5. **documents table extended:**
   - snapshot_json
   - is_legal (boolean)
   - category (quote|contract|annex|act|finance|operations)
   - master_agreement_id
   - annex_id

#### API Endpoints:
- `GET/POST /api/agreements` - Master agreements CRUD
- `PUT /api/agreements/{id}` - Update status
- `GET /api/agreements/active/{payer_id}` - Get active agreement
- `GET/POST /api/annexes` - Order annexes CRUD
- `POST /api/annexes/generate-for-order/{order_id}` - Generate annex with snapshot
- `GET /api/annexes/latest/{order_id}` - Latest annex
- `GET /api/annexes/history/{order_id}` - All versions
- `GET /api/documents/policy/matrix` - Full policy matrix (19 doc types)
- `GET /api/documents/policy/check/{doc_type}` - Check availability
- `GET /api/documents/policy/available?order_id=X` - All available docs

#### Document Policy Matrix:
- **Quote** (Кошторис, Рахунок-оферта) - not legal, no agreement required
- **Contract** (Рамковий договір, Договір оренди) - legal
- **Annex** (Додаток, Продовження) - legal, requires master agreement
- **Act** (Передача, Приймання, Пошкодження, Взаєморозрахунки) - legal
- **Finance** (Рахунок, Акт робіт, Накладна) - legal
- **Operations** (Комплектація, Чеклист, ТТН) - internal

#### Frontend (FinanceHub.jsx) Updated:
- **Documents Tab** now has 3 sub-tabs:
  1. **📄 Документи** - Policy-based document generation
  2. **📋 Договори** - Master Agreements management
  3. **📎 Додатки** - Order Annexes with version history

---

### Finance Hub 2.0 - PHASE 2 COMPLETE ✅

**7-Tab Architecture:**
1. **💰 Операції** - Orders list, payments, deposits
2. **📄 Документи** - Document generation (Phase 3 enhanced)
3. **💵 Каси** - Cash/bank balances
4. **📊 План надходжень** - Expected income
5. **📉 Витрати** - Expenses
6. **🔒 Депозити** - Deposit management
7. **📈 Аналітика** - KPIs

**Deposit vs Advance Separation:**
- **Deposit (Застава)**: Goes to `fin_deposit_holds`, liability
- **Advance (Передплата)**: Goes to `fin_payments`, income

---

### Phase 1 (Snapshot API) - COMPLETE ✅

- `GET /api/finance/orders/{order_id}/snapshot` - aggregated order data
- `GET /api/finance/payouts-stats-v2` - optimized stats (3 SQL instead of 12)

---

## Project Architecture
```
/app/
├── backend/
│   ├── routes/
│   │   ├── finance.py              # +snapshot, +payouts-stats-v2
│   │   ├── master_agreements.py    # NEW: Phase 3
│   │   ├── order_annexes.py        # NEW: Phase 3
│   │   ├── document_policy.py      # NEW: Phase 3 policy matrix
│   │   ├── migrations.py           # +documents-engine-v3 migration
│   │   ├── payer_profiles.py
│   │   └── documents.py
│   ├── tests/
│   │   └── test_phase3_documents_engine.py  # 35 tests
│   └── server.py
├── frontend/
│   └── src/
│       └── pages/
│           └── FinanceHub.jsx      # 7 tabs + Documents Engine
└── memory/
    └── PRD.md
```

## Test Results
- **Phase 3 Backend**: 35/35 tests passed (100%)
- Test file: `/app/backend/tests/test_phase3_documents_engine.py`

## Known Issues

### P1 - Moodboard Export
**Status:** BLOCKED - awaiting backend CORS fix deployment

### P2 - Calendar Timezone Bug  
**Status:** NOT STARTED - recurring issue (4+ times)

### P3 - Image 404s in Catalog
**Status:** NOT STARTED

---

## Future Tasks

### P2 - Unify Order Workspaces
Refactor NewOrderViewWorkspace.jsx and IssueCardWorkspace.jsx

### P2 - Database Refactoring
Unify 9+ item status tables into products + product_state_log

### P2 - Full RBAC
Role-Based Access Control implementation

### P2 - Monthly Financial Report
Generate PDF reports

### P3 - Digital Signature Integration
Connect document_signatures table to e-sign service

### P3 - HR/Ops Module
Employee shifts, check-ins, sick leave management

---

## Test Credentials
- **Admin:** vitokdrako@gmail.com / test123
- **Test payer_profile_id:** 1 (Хук Тетяна, fop_simple)
- **Test order_id:** 7325 (issued, has payer)
- **Test agreement:** MA-2026-001 (signed)
