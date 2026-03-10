# Damage Hub / Rental Hub - PRD

## Original Problem Statement
Fix bugs and improve functionality in the "Damage Hub" rental management application. The app manages orders, clients, catalog items, documents (quotes, estimates), and payments for a decoration rental business.

## Core Architecture
- **Frontend**: React (CRA) + Tailwind CSS
- **Backend**: FastAPI + PostgreSQL (external OpenCart DB sync)
- **Key Pages**: Manager Cabinet, Order View, Catalog, Damage Hub, Calendar

## What's Been Implemented

### Session 1-N (Previous sessions)
- Full order management workflow with Kanban columns
- Document generation (quotes, estimates) with PDF/email
- Catalog management with families/sets
- Calendar with booking visualization
- Moodboard feature
- Client management (CRUD, search, notes)
- Payment processing within orders
- Master Agreement generation per client
- Order merging functionality

### Session (2026-03-09)
- **Fixed**: Search bar visibility in ClientsTab.jsx
- **Created**: Return & Settlement workflow (ReturnSettlementPage.jsx, ReturnColumn.jsx)
- **Created**: 3-column Manager Cabinet layout with live KPI cards
- **Created**: Defect Act document generation
- **Fixed**: Finance overview SQL queries for correct KPI data

### Session (2026-03-10)
- **Completed**: Price update in farforre_db (OpenCart):
  - Скатертини (cat 125): +1000 UAH (148 products)
  - Серветки (cat 126): +50 UAH (156 products)
  - Ранери (cat 125): +250 UAH (5 products, excluding mirror runners)

## Prioritized Backlog

### P0 (Critical)
- (none currently)

### P1 (High)
- Optimize Catalog API (`/api/catalog`) - performance bottleneck causing FamiliesManager infinite loading
- System cleanup - delete 18 unused tables and 7 obsolete files (pending user approval)

### P2 (Medium)
- Implement document templates: "Act of Return", "Defect Act"
- Fix `convert-to-order` endpoint instability
- Fix Calendar timezone bug
- Fix Moodboard export
- Create email templates for other documents
- General backend performance optimization

### P3 (Backlog/Future)
- Unify `NewOrderViewWorkspace.jsx` and `IssueCardWorkspace.jsx`
- Real-time updates for client cabinet
- Full RBAC implementation
- Monthly Financial Report
- HR/Ops Module

## Key Files
- `/app/frontend/src/components/ClientsTab.jsx` - Client CRM tab
- `/app/frontend/src/pages/ManagerCabinet.jsx` - Manager dashboard
- `/app/frontend/src/pages/NewOrderViewWorkspace.jsx` - Order detail view
- `/app/frontend/src/components/order-workspace/zones/ZoneOperational.jsx` - Order operations
- `/app/backend/routes/catalog.py` - Catalog API (NEEDS OPTIMIZATION)
- `/app/backend/routes/documents.py` - Document generation
- `/app/backend/routes/orders.py` - Order management
- `/app/backend/routes/clients.py` - Client management

## Credentials
- Admin: `vitokdrako@gmail.com` / `test123`

## Known Issues
- FamiliesManager infinite loading (catalog API too slow)
- convert-to-order endpoint unstable
- Moodboard export likely broken
- Calendar timezone bug
