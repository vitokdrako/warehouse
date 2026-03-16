# RentalHub - Product Requirements Document

## Original Problem Statement
Build a comprehensive rental management system (RentalHub) for FarforRent — a tableware/decor rental company.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI (JSX/TSX)
- **Backend**: FastAPI (Python) + MySQL (farforre_rentalhub)
- **Auth**: JWT-based (24h token)

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
- Updated `preview_invoice_offer` and `download_invoice_offer_pdf` endpoints
- Added МФО to system_settings and company_config
- Added invoice_offer to LeftRailDocuments for all order statuses (pending → processing)
- Added Кошторис + Рахунок-оферта links in ClientsTab order list

#### Template Editor — Feb 2026
- **DB-first template loading**: Custom `DBOverrideLoader` for Jinja2 (checks DB before file system)
- **Template CRUD API**: GET/PUT/POST (reset) endpoints at `/api/admin/templates/*`
- **Code editor**: Dark-themed monospace editor with tab support, character count
- **Live preview**: Renders template with real order data in iframe
- **Save/Reset flow**: Save stores to `document_templates` DB table; Reset deletes from DB, reverts to file
- **Source badges**: "Оригінал (файл)" / "Змінено (БД)" indicators

#### Other Changes
- Role-based login: manager → /manager-cabinet, admin/requisitor → /manager
- Dashboard cleanup: removed redundant buttons
- Payer types: Фізична особа, ФОП, ТОВ
- Deleted old calendar (UniversalOpsCalendar)

#### Акт взаєморозрахунків (Settlement Act) — March 15, 2026
- New endpoint: `GET /api/documents/settlement-act/{order_id}/preview` — generates full financial summary
- New endpoint: `GET /api/documents/settlement-act/{order_id}/pdf` — print-ready version
- Template: `/app/backend/templates/documents/settlement_act.html` — styled as quote
- Sections: Замовник, Деталі оренди, Нарахування, Оплати, Застава, Підсумок, Підписи
- Auto-collects: rent, discount, additional services, payments, deposit, manager-charged damage, manager-charged late fees
- **No modal** — opens directly with all data auto-gathered
- Frontend integration:
  - `LeftRailDocuments.jsx`: settlement_act for returning/returned/completed orders (direct open)
  - `ReturnSettlementPage.jsx`:
    - "Акт взаєморозрахунків" button (direct auto-open)
    - "Акт повернення" button
    - "Дефектний акт" button (conditional)
    - **Editable late fee form**: System suggests amount, manager can change before applying
    - **Editable damage charge form**: System suggests amount, manager can change before applying
- Admin: Template available in admin panel template editor
- Tested: All backend/frontend tests PASSED
- Fixed: UUID-based ID generation for manual damage charges in product_damage_history

## Key Files
- `/app/frontend/src/pages/AdminPanel.jsx` — Admin panel (5 tabs + template editor)
- `/app/backend/routes/admin.py` — Admin API (users, doc stats, settings, templates)
- `/app/backend/services/template_loader.py` — DBOverrideLoader for Jinja2
- `/app/backend/services/company_config.py` — Central company data from DB
- `/app/backend/routes/documents.py` — Document generation endpoints
- `/app/backend/routes/document_render.py` — Template rendering engine
- `/app/backend/services/doc_engine/data_builders.py` — Document data builders
- `/app/backend/services/doc_engine/render.py` — HTML/PDF render engine

## DB Schema (New)
- `system_settings`: (setting_key PK, setting_value) — company data
- `document_templates`: (doc_type PK, template_content LONGTEXT, updated_at, updated_by) — template overrides

## Prioritized Backlog

### P0 (Completed)
- ~~Document Context Variable Mismatch~~ — Fixed
- ~~Template Editor~~ — Implemented
- ~~Settlement Act (Акт взаєморозрахунків)~~ — Implemented (March 15, 2026)
- ~~Mobile Responsive Damages Cabinet~~ — **Done (March 16, 2026)**
  - Grid: 1 col (mobile) → 2 col (tablet) → 3 col (desktop)
  - Toolbar stacks vertically on mobile, separate refresh button
  - Column heights adapt: 60vh/70vh/full

### P1
- Post-Deployment Health Check
- Simplify `laundry_items`
- Clarify purpose of `damages.py` and `audit.py` (user confirmed they are in active use — DO NOT delete)
- ~~Monthly Cash Desk Closing~~ — **Done (March 15, 2026)**
  - Backend: close-month, monthly-reports CRUD endpoints
  - Frontend: KasaPage "Закрити місяць" button + AdminPanel "Звіти" tab

### P2
- Document templates (Акт повернення)
- Fix convert-to-order, moodboard, timezone bugs

### P3
- WebSocket, RBAC, Financial Report, HR, Telegram bot

## Credentials
- Admin: vitokdrako@gmail.com / test123
- Manager: max@farforrent.com.ua / test123
