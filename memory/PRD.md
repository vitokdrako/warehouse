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
- Documents: 17 doc types overview with creation stats and template badges
- Categories: 155 product categories with search
- Expense Categories: 13 categories, CRUD
- Settings: editable company data (ФОП, ІПН, IBAN, адреса, телефон, email, вебсайт) saved to `system_settings` table
- Removed: Підрядники (0), Працівники (0), Зарплати (0), Логи (фейкові)
- Full corp-* design system, CorporateHeader, lucide icons, custom toasts

#### Dynamic Document Company Data — Feb 2026
- Created `services/company_config.py` — central utility for fetching company data from DB
- All document templates (quote, issue_act, picking_list, master_agreement, etc.) now use DB data
- Both `company.*` and `landlord.*` template variables resolved from `system_settings` table
- Admin Panel Settings tab extended with phone, email, website, short_name fields
- Changes in Admin Panel immediately reflect in all generated documents

#### Other Changes
- Role-based login: manager → /manager-cabinet, admin/requisitor → /manager
- Dashboard cleanup: removed redundant buttons
- Payer types: Фізична особа, ФОП, ТОВ
- Deleted old calendar (UniversalOpsCalendar)

## Key Files
- `/app/frontend/src/pages/AdminPanel.jsx` — Admin panel (5 tabs)
- `/app/frontend/src/pages/UnifiedCalendarNew.jsx` — Calendar
- `/app/frontend/src/pages/PersonalCabinet.jsx` — Cabinet (5 tabs)
- `/app/backend/routes/admin.py` — Admin API (users, document-stats, settings)
- `/app/backend/routes/cabinet.py` — Cabinet API
- `/app/backend/services/company_config.py` — Central company data from DB
- `/app/backend/routes/documents.py` — Document generation endpoints
- `/app/backend/routes/document_render.py` — Template rendering engine
- `/app/backend/services/doc_engine/data_builders.py` — Document data builders

## Prioritized Backlog

### P0 (Completed)
- ~~Document Context Variable Mismatch~~ — Fixed Feb 2026

### P1
- Post-Deployment Health Check
- Simplify `laundry_items`
- Delete legacy routes (`damages.py`, `audit.py`)
- Monthly Cash Desk Closing

### P2
- Document templates (Акт повернення)
- Fix convert-to-order, moodboard, timezone bugs

### P3
- WebSocket, RBAC, Financial Report, HR, Telegram bot

## Credentials
- Admin: vitokdrako@gmail.com / test123
- Manager: max@farforrent.com.ua / test123
