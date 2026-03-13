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

### Session: March 2026

#### 1. Personal Cabinet (`/cabinet` route)
- **Profile tab**: User info, role badge, login history, quick stats
- **Tasks tab** (Full Kanban):
  - Kanban board with 3 columns (До виконання / В роботі / Виконано)
  - "Focus of the Day" widget (overdue + due today + in progress)
  - Mini week calendar showing task counts per day
  - Task creation modal (title, description, type, priority, assignee, deadline, order)
  - Task detail modal with status change and assignee reassignment
  - Scope toggle: "Мої" (my tasks) / "Всі" (all team tasks)
  - View toggle: Kanban / List
  - Filters: task type, priority, search
- **Chat tab**: Telegram-style messaging (see below)
- **Team tab**: Team members with activity stats

#### 2. Internal Team Chat (MySQL-based)
- 4 MySQL tables: `chat_channels`, `chat_messages`, `chat_channel_members`, `chat_read_status`
- Channel types: general, topic, dm
- Thread support (reply_to)
- Unread count tracking with polling (5s/15s intervals)
- Default channels: Загальний, Склад, Доставка, Термінове

#### 3. Task Manager Optimization
- Enhanced `/api/cabinet/focus` endpoint for daily focus widget
- Enhanced `/api/cabinet/my-tasks` with scope parameter (my/all) and assignee names
- Calendar-Cabinet integration: clicking tasks in calendar navigates to `/cabinet?tab=tasks`
- URL-based tab selection via query params (`?tab=tasks`)
- Fixed SQL bug in tasks.py (product_damage_history.case_number column reference)

## Key Files
- `/app/backend/routes/cabinet.py` — Cabinet API (profile, stats, tasks, focus, team)
- `/app/backend/routes/team_chat.py` — Chat API (channels, messages, threads, DMs)
- `/app/backend/routes/tasks.py` — Task CRUD (fixed SQL bug)
- `/app/frontend/src/pages/PersonalCabinet.jsx` — Full cabinet page (kanban, chat, profile, team)
- `/app/frontend/src/pages/UniversalOpsCalendar.jsx` — Calendar (now links to cabinet)
- `/app/backend/database_rentalhub.py` — MySQL connection

## Prioritized Backlog

### P1 (High Priority)
- Post-Deployment Health Check on production
- Simplify `laundry_items` table/logic
- Delete legacy route files (`damages.py`, `audit.py`)
- Implement Monthly Cash Desk Closing

### P2 (Medium Priority)
- Create remaining document templates (Акт повернення)
- Fix `convert-to-order` endpoint instability
- Fix moodboard export
- Fix recurring Calendar timezone bug
- Task-Chat integration (discuss tasks in chat threads)

### P3 (Future)
- Real-time updates (WebSocket for chat)
- Unify `NewOrderViewWorkspace.jsx` and `IssueCardWorkspace.jsx`
- Implement full RBAC
- Monthly Financial Report
- HR/Ops Module
- Push notifications via Telegram bot

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

## Test Reports
- `/app/test_reports/iteration_16.json` — Cabinet + Chat basics (25/25 passed)
- `/app/test_reports/iteration_17.json` — Task Kanban + Focus + CRUD (21/21 passed)

## Test Credentials
- Admin: vitokdrako@gmail.com / test123
- DB: farforre_rentalhub @ farforre.mysql.tools
