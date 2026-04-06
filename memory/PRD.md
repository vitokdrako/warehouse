# RentalHub PRD

## Original Problem Statement
Comprehensive rental management platform (RentalHub) with React frontend, FastAPI backend, and MySQL database. Features include order management, client CRM, document generation, financial tracking (Kasa module), OpenCart synchronization, damage tracking, and bulk product management.

## Architecture
- **Frontend**: React (CRA) -> compiled to `/app/clean_project/frontend_build/`
- **Backend**: FastAPI on port 8001
- **Database**: MySQL (OpenCart DB + RentalHub DB)
- **Production**: Frontend at `rentalhub.farforrent.com.ua`, Backend at `backrentalhub.farforrent.com.ua`

## Key Technical Concepts
- **Production Build**: Swap `.env` REACT_APP_BACKEND_URL to `https://backrentalhub.farforrent.com.ua`, run `yarn build`, copy to `/app/clean_project/frontend_build/`, revert `.env`
- **Image Helper**: All product images must use `getImageUrl()` from `utils/imageHelper.js`
- **Document Engine**: Jinja2 templates, DB override via `template_loader.py`
- **RentalHub DB**: Separate MySQL via `database_rentalhub.py`, pool_size=10

## Completed Features
- Kasa module with mobile UI, deposits flat list, expense line items, expected income plan
- Client CRM with payer management, master agreements, termination workflow
- Damage tracking with inline warnings on order cards
- Document engine cleanup (9 core templates), global contract number injection
- OpenCart sync script `sync_all_v2.py` (RH->OC quantity push, status 29 update)
- Product image URL fix across all order views (2026-04-04)
- **Bulk Product Editor** in Admin Panel (2026-04-06):
  - Table with 19 columns: ID, Photo, SKU, Name, Category, Color, Material, Shape, Rental Price, Loss Price, Quantity, Zone, Aisle, Shelf, Height, Width, Depth, Diameter, State
  - Inline editing of all fields (click cell to edit, Enter/blur to save)
  - Photo thumbnails with zoom modal
  - Filters: category, color, shape, state, missing attributes (with counts)
  - Text search by name/SKU/ID
  - Pagination: 50 per page, sorted by product_id DESC
  - Backend: `/api/admin/bulk-products` (GET list), `/api/admin/bulk-products/filters` (GET filter options), `/api/admin/bulk-products/{id}` (PATCH inline edit)

## Pending Issues
- P0: Verify `sync_all_v2.py` on production server (user verification)
- P1: `invoice_legal` template fix (regex_search removal, dynamic contract number)
- P1: Multiple photos per product support
- P2: `convert-to-order` endpoint instability
- P2: Moodboard export broken
- P2: Calendar timezone bug

## Backlog
- P1: Post-deployment health check
- P1: Simplify `laundry_items` table
- P2: Finmap API integration (postponed by user)
- P3: WebSockets real-time updates
- P3: Unify order workspace components
- P3: Full RBAC
- P3: HR/Ops module
- P3: Telegram bot integration
