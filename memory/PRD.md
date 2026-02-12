# RentalHub + Ivent-tool Project PRD

## Original Problem Statement
The user's initial request was to enhance the "Damage Hub" and integrate an existing public-facing decorator catalog application, "Ivent-tool," into the main RentalHub system.

---

## Latest Update: February 12, 2025

### Finance Hub 2.0 - Phase 1 (Snapshot API) - COMPLETED ✅

**Problem:** Finance Hub had performance issues causing:
- 6+ API calls per order selection (payments, deposits, damage, late, documents, payer)
- 12 SQL queries in payouts-stats endpoint
- No single source of truth for order financial data
- Slow load times and potential race conditions

**Solution (Phase 1 - Snapshot API):**

1. **NEW: `GET /api/finance/orders/{order_id}/snapshot`**
   - Single endpoint replaces 5+ separate requests
   - Returns: payments, deposit, damage, late, totals, documents, payer_profile, timeline
   - Includes `_meta` with version hash for change detection
   - File: `/app/backend/routes/finance.py`

2. **NEW: `GET /api/finance/payouts-stats-v2`**
   - Optimized from 12 SQL queries → 3 queries
   - Uses `SUM(CASE WHEN ...)` for aggregation
   - ~2.5x faster (2.0s → 0.8s)
   - Returns deposits by currency (UAH/USD/EUR)

3. **Frontend: `FinanceHub.jsx` Updated**
   - Uses `loadOrderSnapshot()` instead of 5 separate load functions
   - Uses `loadPayoutsStatsOptimized()` for stats
   - Fallback to old endpoints if new ones fail

### Finance Hub 2.0 - Phase 0 (Foundation) - COMPLETED ✅

**Database Migration: `/api/migrations/finance-hub-v2`**

1. **`deal_mode` column added to orders**
   - Values: 'rent' (default) | 'sale'
   - For future: ФОП/ТОВ на спрощеній → тільки sale

2. **New indexes for performance:**
   - `idx_payments_order_type` on fin_payments(order_id, payment_type)
   - `idx_payments_stats` on fin_payments(payment_type, method, status)
   - `idx_expenses_category_method` on fin_expenses(category_id, method)

3. **PayerProfile system (already existed)**
   - Table: `payer_profiles`
   - Types: individual, fop_simple, fop_general, llc_simple, llc_general
   - Integration with orders via `payer_profile_id`

---

### Previous: Performance Optimization Phase 1 & 2 - COMPLETED ✅

**Order Workspace optimizations:**
- `GET /api/finance/deposit-hold?order_id={id}` - single deposit
- `POST /api/documents/latest-batch` - batch document versions
- Disabled polling when WebSocket connected
- 300ms debounce on EventBus refetch
- Timeline deduplication with useMemo
- Footer scroll with useRef

---

## Project Architecture
```
/app/
├── backend/
│   ├── routes/
│   │   ├── finance.py         # MODIFIED: +snapshot, +payouts-stats-v2
│   │   ├── migrations.py      # MODIFIED: +finance-hub-v2 migration
│   │   ├── payer_profiles.py  # PayerProfile management
│   │   └── documents.py       # +latest-batch endpoint
│   └── server.py
├── frontend/
│   └── src/
│       └── pages/
│           └── FinanceHub.jsx # MODIFIED: uses snapshot API
└── memory/
    └── PRD.md
```

## What's Been Implemented

### February 12, 2025:
- **Finance Hub 2.0 Phase 1** - Snapshot API, optimized stats (3x faster)
- **Finance Hub 2.0 Phase 0** - deal_mode, database indexes

### February 10, 2025:
- **Performance Optimization Phase 1 & 2** - Order Workspace optimization

### Previous Sessions:
- **Inventory Status Fix** - Catalog correctly shows items on restoration
- **Damage Hub Enhancements** - Complete/hide items, full-screen modals
- **Mobile Optimization** - Responsive design for Ivent-tool
- **Moodboard MVP** - Konva.js canvas with export
- **Ivent-tool Order Submission** - Full checkout flow

## Known Issues

### P1 - Moodboard Export
**Status:** BLOCKED - awaiting user to deploy backend CORS fix

### P2 - Calendar Timezone Bug
**Status:** NOT STARTED
**Recurrence:** 4+ times reported

### P3 - Image 404s in Catalog
**Status:** NOT STARTED

## Upcoming Tasks (Finance Hub 2.0 Continued)

### Phase 2: New Finance Hub UI (Tabs Architecture)
1. **Операції** - головна вкладка (OrderList + OrderFinancePanel)
2. **Документи** - центр документів з policy matrix
3. **Каси** - баланси + вечірнє зведення
4. **План надходжень** - прогноз по датах
5. **Витрати** - категорії витрат
6. **Депозити** - глобальний список
7. **Аналітика** - звіти

### Phase 3: Documents
1. Розділити Quote vs Annex (кошторис ≠ додаток)
2. Document Policy Matrix
3. Snapshot в документі

### Phase 4: Safety & Accounting
1. Заборона delete → тільки сторно
2. Idempotency keys
3. Atomic transactions audit

## Future Tasks (P2+)
1. **Unify Workspaces** - Merge NewOrderViewWorkspace + IssueCardWorkspace
2. **Role-Based Access Control (RBAC)**
3. **Monthly Financial Report**
4. **Digital Signature Integration**
5. **HR/Ops module** (виходи, лікарняні) - окремий від Finance

## Key API Endpoints

### Finance Hub 2.0 (NEW)
- `GET /api/finance/orders/{order_id}/snapshot` - All order finance data in one call
- `GET /api/finance/payouts-stats-v2` - Optimized stats (3 queries)
- `POST /api/migrations/finance-hub-v2` - Run Phase 0 migration

### Existing
- `GET /api/finance/deposit-hold?order_id={id}` - Single deposit for order
- `POST /api/documents/latest-batch` - Batch document versions
- `GET /api/finance/deposits` - All deposits
- `GET /api/payer-profiles` - List payer profiles
- `POST /api/payer-profiles/order/{id}/assign/{profile_id}` - Assign payer

## Database Schema Updates

### orders table (new columns)
- `deal_mode VARCHAR(20) DEFAULT 'rent'` - rent | sale
- `payer_profile_id INT NULL` - FK to payer_profiles

### payer_profiles table
- id, payer_type, company_name, edrpou, iban, bank_name
- director_name, address, tax_number, is_vat_payer
- phone, email, note, is_active, created_at

## Test Credentials
- **RentalHub Admin:** vitokdrako@gmail.com / test123
