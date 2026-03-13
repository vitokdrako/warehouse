# RentalHub - Product Requirements Document

## Original Problem Statement
Build a comprehensive rental management system (RentalHub) for FarforRent — a tableware/decor rental company. The system manages orders, inventory, clients, finances, documents, and internal team workflows.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MySQL (production: farforre_rentalhub)
- **Database**: MySQL only (farforre_rentalhub for RentalHub, farforre_db for OpenCart)
- **Auth**: JWT-based (24h token, auto-logout at 7:00 AM)

## What's Been Implemented

### Core Features (Previous Sessions)
- Order management, Client management, Finance module, Document generation
- Inventory management, Calendar, Issue/Return cards, Damage cabinet, Email

### Session: March 2026

#### 1. Personal Cabinet (`/cabinet`) — Central Hub
- **Profile tab**: user info, stats
- **Tasks tab**: Full Kanban (3 columns), Focus of Day, create/detail modals, scope toggle, list/kanban views, filters
- **Chat tab**: Telegram-style messaging, threads, photo upload, task notifications
- **Orders tab**: Order-specific internal chat, search, filters (Active/With Notes/All), message sending, **NEW: badge with unread count (last 24h)**
- **Team tab**: team members with activity stats

#### 2. Internal Chat (MySQL) with:
- Channels (general, topic, dm), threads with close/reopen
- Task-Chat integration (auto-notifications)
- Photo upload (inline images)

#### 3. Order Chats Integration (March 13, 2026)
- New "Замовлення" tab in Personal Cabinet
- Lists all orders with notes count, last message preview, status dots
- Full chat view per order using existing `order_internal_notes` table
- Search by order number or client name
- Filter: Active / With Notes / All
- Dashboard "💬 Чат" button redirects to `/cabinet?tab=orders`
- **Badge counter**: shows new notes from last 24h (not by current user), auto-refreshes every 15s

#### 4. Legacy Cleanup
- **Deleted**: `TasksCabinet.tsx` (replaced by `/cabinet?tab=tasks`)
- **Redirect**: `/tasks` → `/cabinet?tab=tasks`
- **Updated**: Dashboard chat button → `/cabinet?tab=orders`

## Key Files
- `/app/backend/routes/cabinet.py` — Cabinet API (profile, tasks, order-chats, order-notes-new)
- `/app/backend/routes/team_chat.py` — Team Chat API
- `/app/backend/routes/tasks.py` — Task CRUD with chat integration
- `/app/backend/routes/order_internal_notes.py` — Order notes CRUD
- `/app/frontend/src/pages/PersonalCabinet.jsx` — Full cabinet page (all 5 tabs)
- `/app/frontend/src/pages/ManagerDashboard.jsx` — Dashboard (chat redirects to cabinet)

## Prioritized Backlog

### P1 (High Priority)
- Post-Deployment Health Check on production
- Simplify `laundry_items` table/logic
- Delete legacy route files (`damages.py`, `audit.py`)
- Implement Monthly Cash Desk Closing

### P2 (Medium Priority)
- Create remaining document templates (Акт повернення)
- Fix `convert-to-order` endpoint instability
- Fix moodboard export, Calendar timezone bug

### P3 (Future)
- WebSocket for real-time chat
- Unify workspace components, full RBAC
- Monthly Financial Report, HR/Ops Module
- Telegram bot push notifications

## Credentials
- Admin: vitokdrako@gmail.com / test123
- DB: farforre_rentalhub @ farforre.mysql.tools
