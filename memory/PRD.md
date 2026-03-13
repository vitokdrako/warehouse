# RentalHub - Product Requirements Document

## Original Problem Statement
Build a comprehensive rental management system (RentalHub) for FarforRent — a tableware/decor rental company. The system manages orders, inventory, clients, finances, documents, and internal team workflows.

## Latest Feature: Personal Cabinet & Internal Chat (March 2026)
- **Personal Cabinet** for employees with Profile, My Tasks, Statistics
- **Internal Chat** (Telegram-style) with channels, DMs, threads — all on MySQL
- **Integration** with existing Task Manager system

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MySQL (production: farforre_rentalhub)
- **Database**: MySQL only (farforre_rentalhub for RentalHub, farforre_db for OpenCart)
- **Auth**: JWT-based (24h token, auto-logout at 7:00 AM)

## What's Been Implemented

### Core Features (Previous Sessions)
- Order management (CRUD, sync from OpenCart, status workflow)
- Client management (CRM, auto-creation from orders)
- Finance module (transactions, payments, deposits, kasa)
- Document generation (invoices, service acts, contracts)
- Inventory management (products, categories, damage tracking)
- Task manager (CRUD, assignment, priority, status)
- Calendar (operations calendar with lanes)
- Issue/Return card workflow
- Damage cabinet & laundry tracking
- Email integration

### Recent Completions (This Session - March 2026)
1. **Personal Cabinet** (`/cabinet` route)
   - Profile tab: user info, role badge, login history
   - My Tasks tab: task list with status toggle, filters
   - Team tab: all team members with activity stats
   - Statistics: active/done/overdue tasks, messages today

2. **Internal Team Chat** (MySQL-based)
   - 4 MySQL tables: `chat_channels`, `chat_messages`, `chat_channel_members`, `chat_read_status`
   - Channel types: general, topic, dm
   - Thread support (reply_to)
   - Unread count tracking
   - 4 default channels: Загальний, Склад, Доставка, Термінове
   - Polling-based updates (5s interval)

3. **Production DB Connected**: farforre_rentalhub with all new tables

## Key Files
- `/app/backend/routes/cabinet.py` — Cabinet API (profile, stats, tasks, team)
- `/app/backend/routes/team_chat.py` — Chat API (channels, messages, threads, DMs)
- `/app/frontend/src/pages/PersonalCabinet.jsx` — Full cabinet page with all tabs
- `/app/backend/database_rentalhub.py` — MySQL connection
- `/app/frontend/src/App.tsx` — Routes (including `/cabinet`)

## Prioritized Backlog

### P0 (Critical)
- None currently

### P1 (High Priority)
- Integrate Personal Cabinet with Task Manager and Calendar views
- Post-Deployment Health Check on production
- Simplify `laundry_items` table/logic
- Delete legacy route files (`damages.py`, `audit.py`)
- Implement Monthly Cash Desk Closing

### P2 (Medium Priority)
- Create remaining document templates (Акт повернення)
- Fix `convert-to-order` endpoint instability
- Fix moodboard export
- Fix recurring Calendar timezone bug

### P3 (Future)
- Real-time updates (WebSocket for chat)
- Unify `NewOrderViewWorkspace.jsx` and `IssueCardWorkspace.jsx`
- Implement full RBAC
- Monthly Financial Report
- HR/Ops Module

## Users (9 active)
| ID | Name | Role |
|----|------|------|
| 1 | Віточек Филим | admin |
| 2 | Таня Операційна | admin |
| 4 | Макс Менеджер | manager |
| 5 | Марина Менеджер | manager |
| 6 | Катя Реквізитор | requisitor |
| 7 | Діана Матіч | requisitor |
| 8 | Андрій Реквізитор | requisitor |
| 9 | Ярослав Реквізитор | requisitor |
| 10 | Женя Реквізитор | requisitor |

## Test Credentials
- Admin: vitokdrako@gmail.com / test123
- DB: farforre_rentalhub @ farforre.mysql.tools
