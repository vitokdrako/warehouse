# RentalHub PRD

## Original Problem Statement
Comprehensive overhaul of rental management application workflows for Prop Masters and Managers, including damage processing, financial operations, document generation, and catalog management.

## Architecture
- **Frontend:** React (CRA) → `rentalhub.farforrent.com.ua`
- **Backend:** FastAPI → `backrentalhub.farforrent.com.ua`
- **Database:** External MySQL (OpenCart-based)
- **Deployment:** Manual — agent builds frontend + prepares backend files in `/app/clean_project/`

## Core Modules
1. **Damage Cabinet** (`DamageHubApp.jsx` + `product_damage_history.py`) — 3-column dashboard (Wash/Restoration/Laundry)
2. **Catalog** (`CatalogBoard.jsx` + `catalog.py`) — Product catalog with availability tracking
3. **Orders/Returns** — Order management with damage recording at return
4. **Kasa (Cash Desk)** — Financial operations + cash collection
5. **Documents** — Printable lists, acts, invoices

## What's Been Implemented

### Session 2026-03-11
- Catalog SKU search integrated into Damage Cabinet (API-based with debounce)
- Quantity input when adding items to queues
- Freeze on add (`frozen_quantity += qty`), unfreeze on complete (`frozen_quantity -= qty`)
- Partial acceptance for ALL queues (Wash/Restoration/Laundry) + laundry batches
- DamageModal updated: 3 queue buttons, "Без запису" uses quick-add (no damage history)
- Print list excludes returned items, shows remaining qty
- Fixed 17 products with stuck frozen_quantity via fix-frozen-quantities endpoint
- Laundry endpoint now returns qty/processed_qty fields
- `loadAll` uses Promise.allSettled for resilience

### Previous Sessions
- 3-column Damage Cabinet dashboard
- Laundry batches (create, print, partial return)
- Cash Collection (інкасація) feature
- Multi-currency deposit support
- Financial calculations fix (service_fee)
- Mass order closing, order restoration
- Document generation (handover act, picking list, processing list)

## Pending Issues
- P1: Monthly Cash Desk Closing (Z-report)
- P1: Catalog API performance / FamiliesManager infinite loading
- P1: System cleanup (unused tables/files)
- P2: convert-to-order instability
- P2: Moodboard export broken
- P2: Calendar timezone bug
- P2: Email templates for documents

## Key Files
- `/app/frontend/src/pages/DamageHubApp.jsx`
- `/app/frontend/src/components/DamageModal.jsx`
- `/app/backend/routes/product_damage_history.py`
- `/app/backend/routes/laundry.py`
- `/app/backend/routes/documents.py`
- `/app/backend/routes/catalog.py`
- `/app/clean_project/backend_update/` — files for production deployment
- `/app/clean_project/frontend_build/` — production frontend build

## Credentials
- Admin: `vitokdrako@gmail.com` / `test123`
