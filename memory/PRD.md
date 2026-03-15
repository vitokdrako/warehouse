# RentalHub - Product Requirements Document

## Original Problem Statement
Build a comprehensive rental management system (RentalHub) for FarforRent — a tableware/decor rental company.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + MySQL (production: farforre_rentalhub)
- **Auth**: JWT-based (24h token)

## What's Been Implemented

### Core Features (Previous Sessions)
- Order/Client/Finance/Document/Inventory management
- Issue/Return cards, Damage cabinet, Email integration

### Session: March 2026

#### Personal Cabinet (`/cabinet`)
- Profile, Tasks (Kanban), Chat (Telegram-style), Orders (internal notes), Team tabs
- Badge counters for unread chat and new order notes (24h)
- Task-Chat integration (auto-notifications)

#### Order Chats Integration
- "Замовлення" tab with search, filters, message sending
- Dashboard chat button redirects to cabinet

#### Role-Based Login Redirect
- admin/requisitor → `/manager`, manager → `/manager-cabinet`

#### Calendar Redesign (March 15, 2026)
- Full rewrite of `/calendar` with corp-* design system
- Day/Week/Month views, filter chips, stats bar, search
- Today summary widget with event counts
- Create task modal from calendar (integrated with task system)
- Event detail modal with cabinet links (order view, order chat, task in cabinet)
- Overdue return highlighting (pulsing red indicators)
- Mobile auto day-view
- **Deleted**: old `UniversalOpsCalendar.jsx` and `/calendar-old` route

#### Dashboard Cleanup
- Removed: "Нове замовлення", "Чат", "Оновити", "Завдання" buttons from dashboard
- Added "+ Нове замовлення" to ManagerCabinet

#### Payer Types Fix
- 3 types: Фізична особа, ФОП, ТОВ (removed Юридична особа, Нерезидент)
- Tax modes: Загальна/Спрощена for ФОП and ТОВ

## Key Files
- `/app/frontend/src/pages/UnifiedCalendarNew.jsx` — Calendar (redesigned)
- `/app/frontend/src/pages/PersonalCabinet.jsx` — Cabinet (all 5 tabs)
- `/app/frontend/src/pages/Login.tsx` — Role-based redirect
- `/app/backend/routes/cabinet.py` — Cabinet API

## Prioritized Backlog

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
