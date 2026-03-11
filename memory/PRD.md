# RentalHub - PRD

## Original Problem Statement
Системна оптимізація RentalHub: уніфікація БД (product_damage_history як SSOT), видалення зайвих таблиць, спрощення workflow, оптимізація продуктивності, оптимізація клієнтської бази, виправлення генерації рахунків.

## Current Architecture
- Backend: FastAPI + SQLAlchemy -> Remote MySQL (farforre_laravell - тестова БД)
- Frontend: React + Shadcn UI
- Deployment: Manual (clean_project/ directory)

## What's Been Implemented

### Session 1-2 (Previous Forks)
- Database Architecture Overhaul, Full-Stack Refactoring
- Catalog API 22x Performance, Discount Fix, Estimate Fix, UI cleanup

### Session 3 (2026-03-11)
- **Client Database Optimization (COMPLETED):**
  - Extended client_users table with CRM fields
  - Migrated ~94 unique client records
  - Updated backend API: GET/POST/PATCH with all CRM fields
  - Testing: 18/18 backend tests passed

- **Client UI Redesign (COMPLETED):**
  - Replaced card-based list with **compact table layout** (КЛІЄНТ | ТЕЛЕФОН | ЗАМОВЛ. | ПЛАТНИК)
  - Fixed broken star ratings (★ Unicode instead of HTML entities)
  - Green dot indicator for regular clients, company info in subtitle
  - **Merged 3 drawer tabs into single scrollable view** (Contact + Payers + Orders)
  - Cleaner drawer: compact contact grid, inline payer management, order list
  - Testing: 11/11 backend tests + full UI verification passed

## Pending Issues
1. **Invoice generation for FOP/TOV is broken (P0)** - documents.py needs refactoring
2. convert-to-order endpoint unstable (P2)
3. Moodboard export broken (P2)
4. Calendar timezone bug (P2)

## Next Task
- **(P0) Fix invoice generation** (FOP/TOV) using new client database structure

## Upcoming Tasks (P1)
- Simplify laundry_items table/logic
- Delete legacy route files (damages.py, audit.py)
- Monthly Cash Desk Closing ("Close Month")
- Document template "Акт повернення"

## Future Tasks (P2+)
- **CRITICAL**: Migrate all changes from test to production DB
- Real-time updates, Unify workspace components, RBAC, Financial Reports, HR/Ops

## Key Files
- /app/backend/routes/clients.py - Client CRM API (UPDATED)
- /app/backend/routes/documents.py - Document generation (invoice fix needed)
- /app/frontend/src/components/ClientsTab.jsx - Client management UI (REDESIGNED)

## Key DB Schema - client_users
- id, email, full_name, phone, company_hint, company, source
- payer_type, tax_id, is_regular, rating (INT 0-5), rating_labels
- internal_notes, instagram, total_revenue, last_order_date
