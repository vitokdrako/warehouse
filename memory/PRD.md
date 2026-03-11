# RentalHub - PRD

## Original Problem Statement
Системна оптимізація RentalHub: уніфікація БД, спрощення workflow, оптимізація клієнтської бази, генерація рахунків та актів.

## Current Architecture
- Backend: FastAPI + SQLAlchemy -> Remote MySQL (farforre_laravell - тестова БД)
- Frontend: React + Shadcn UI
- Deployment: Manual (clean_project/)

## Implemented (Session 3 - 2026-03-11)

### Client Database Optimization (DONE)
- Extended client_users with CRM fields (is_regular, company, rating, internal_notes, instagram)
- Updated backend API, redesigned frontend (table layout, merged drawer)

### Invoice/Act Generation (DONE)
- **Рахунок на оплату:** `/api/documents/invoice-payment/{order_id}/preview`
- **Акт надання послуг:** `/api/documents/service-act/{order_id}/preview`
- **Доступні типи:** `/api/documents/available-invoices/{order_id}` — динамічний список на основі payer profile
- Auto-detection: payer_profile_id -> client_user_id -> customer_name fallback
- Templates match standard Ukrainian accounting format

### Order Integration (DONE)
- LeftRailDocuments dynamically loads available invoice types from backend
- Shows payer name in invoice section header
- Shows "Додайте платника" message if no payer linked
- Only shows relevant document types (FOP options for FOP payer, TOV for TOV)

## Payer Lookup Chain
1. orders.payer_profile_id -> payer_profiles
2. orders.client_user_id -> client_payer_links (is_default) -> payer_profiles
3. orders.customer_name COLLATE -> client_users.full_name -> client_payer_links -> payer_profiles

## Testing Status
- iteration_13: Client CRUD backend (18/18 PASS)
- iteration_14: Client UI redesign (11/11 PASS)
- iteration_15: Invoice/Act generation (24/24 PASS)

## Pending Issues
- (P1) convert-to-order instability
- (P2) Moodboard export, Calendar timezone bug

## Upcoming Tasks
- Backfill client_user_id + payer_profile_id on historical orders
- laundry_items simplification, legacy file deletion
- Monthly Cash Desk Closing, "Акт повернення" template
- CRITICAL: Migrate to production DB
