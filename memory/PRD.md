# RentalHub - PRD

## Original Problem Statement
Системна оптимізація RentalHub: уніфікація БД, спрощення workflow, оптимізація продуктивності, оптимізація клієнтської бази, виправлення генерації рахунків.

## Current Architecture
- Backend: FastAPI + SQLAlchemy -> Remote MySQL (farforre_laravell - тестова БД)
- Frontend: React + Shadcn UI
- Deployment: Manual (clean_project/ directory)

## What's Been Implemented

### Session 1-2 (Previous Forks)
- Database Architecture Overhaul, Full-Stack Refactoring
- Catalog API 22x Performance, Discount Fix, Estimate Fix, UI cleanup

### Session 3 (2026-03-11)

**Client Database Optimization (COMPLETED):**
- Extended client_users table with CRM fields (is_regular, company, rating, internal_notes, instagram)
- Updated backend API: GET/POST/PATCH with all CRM fields
- Redesigned frontend: compact table layout, merged drawer (no tabs), star ratings, regular client badges
- Testing: 18/18 + 11/11 backend tests passed

**Invoice Generation Fix (COMPLETED):**
- Created `/api/documents/invoice-payment/{order_id}/preview` - Рахунок на оплату
- Created `/api/documents/service-act/{order_id}/preview` - Акт надання послуг
- Both documents use payer profile data from `payer_profiles` table
- Auto-detection: order -> payer_profile_id -> client_user_id -> customer_name fallback
- Templates match the standard accounting format (Ukrainian business documents)
- PDF/print endpoints available (/pdf suffix)
- Executor types: fop (Николенко Н.С.) and tov (ТОВ ФАРФОР РЕНТ)

## New API Endpoints
- `GET /api/documents/invoice-payment/{order_id}/preview?executor_type=fop&payer_id=N`
- `GET /api/documents/invoice-payment/{order_id}/pdf`
- `GET /api/documents/service-act/{order_id}/preview?executor_type=fop&payer_id=N`
- `GET /api/documents/service-act/{order_id}/pdf`

## Pending Issues
1. (P1) convert-to-order endpoint unstable
2. (P2) Moodboard export broken
3. (P2) Calendar timezone bug

## Upcoming Tasks (P1)
- Simplify laundry_items table/logic
- Delete legacy route files (damages.py, audit.py)
- Monthly Cash Desk Closing ("Close Month")
- Document template "Акт повернення"
- Backfill client_user_id + payer_profile_id on historical orders

## Future Tasks (P2+)
- CRITICAL: Migrate all changes from test to production DB
- Real-time updates, Unify workspace components, RBAC, Financial Reports, HR/Ops

## Key Files
- /app/backend/routes/clients.py - Client CRM API
- /app/backend/routes/documents.py - Document generation (invoice, service act, estimate)
- /app/backend/templates/documents/invoice_payment.html - Invoice template
- /app/backend/templates/documents/service_act.html - Service act template
- /app/frontend/src/components/ClientsTab.jsx - Client management UI

## Key DB Schema - payer_profiles
- id, type (fop/tov/individual), display_name, legal_name
- edrpou, iban, email_for_docs, phone_for_docs
- signatory_name, signatory_basis, tax_mode, is_active

## Payer Lookup Chain
1. orders.payer_profile_id -> payer_profiles
2. orders.client_user_id -> client_payer_links (is_default) -> payer_profiles
3. orders.customer_name -> client_users.full_name -> client_payer_links -> payer_profiles
