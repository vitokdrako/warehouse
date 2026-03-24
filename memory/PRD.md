# RentalHub - Product Requirements Document

## Original Problem Statement
Build a comprehensive rental management system (RentalHub) for FarforRent — a tableware/decor rental company.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI (JSX/TSX)
- **Backend**: FastAPI (Python) + MySQL (farforre_rentalhub)
- **Auth**: JWT-based (24h token)
- **Production**: Frontend at https://rentalhub.farforrent.com.ua/, Backend at https://backrentalhub.farforrent.com.ua/

## What's Been Implemented

### Core Features (Previous Sessions)
- Order/Client/Finance/Document/Inventory management
- Issue/Return cards, Damage cabinet, Email integration

### Session: March 2026

#### Personal Cabinet (`/cabinet`)
- Profile, Tasks (Kanban), Chat (Telegram-style), Orders (internal notes), Team tabs
- Badge counters, Task-Chat integration

#### Calendar Redesign (`/calendar`)
- Day/Week/Month views, corp-* design, filters, today summary
- Create task from calendar, overdue highlighting, cabinet links

#### Admin Panel Rebuild (`/admin`) — March 15, 2026
- **5 tabs**: Користувачі, Документи, Категорії, Витрати, Налаштування
- Users: CRUD, role badges, password reset, 9 users
- Documents: 17 doc types with template editor (view, edit, preview, save to DB)
- Categories: 155 product categories with search
- Expense Categories: 13 categories, CRUD
- Settings: editable company data (ФОП, ІПН, IBAN, адреса, телефон, email, вебсайт)

#### Dynamic Document Company Data — Feb 2026
- Created `services/company_config.py` — central utility for company data from DB
- All document templates use DB data via `system_settings` table
- Both `company.*` and `landlord.*` template variables resolved from DB

#### Рахунок-оферта Redesign — March 2026
- Redesigned `invoice_offer.html` in quote.html visual style
- Sections: Замовник, Деталі оренди, Товари (SKU, Оренда/день, Оренда/термін, Завдаток)
- Added: Умови оплати, Реквізити для оплати (bank details from DB), Додаткові послуги

#### Template Editor — Feb 2026
- **DB-first template loading**: Custom `DBOverrideLoader` for Jinja2
- **Template CRUD API**: GET/PUT/POST (reset) endpoints
- **Code editor**: Dark-themed monospace editor with tab support
- **Live preview**: Renders template with real order data in iframe
- **Save/Reset flow**: Save stores to `document_templates` DB table

#### Акт взаєморозрахунків (Settlement Act) — March 15, 2026
- Full financial summary with auto-collected data
- Frontend integration with editable late fee and damage charge forms

#### Financial Bugs Fixed — March 18, 2026
- Fixed double-discount bug in 7 places
- Fixed late fees double counting (pending vs confirmed)
- Improved payment history UI

#### Partial Deposit Refund — March 18, 2026
- Full flow: UI, backend logic, Settlement Act updates

#### `inventory` Table Refactor — March 18, 2026
- Removed ALL dependencies on legacy `inventory` table
- All product state management now in `products` table

#### Re-audit Cabinet Refactor — March 18, 2026
- Replaced complex damage form with 4 direct-action buttons (Wash/Restoration/Laundry/Total Loss)
- Backend: `quick-add-to-queue` and `damage-cases/create` endpoints
- Fixed `case_number` NameError in `damage_cases.py`
- Fixed TypeScript build error (added `sku` to `AuditItem` interface)

#### `sync_all.py` — March 18, 2026
- Merged production version with dimension sync
- Client sync based on email uniqueness
- Product dimensions from OpenCart (height, width, depth)

#### Photo Records & Damage Flow Separation — March 18, 2026
- "Без запису у стан" saves as processing_type='photo_only', no queue required
- New "Фіксації" section in DamageHub with delete capability
- New APIs: GET/DELETE /api/product-damage-history/photo-records
- Defect act collects ALL records (photo_only + state + total_loss) with photos
- Pre-issue stage never requires processing queue selection

#### Write-off Logic Separation + Written Off Section — March 18, 2026
- DamageModal TOTAL_LOSS no longer writes to damage processing queues
- process-loss accepts photo_url, note, created_by, category, severity
- New "Списані" section in DamageHubApp with full item details
- New API: GET /api/product-damage-history/written-off
- Defect act template now shows damage photos
- Return quantity updates correctly after write-off

#### Total Loss Implementation — March 18, 2026
- Two-step confirmation in PartialReturnModal (summary → confirm write-off)
- process-loss endpoint: reduces quantity, creates fin_payments, product_damage_history, product_history
- damage_code='TOTAL_LOSS', processing_type='total_loss', processing_status='written_off'

#### Bug Fixes — March 18, 2026 (Session 2)
- Fixed `Unknown column 'updated_at'` in products table — removed from all UPDATE statements in laundry.py (2), product_damage_history.py (7)
- Fixed SKU: `quick-add-to-queue` now fetches real SKU from DB instead of trusting client (SKU-9183 → PO9183)
- Fixed `stock` → `quantity` in write-off endpoint
- Fixed `case_number` NameError in damage_cases.py

## Key Files
- `/app/frontend/src/pages/ReauditCabinetFull.tsx` — Re-audit cabinet
- `/app/frontend/src/pages/ReturnSettlementPage.jsx` — Return settlement
- `/app/backend/routes/damage_cases.py` — Damage case creation
- `/app/backend/routes/product_damage_history.py` — Damage history + quick-add
- `/app/backend/routes/finance.py` — Financial calculations
- `/app/backend/routes/documents.py` — Document generation
- `/app/backend/sync_all.py` — Production data sync script

## DB Schema (Key Tables)
- `products`: Single source of truth for product state (product_state, cleaning_status, width_cm, height_cm, depth_cm, diameter_cm)
- `fin_payments`: Uses `status` (pending=charges, confirmed=payments)
- `fin_deposit_events`: Partial deposit refund history
- `system_settings`: (setting_key PK, setting_value) — company data
- `document_templates`: (doc_type PK, template_content LONGTEXT) — template overrides

## Prioritized Backlog

### P0 (All Completed)
- ~~Mobile Responsive Damages Cabinet~~
- ~~Double Discount Bug~~
- ~~Late Fees Double Counting~~
- ~~Frontend Build Error~~ — Fixed March 18, 2026
- ~~Backend case_number NameError~~ — Fixed March 18, 2026

### P1
- Post-Deployment Health Check
- Simplify `laundry_items` table/logic
- Clarify purpose of `damages.py` and `audit.py` (confirmed in active use)

### P2
- Fix `convert-to-order` endpoint instability
- Fix moodboard export
- Fix calendar timezone bug
- Document template: "Акт повернення" (Return Act)

### P3
- WebSocket real-time updates
- Unify `NewOrderViewWorkspace.jsx` and `IssueCardWorkspace.jsx`
- Full RBAC
- HR/Ops Module
- Telegram bot integration

## Credentials
- Admin: vitokdrako@gmail.com / test123
- Manager: max@test.com / test123
