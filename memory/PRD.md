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
- **Tasks tab**: Full Kanban (3 columns), Focus of Day, create/detail modals
- **Chat tab**: Telegram-style messaging, threads, photo upload, task notifications
- **Orders tab**: Order-specific internal chat, search, filters, badge with unread count (24h)
- **Team tab**: team members with activity stats

#### 2. Order Chats Integration
- New "Замовлення" tab in Personal Cabinet with badge counter
- Lists orders with notes count, last message preview, status dots
- Full chat view per order, search, filter (Active/With Notes/All)
- Dashboard "💬 Чат" button redirects to `/cabinet?tab=orders`

#### 3. Role-Based Login Redirect (NEW - March 13, 2026)
- **admin** → `/manager` (Реквізиторська панель)
- **manager** → `/manager-cabinet` (Менеджерська панель)
- **requisitor** → `/manager` (Реквізиторська панель)
- Uses `window.location.href` for reliable full-page navigation

#### 4. Legacy Cleanup
- Deleted: `TasksCabinet.tsx`, redirected `/tasks` → `/cabinet?tab=tasks`
- Dashboard chat button → `/cabinet?tab=orders`

## Roles
| Role | Users | Start Page |
|------|-------|------------|
| admin | vitok, tania | /manager |
| manager | max, marina | /manager-cabinet |
| requisitor | katia, diana, andrii, yaroslav, zhenia | /manager |

## Key Files
- `/app/frontend/src/pages/Login.tsx` — Role-based redirect logic
- `/app/backend/routes/cabinet.py` — Cabinet API (profile, tasks, order-chats, order-notes-new)
- `/app/frontend/src/pages/PersonalCabinet.jsx` — Full cabinet page (all 5 tabs)
- `/app/frontend/src/pages/ManagerDashboard.jsx` — Dashboard

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
- Full RBAC (page-level access control), Monthly Financial Report
- HR/Ops Module, Telegram bot

## Credentials
- Admin: vitokdrako@gmail.com / test123
- Manager: max@farforrent.com.ua / test123
- DB: farforre_rentalhub @ farforre.mysql.tools
