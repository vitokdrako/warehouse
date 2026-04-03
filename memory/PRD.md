# RentalHub PRD

## Original Problem Statement
A comprehensive rental management platform (RentalHub) for FarforRent — a decor rental business. The system includes order management, finance (Kasa), document engine, damage tracking, client CRM, and more.

## Core Architecture
- **Frontend**: React (CRA) + TailwindCSS + Shadcn/UI
- **Backend**: FastAPI + SQLAlchemy + MySQL (remote: farforre.mysql.tools)
- **Production**: Frontend build -> `/app/clean_project/frontend_build/`, Backend -> `https://backrentalhub.farforrent.com.ua`

## Key Modules
1. **Finance/Kasa** — Cash register with income, deposits, expenses tracking; month closing with carry-over balance
2. **Document Engine** — Jinja2-based document generation (invoices, contracts, acts)
3. **Order Management** — Full lifecycle from issue -> order -> delivery -> return
4. **Damage Tracking** — Product damage history with photos
5. **Client CRM** — Master agreements, client profiles, payer types

## What's Been Implemented
- Full Kasa module with 3-column layout (Income/Deposits/Expenses)
- Month closing (Inkasatsiia) with carry-over balance tracking
- Carry-over balance shown at top of Income column
- Data import from Excel source of truth (2026 data)
- Revenue calculation fixes (occurred_at, excluding held deposits)
- Document engine with DB template overrides
- Agreement termination workflow
- Inline damage warnings on order cards
- Expected income plan view
- Manager debts tracking (resolved)
- Expense reporting with category filtering
- Evening cash summary reconciliation
- Admin Panel "Orders Management" tab with full financial CRUD
- Deposit linking to both Orders and Clients
- Deposits column fully decoupled from monthly closing (Inkasatsiia)
- Flat deposit list: Active at top, Closed at bottom
- Deposit refund directly from Kasa for client-only deposits
- **Kasa page fully responsive for mobile devices**

## Production Build Process
1. Update `/app/frontend/.env`: `REACT_APP_BACKEND_URL=https://backrentalhub.farforrent.com.ua`
2. Run `DISABLE_ESLINT_PLUGIN=true yarn build`
3. Copy `build/*` -> `/app/clean_project/frontend_build/`
4. Revert `.env` to preview URL

## Pending Issues
- (P2) `convert-to-order` endpoint instability
- (P2) Moodboard export broken
- (P2) Calendar timezone bug

## Future Tasks
- (P1) Post-deployment health check
- (P1) Simplify laundry_items logic
- (P3) WebSockets for real-time updates
- (P3) Unify order workspace components
- (P3) Full RBAC implementation
- (P3) HR/Ops module
- (P3) Telegram bot for damage alerts

## Credentials
- Admin: vitokdrako@gmail.com / test123
- Manager: max@test.com / test123
