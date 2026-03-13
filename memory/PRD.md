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
- Profile tab: user info, role badge, login history, quick stats
- Tasks tab: Full Kanban board (3 columns), Focus of Day widget, mini week calendar, create/detail modals, scope toggle (Мої/Всі), list/kanban views, filters
- Chat tab: Telegram-style messaging with all features below
- Team tab: team members with activity stats

#### 2. Internal Team Chat (MySQL-based)
- MySQL tables: `chat_channels`, `chat_messages`, `chat_channel_members`, `chat_read_status`
- Channel types: general, topic, dm
- Thread support with close/reopen capability
- Unread count tracking with polling
- Default channels: Загальний, Склад, Доставка, Термінове

#### 3. Task-Chat Integration
- Creating a task auto-posts notification in "Загальний" channel (amber highlighted)
- Task notification becomes thread root for team discussion
- Status changes (todo→in_progress→done) auto-post thread replies

#### 4. Thread Close/Reopen
- Lock button in thread panel to close threads
- Closed threads show "Закрито" badge, block new replies
- Unlock button to reopen when needed

#### 5. Photo Upload in Chat
- Paperclip button for image upload (jpg, png, gif, webp)
- Images stored in /uploads/chat/, served via /api/uploads/chat/
- Inline image display in messages and threads

#### 6. Task Manager Optimization
- Enhanced focus endpoint for daily focus widget
- Scope parameter (my/all) with assignee names
- Calendar→Cabinet navigation on task click
- URL-based tab selection via query params

## Key Files
- `/app/backend/routes/cabinet.py` — Cabinet API (profile, stats, tasks, focus, team)
- `/app/backend/routes/team_chat.py` — Chat API (channels, messages, threads, DMs, upload, close/reopen)
- `/app/backend/routes/tasks.py` — Task CRUD with chat integration
- `/app/frontend/src/pages/PersonalCabinet.jsx` — Full cabinet page
- `/app/frontend/src/pages/UniversalOpsCalendar.jsx` — Calendar (links to cabinet)

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

### P3 (Future)
- Real-time updates (WebSocket for chat)
- Unify `NewOrderViewWorkspace.jsx` and `IssueCardWorkspace.jsx`
- Implement full RBAC
- Monthly Financial Report
- HR/Ops Module
- Push notifications via Telegram bot

## Test Reports
- `/app/test_reports/iteration_16.json` — Cabinet + Chat basics (25/25 passed)
- `/app/test_reports/iteration_17.json` — Task Kanban + Focus + CRUD (21/21 passed)
- `/app/test_reports/iteration_18.json` — Task-Chat, Close threads, Photo upload (13/13 passed)

## Test Credentials
- Admin: vitokdrako@gmail.com / test123
- DB: farforre_rentalhub @ farforre.mysql.tools
