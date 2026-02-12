# RentalHub + Ivent-tool Project PRD

## Original Problem Statement
Enhance the "Damage Hub" and integrate "Ivent-tool" into RentalHub. Later focus shifted to Finance Hub optimization and restructuring.

---

## Latest Update: February 12, 2025

### Finance Hub 2.0 - PHASE 2 COMPLETE ✅

**New Tabbed Architecture Implemented:**

1. **💰 Операції** (Main tab)
   - Orders list with search
   - Order finance panel with KPI cards
   - Payment form (rent, additional, damage, late)
   - **SEPARATE buttons for Deposit vs Advance** ✅
   - Deposit management (accept, use, refund)
   - Damage section
   - Timeline of operations
   - Quick documents

2. **📄 Документи**
   - Order selection
   - Payer profile selection
   - Document generation by type (individual vs legal)
   - Recent documents list

3. **💵 Каси**
   - Cash balance (rent + damage + totals)
   - Bank balance breakdown
   - Deposits by currency (UAH/USD/EUR)
   - Add expense/income buttons

4. **📊 План надходжень**
   - Expected rent summary
   - Expected deposits summary
   - Upcoming orders table with amounts

5. **📉 Витрати**
   - Add expense form
   - Expenses history table

6. **🔒 Депозити**
   - Balances by currency (UAH/USD/EUR)
   - Active deposits table
   - Closed deposits table

7. **📈 Аналітика**
   - KPI cards (revenue, deposits, avg check, paid %)
   - Revenue breakdown by source
   - Order statistics

---

### Previous: Phase 1 (Snapshot API) - COMPLETE ✅

- `GET /api/finance/orders/{order_id}/snapshot` - single endpoint for all order finance data
- `GET /api/finance/payouts-stats-v2` - optimized stats (3 SQL instead of 12)
- Database migration with `deal_mode` column and indexes

---

## Project Architecture
```
/app/
├── backend/
│   ├── routes/
│   │   ├── finance.py         # +snapshot, +payouts-stats-v2
│   │   ├── migrations.py      # +finance-hub-v2 migration
│   │   ├── payer_profiles.py  # PayerProfile management
│   │   └── documents.py
│   └── server.py
├── frontend/
│   └── src/
│       └── pages/
│           └── FinanceHub.jsx # REFACTORED: 7 tabs architecture
└── memory/
    └── PRD.md
```

## Key Features Implemented

### Deposit vs Advance Separation ✅
- **Deposit (Застава)**: Blue button, goes to `fin_deposit_holds`, liability
- **Advance (Передплата)**: Purple button, goes to `fin_payments`, income
- Each has its own form with currency (deposit) or note (advance)

### Optimized Data Loading
- Sequential loading with detailed logging
- Fallback to individual endpoints on error
- `loadOrderSnapshot` for selected order

## Known Issues

### P1 - Moodboard Export
**Status:** BLOCKED - awaiting backend CORS fix deployment

### P2 - Calendar Timezone Bug  
**Status:** NOT STARTED

### P3 - Image 404s in Catalog
**Status:** NOT STARTED

## Future Tasks

### Phase 3: Documents
1. Розділити Quote vs Annex
2. Document Policy Matrix
3. Snapshot в документі

### Phase 4: Safety & Accounting
1. Заборона delete → тільки сторно
2. Idempotency keys
3. Atomic transactions audit

### Other
- Unify Workspaces
- RBAC
- Monthly Financial Report
- Digital Signature
- HR/Ops module (separate from Finance)

## Key API Endpoints

### Finance Hub 2.0
- `GET /api/finance/orders/{order_id}/snapshot` - All order data in one call
- `GET /api/finance/payouts-stats-v2` - Optimized stats
- `POST /api/migrations/finance-hub-v2` - Migration

### Existing
- `GET /api/manager/finance/orders-with-finance` - Orders list
- `GET /api/finance/deposits` - All deposits
- `GET /api/payer-profiles` - Payer profiles
- `POST /api/finance/payments` - Create payment
- `POST /api/finance/deposits/create` - Create deposit

## Database Schema

### orders table
- `deal_mode VARCHAR(20) DEFAULT 'rent'` - rent | sale
- `payer_profile_id INT NULL` - FK to payer_profiles

### fin_payments
- `payment_type`: rent, additional, damage, late, **advance**
- `method`: cash, bank

### fin_deposit_holds
- `held_amount`, `used_amount`, `refunded_amount`
- `currency`, `exchange_rate`, `actual_amount`

## Test Credentials
- **RentalHub Admin:** vitokdrako@gmail.com / test123
