# RentalHub - PRD

## Original Problem Statement
Системна оптимізація RentalHub: уніфікація БД (product_damage_history як SSOT), видалення зайвих таблиць, спрощення workflow (видалення FinanceHub, інтеграція Каси в ManagerCabinet), оптимізація продуктивності.

## Current Architecture
- Backend: FastAPI + SQLAlchemy → Remote MySQL (farforre_laravell - тестова БД)
- Frontend: React + Shadcn UI
- Deployment: Manual (clean_project/ directory)

## What's Been Implemented

### Session 1 (Previous Forks)
- Database Architecture Overhaul: Switched to test DB, unified PDH as SSOT
- Full-Stack Refactoring: orders.py, catalog.py, damage_cases.py, product_cleaning.py
- Database & Code Cleanup: Deleted ~25 unused SQL tables + legacy .py files
- UI/UX: Removed /finance, embedded KasaPage into ManagerCabinet
- Critical Bug Fixes: DB connection pool, fin_ledger_entries restore, partial return cards

### Session 2 (Current - 2026-03-11)
- **Catalog API Performance Optimization (P0 - COMPLETED)**:
  - `/api/catalog/families`: N+1 query problem fixed (119 queries → 1 JOIN)
  - Performance: 18.2s → ~1s (22x faster, 94.5% improvement)
  - New `/api/catalog/products-lite` endpoint for FamiliesManager (66% smaller response)
  - Merged reserved/in_rent queries in `/api/catalog` and `/api/catalog/items-by-category`
  - FamiliesManager.jsx updated: parallel loading, lightweight endpoint
  - All files copied to /app/clean_project/ for deployment

- **Discount Calculation Fix (P0 - COMPLETED)**:
  - Fixed: `orders` endpoint mapped `discount` (percent) to `discount_amount` → now correctly maps to `discount_percent`
  - Fixed: `discount_amount` added to allowed_fields so fixed amounts save correctly
  - Fixed: Frontend `calculations` now uses fixed amount when available (not always percentage)
  - Fixed: `discountAmount` added to useMemo dependencies → LeftRailFinance updates in real-time
  - Fixed: `total_price` always = items sum (BEFORE discount), not inconsistent
  - NEW: `total_after_discount` field returned from backend = total_price - discount_amount
  - Idempotency verified: saving 3x produces identical results (no snowball effect)

- **Frozen Quantity Consistency Fix (P0 - COMPLETED)**:
  - Catalog processing filters (on_wash/on_laundry/on_restoration) now query PDH directly instead of stale `products.state`
  - Available quantity now calculated from PDH: `total - reserved - in_rent - (wash + restoration + laundry)`
  - Before: catalog showed 2 items in laundry. After: 7 items — matches damage cabinet exactly
  - Verified: TX9147 (105 laundry), TX8938 (15 laundry), TX9150 (24 wash + 25 laundry)
  - Known data issue: TX8938 has on_laundry=15 > total=14 (DB data inconsistency)

## Pending Issues
1. **Partial return cards on manager dashboard** - Fixed, USER VERIFICATION PENDING
2. **convert-to-order endpoint unstable** (P2)
3. **Moodboard export broken** (P2)
4. **Calendar timezone bug** (P2)

## Upcoming Tasks (P1)
- Simplify laundry_items table/logic (may be redundant with PDH)
- Delete legacy route files (damages.py, audit.py etc.) after full verification
- Implement Monthly Cash Desk Closing ("Close Month")
- Create document templates ("Акт повернення")

## Future Tasks (P2+)
- **CRITICAL**: Migrate all changes from test to production DB
- Real-time updates for client cabinet
- Unify NewOrderViewWorkspace.jsx and IssueCardWorkspace.jsx
- Full RBAC implementation
- Monthly Financial Report
- HR/Ops Module

## Key Files
- /app/backend/routes/catalog.py - Optimized catalog API
- /app/frontend/src/components/catalog/FamiliesManager.jsx - Updated frontend
- /app/clean_project/ - All deployment files
- /app/clean_project/migration_script.sql - Schema migration for production

## Database
- Test DB: farforre_laravell (current)
- Production DB: farforre_rentalhub (DO NOT SWITCH without user approval)
- SSOT: product_damage_history table
