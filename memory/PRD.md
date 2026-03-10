# Damage Hub / Rental Hub - PRD

## Original Problem Statement
Fix bugs and improve functionality in the "Damage Hub" rental management application. The app manages orders, clients, catalog items, documents (quotes, estimates), and payments for a decoration rental business.

## Core Architecture
- **Frontend**: React (CRA) + Tailwind CSS
- **Backend**: FastAPI + MySQL (external OpenCart DB sync via SQLAlchemy)
- **Key Pages**: Manager Cabinet, Order View, Catalog, Damage Hub, Calendar

## What's Been Implemented

### Previous sessions
- Full order management workflow with Kanban columns
- Document generation (quotes, estimates, issue act, picking list) with PDF/email
- Catalog management with families/sets
- Calendar with booking visualization
- Moodboard feature
- Client management (CRUD, search, notes)
- Payment processing within orders
- Master Agreement generation per client
- Order merging functionality
- Packaging return workflow (interactive for Prop Masters)
- Prop Master UI cleanup (removed financial data, add-on orders)
- Document generation overhaul (Handover Act, Picking List redesigned)
- Damage tracking "For comparison" option
- Damage Cabinet 3-column redesign (Wash, Restoration, Laundry)
- Laundry batch management, quick-add by SKU, delete from queues

### Session (2026-03-10) - Latest
- **Completed**: Printable lists for Damage Cabinet
  - Fixed missing `Printer` import in DamageHubApp.jsx
  - Fixed `p.image` -> `p.image_url` column name in documents.py SQL queries
  - Added `laundry` support to processing-list endpoint
  - Added print button to LaundryColumn header
  - Added print button to BatchCard for individual batch printing
  - Backend endpoints verified: `/api/documents/processing-list/{wash|restoration|laundry}/preview`, `/api/documents/laundry-batch/{batch_id}/preview`
- **Completed**: Production frontend build
  - Built with `REACT_APP_BACKEND_URL=https://backrentalhub.farforrent.com.ua`
  - Output in `/app/clean_project/frontend_build/` (no archives)

## Prioritized Backlog

### P1 (High)
- Optimize Catalog API (`/api/catalog`) - performance bottleneck causing FamiliesManager infinite loading
- System cleanup - delete 18 unused tables and 7 obsolete files (pending user approval)

### P2 (Medium)
- Implement remaining document templates: "Act of Return" (Акт повернення)
- Fix `convert-to-order` endpoint instability
- Fix Calendar timezone bug
- Fix Moodboard export
- Create email templates for other documents

### P3 (Future/Backlog)
- Real-time updates for client cabinet
- Unify NewOrderViewWorkspace and IssueCardWorkspace
- Unify database item status tables
- Implement full RBAC
- Monthly Financial Report
- HR/Ops Module

## Key Files
- `/app/frontend/src/pages/DamageHubApp.jsx` - Damage Cabinet 3-column UI
- `/app/backend/routes/documents.py` - All document generation endpoints
- `/app/backend/templates/documents/processing_list.html` - Processing queue list template
- `/app/frontend/src/components/workspaces/issue-card/left-rail/LeftRailDocuments.jsx` - Document generation in issue cards
- `/app/frontend/src/components/workspaces/shared/DamageModal.jsx` - Damage recording modal

## Credentials
- Admin: `vitokdrako@gmail.com` / `test123`
- Production frontend: `https://rentalhub.farforrent.com.ua`
- Production backend: `https://backrentalhub.farforrent.com.ua`
