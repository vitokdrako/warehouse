# RentalHub - PRD

## Original Problem Statement
Системна оптимізація RentalHub: уніфікація БД (product_damage_history як SSOT), видалення зайвих таблиць, спрощення workflow (видалення FinanceHub, інтеграція Каси в ManagerCabinet), оптимізація продуктивності, оптимізація клієнтської бази, виправлення генерації рахунків.

## Current Architecture
- Backend: FastAPI + SQLAlchemy -> Remote MySQL (farforre_laravell - тестова БД)
- Frontend: React + Shadcn UI
- Deployment: Manual (clean_project/ directory)

## What's Been Implemented

### Session 1 (Previous Forks)
- Database Architecture Overhaul: Switched to test DB, unified PDH as SSOT
- Full-Stack Refactoring: orders.py, catalog.py, damage_cases.py, product_cleaning.py
- Database & Code Cleanup: Deleted ~25 unused SQL tables + legacy .py files
- UI/UX: Removed /finance, embedded KasaPage into ManagerCabinet
- Critical Bug Fixes: DB connection pool, fin_ledger_entries restore, partial return cards

### Session 2
- Catalog API Performance Optimization: N+1 query fix, 22x faster
- Discount Calculation Fix: Idempotent order updates
- Frozen Quantity Consistency Fix: PDH as SSOT for catalog
- Discount UI Redesign: Simplified discount input
- Estimate (Кошторис) Fix: Correct totals and additional services

### Session 3 (2026-03-11) - CURRENT
- **Client Database Optimization (P0 - COMPLETED)**:
  - Extended `client_users` table with CRM fields: `is_regular`, `company`, `rating`, `rating_labels`, `internal_notes`, `instagram`
  - Migrated ~94 unique client records from orders table
  - Updated backend API: GET/POST/PATCH endpoints support all new fields
  - Updated frontend ClientsTab: list view, detail drawer, edit form with new fields
  - Added filter "Постійні клієнти", 4-column stats (Всього, Постійні, Є платники, Без платників)
  - Star rating (1-5) widget, regular client checkbox, internal notes
  - **Testing: 18/18 backend tests passed, frontend verified**

## Pending Issues
1. **Invoice generation for FOP/TOV is broken (P0)** - documents.py needs client DB refactor data
2. Partial return cards on manager dashboard - USER VERIFICATION PENDING
3. convert-to-order endpoint unstable (P2)
4. Moodboard export broken (P2)
5. Calendar timezone bug (P2)

## In Progress Tasks
- (P0) Fix invoice generation (FOP/TOV) using new client database structure

## Upcoming Tasks (P1)
- Simplify laundry_items table/logic (may be redundant with PDH)
- Delete legacy route files (damages.py, audit.py) after verification
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
- /app/backend/routes/clients.py - Client CRM API (UPDATED)
- /app/backend/routes/documents.py - Document generation (invoice fix needed)
- /app/backend/routes/catalog.py - Optimized catalog API
- /app/frontend/src/components/ClientsTab.jsx - Client management UI (UPDATED)
- /app/frontend/src/pages/ManagerCabinet.jsx - Parent component with tabs
- /app/clean_project/ - All deployment files

## Database
- Test DB: farforre_laravell (current)
- Production DB: farforre_rentalhub (DO NOT SWITCH without user approval)
- SSOT: product_damage_history table
- Client table: client_users (extended with CRM fields)

## Key DB Schema - client_users
- id, email, email_normalized, full_name, phone
- company_hint, company (official name), source
- payer_type, tax_id, bank_details
- is_regular (BOOLEAN), rating (INT 0-5), rating_labels (TEXT)
- internal_notes (TEXT), instagram (VARCHAR)
- total_revenue (FLOAT), last_order_date (DATE)
- is_active, created_at, updated_at
