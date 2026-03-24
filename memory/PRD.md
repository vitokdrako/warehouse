# PRD - Rental Management Platform (FarforDecorOrenda)

## Original Problem Statement
Build and maintain a comprehensive rental management platform for decorative items (tableware, decor, etc.) with order management, damage tracking, document generation, and financial management.

## User Personas
- **Admin**: Full access, company configuration
- **Manager**: Order management, client interaction, damage recording, document generation
- **Client**: View orders, chat with managers

## Core Requirements
1. Order lifecycle management (creation -> processing -> issuance -> return -> completion)
2. Damage tracking workflow with three types:
   - **В стан декору (To State)**: Records damage to product state, requires processing queue on return
   - **Без запису у стан / Для порівняння (Fixation/Photo Only)**: Documentation-only record, no queue required, stored separately
   - **Повна втрата (Total Loss)**: Full write-off with financial recording
3. Document generation (Issue Act, Return Act, Defect Act, Settlement Act)
4. Financial management (deposits, fees, payments)
5. Personal cabinet with chat for client communication
6. Damage Hub for tracking all damage records
7. Partial return handling with version management

## Architecture
- **Frontend**: React (JSX) with TailwindCSS, Shadcn/UI components
- **Backend**: FastAPI with SQLAlchemy, MySQL database
- **Document Engine**: Jinja2 templates -> HTML -> PDF generation
- **External**: OpenCart sync, SMTP email

## Key Database Tables
- `orders`, `order_items` - Order management
- `product_damage_history` - Central damage log (processing_type: photo_only/written_off/wash/restoration/laundry/none)
- `return_cards` - Return process data
- `partial_return_version_items` - Partial return tracking
- `order_packaging` - Packaging per order
- `payer_profiles`, `master_agreements` - Legal/financial entities
- `generated_documents` / `documents` - Document storage

## What's Been Implemented

### Previous Sessions
- Core platform: orders, products, inventory, calendar
- Financial system: deposits, payments, settlements
- Document generation framework
- Personal cabinet with chat, mobile responsiveness
- Total Loss workflow (unified process-loss endpoint)
- Individual item packaging (quantity inputs)
- Damage recording refactor (3 types: Total Loss, To State, Fixation)
- Damage Hub: "Written Off" and "Fixations" tabs
- Defect Act: photos of damaged items
- Chat UX improvements (auto-scroll fix, sound notifications)

### Current Session (2026-03-24)
- **Defect Act Enhanced**: Now includes ALL damage types with type badges (Фіксація, Втрата, В стан, До видачі) and photos
- **Return Act Redesigned**: Modern standalone template with comprehensive data - pre-issue damage comparison, packaging, all damage records per item
- **Backend Fix**: photo_only records no longer freeze product state
- **Defect Act Button Fix**: Shows when ANY damage records exist (not just when fee total > 0)
- **DamageModal UX**: Queue selection clarification text added
- **Client Tab Document Links**: New batch endpoint `/api/documents/batch-by-orders` + colored document link badges in ClientsTab (Акт видачі, Акт повернення, Дефектний акт, etc.)

## Pending Issues (P2)
1. `convert-to-order` endpoint instability
2. Moodboard export likely broken
3. Calendar timezone bug
4. Re-audit "Total Loss" button logic verification

## Upcoming Tasks
- (P1) Post-deployment health check
- (P1) Simplify `laundry_items` table/logic

## Future/Backlog Tasks
- (P3) Real-time updates (WebSockets)
- (P3) Unify NewOrderViewWorkspace and IssueCardWorkspace
- (P3) Full RBAC
- (P3) HR/Ops Module
- (P3) Telegram bot integration

## Key Files
- `/app/backend/services/doc_engine/data_builders.py` - Document data builders
- `/app/backend/routes/product_damage_history.py` - Damage CRUD
- `/app/backend/routes/documents.py` - Document generation + batch endpoint
- `/app/backend/routes/document_render.py` - Document rendering
- `/app/backend/templates/documents/return_act/v1.html` - Return Act template
- `/app/backend/templates/documents/defect_act/v1.html` - Defect Act template
- `/app/frontend/src/components/DamageModal.jsx` - Damage recording modal
- `/app/frontend/src/components/ClientsTab.jsx` - Client CRM with document links
- `/app/frontend/src/pages/ReturnSettlementPage.jsx` - Return settlement page
- `/app/frontend/src/pages/DamageHubApp.jsx` - Damage hub dashboard

## Credentials
- Admin: vitokdrako@gmail.com / test123
