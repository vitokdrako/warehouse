# RentalHub PRD

## Original Problem Statement
Comprehensive rental management platform (RentalHub) with React frontend, FastAPI backend, and MySQL database.

## Architecture
- **Frontend**: React (CRA) -> compiled to `/app/clean_project/frontend_build/`
- **Backend**: FastAPI on port 8001
- **Database**: MySQL (OpenCart DB + RentalHub DB)
- **Production**: Frontend at `rentalhub.farforrent.com.ua`, Backend at `backrentalhub.farforrent.com.ua`

## Key Technical Concepts
- **Production Build**: Swap `.env` REACT_APP_BACKEND_URL to `https://backrentalhub.farforrent.com.ua`, run `yarn build`, copy to `/app/clean_project/frontend_build/`, revert `.env`
- **Image Helper**: All product images must use `getImageUrl()` from `utils/imageHelper.js`

## Completed Features (Latest Session 2026-04-07)
- **Bulk Product Editor** in Admin Panel:
  - 22 columns: ID, Photo, SKU, Name, Category, Color, Material, Shape, Rental, Loss, Qty, Zone, Aisle, Shelf, H, W, D, Diameter, State, **Hashtags, Description, Care Instructions**
  - **Drag & drop column reordering** with localStorage persistence + reset button
  - Inline editing, photo zoom modal, filters (category/color/shape/state/missing), search, pagination (50/page)
  - Hashtags: displayed as comma-separated, saved as JSON array
  - Backend: `routes/bulk_products.py` - GET list, GET filters, PATCH update (including JSON hashtags)
- Product image URL fix across order views (getImageUrl + COALESCE SQL fallback)

## Pending Issues
- P0: Verify `sync_all_v2.py` on production
- P1: `invoice_legal` template fix
- P2: `convert-to-order` instability, Moodboard export, Calendar timezone

## Backlog
- P1: Post-deployment health check, Simplify laundry_items
- P2: Finmap API (postponed)
- P3: WebSockets, Unify order workspaces, RBAC, HR/Ops, Telegram bot
