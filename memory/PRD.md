# RentalHub - Rental Management Platform

## Original Problem Statement
Comprehensive rental management platform (React + FastAPI + MySQL) syncing from OpenCart DB. Manages orders, inventory, auditing, damage tracking, issue cards, returns, and financial workflows.

## Core Requirements
- Multi-role support: Admin, Manager, Requisitor
- Order lifecycle: Draft → Awaiting → Processing → Issued → Returned
- Inventory sync from OpenCart
- Damage tracking with photos and history
- Financial tracking (payments, deposits, refunds)
- Calendar, catalog, moodboard features

## What's Been Implemented

### Completed Features
- Full order management pipeline
- Catalog with multi-select color/material filters
- Reaudit Cabinet (cards UI with thumbnails, filters)
- OpenCart sync (categories, products, inventory)
- Database deduplication & cleanup scripts
- Product disabling/deletion endpoints
- Damage history tracking (`product_damage_history` table)
- `has_damage_history` flag on all order items globally
- Production build workflow (build → copy to clean_project/frontend_build/)
- **[2026-03-26] Damage warnings on cards:**
  - Inline damage SVG icon next to item name in ZoneItemsList
  - Damage badge on ManagerDashboard OrderCards
  - DamagePhotoViewer modal on manager cards
  - Backend enrichment of issue_cards with damage data
- **[2026-03-27] Document Engine overhaul:**
  - Damage Cabinet photo preview fix (absolute URLs)
  - DB template loading fix (template_loader.py)
  - Master Agreement Termination workflow
  - Global document data enrichment (agreement, tenant, landlord)
  - Dynamic contract number in document headers
  - Document Registry purge (14 unused templates removed)
- **[2026-03-28] invoice_legal (Рахунок для юр. осіб) fix:**
  - Removed broken `regex_search` Jinja filter — replaced with native `.startswith()` 
  - ФОП/ТОВ спрощена → "Прокат декору", загальна → "Квіткова композиція"
  - Рахунок тільки на суму оренди (без депозиту)
  - Динамічний номер договору (через order→client_user→master_agreements)
  - Договір НЕ прив'язаний до платника — прив'язаний до замовлення
  - Buyer prefix logic without duplicate prefixes
- **[2026-03-28] Payer type normalization:**
  - tov/fop + tax_mode → normalized to llc_simple/llc_general/fop_simple/fop_general
  - Fixes for invoice-payment and service-act item names
  - Added `tov` and `go` (Громадська організація) to PAYER_TYPES
- **[2026-03-28] Document template path fix:**
  - Fixed _partials/base.css → documents/_partials/base.css in templates AND DB
  - Fixed master_agreement and annex_to_contract templates
- **[2026-03-28] PDF removed from email sending** (only HTML)
- **[2026-03-31] Kasa Phase 1-5 (Full Feature Set):**
  - Hierarchical expense categories (5 groups, 41 subcategories)
  - Expense modal with 2-step category → subcategory selection
  - Expected Income view (План надходжень) with month/year filter
  - Manager Debts view (Борги менеджерів) with expandable sections
  - Expense Report view (Звіт витрат) by period with expandable groups
  - Evening Cash Summary (Зведення каси) — system vs actual balance

### Known Issues
- P1: Multiple photos per product (not started)
- P2: `convert-to-order` endpoint instability
- P2: Moodboard export broken
- P2: Calendar timezone bug
- P2: Re-audit "Total Loss" button logic

### Backlog / Future Tasks
- P1: Post-deployment health check
- P1: Simplify `laundry_items` table/logic
- P3: Real-time updates (WebSockets)
- P3: Unify NewOrderViewWorkspace + IssueCardWorkspace
- P3: Full RBAC
- P3: HR/Ops Module
- P3: Telegram bot integration

## Architecture
- Frontend: React (TypeScript/JSX), Tailwind CSS, Shadcn UI
- Backend: FastAPI, SQLAlchemy (MySQL)
- Database: MySQL (RentalHub) + OpenCart sync
- Auth: JWT-based

## Key Endpoints
- GET /api/manager/dashboard/overview - Dashboard data (now with damage enrichment)
- GET /api/orders/{order_id} - Order details with item damage history
- GET /api/audit/items - Reaudit board
- PUT /api/audit/items/{id}/edit-full - Product editing with photo upload

## Credentials
- Admin: vitokdrako@gmail.com / test123
- Manager: max@test.com / test123
