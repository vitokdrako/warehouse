# RentalHub PRD

## Original Problem Statement
Stabilize and optimize the "Damage Cabinet" system. Evolved into a large-scale system-wide optimization: unify DB tables, refactor app, simplify UI, build CRM, fix document generation, and apply all changes to live production.

## Architecture
- Backend: FastAPI + MySQL (farforre.mysql.tools) + MongoDB
- Frontend: React
- External: OpenCart MySQL, SMTP email, Telegram bot
- Production: rentalhub.farforrent.com.ua

## Completed Work (Previous Sessions)
- Production schema sync & data migration
- Client CRM feature (live)
- Document generation: invoices & service acts (live)
- Production data fixes (payer profiles, stuck items)
- Auto-client creation from orders
- Released textile items from мийка/пральня

## Completed Work (Current Session)

### Service Fee Fix (total_to_pay)
- Added `total_to_pay` field to backend: `GET /api/orders/{id}` and `GET /api/orders` list
- Formula: `total_to_pay = total_price - discount + service_fee`
- Fixed double-counting bug in `NewOrderViewWorkspace.jsx` save logic
- Updated all frontend components to show `total_to_pay`:
  - OrdersArchive.jsx (header, modal items tab, modal info tab, modal finance tab)
  - ManagerCabinet.jsx (order card)
  - ReturnColumn.jsx (return summary)
  - ManagerDashboard.jsx (already correct)
  - FinanceHub.jsx (already correct)

### Full Order Estimate Page
- Created `/order/:id/estimate` route → `OrderEstimatePage.jsx`
- Full-page кошторис with sections:
  - Client info, Dates, Financial summary (3-column layout)
  - Items table with photos, SKU, qty, price/day, totals
  - Service fees and discounts in table footer
  - Payments list
  - Documents list with Preview/PDF links
  - Lifecycle timeline
  - Notes section
- Backend: Added `documents` array to `GET /api/orders/{id}` response

### Client Orders Integration
- Updated `ClientsTab.jsx` drawer:
  - Orders are now clickable → navigate to `/order/{id}/estimate`
  - Show `total_to_pay` instead of just `total_price`
  - Show service_fee label when present
  - Status labels in Ukrainian with color coding
- Updated `GET /api/clients/{id}` to return `service_fee`, `discount_amount`, `total_to_pay` for each order

## Pending Issues (P2)
- convert-to-order endpoint instability
- Moodboard export likely broken
- Recurring Calendar Timezone Bug

## Upcoming Tasks (P1)
- Remove/redirect Archive as separate page → integrate into Clients
- Post-deployment health check
- Simplify laundry_items table/logic
- Delete legacy route files (damages.py, audit.py)
- Implement Monthly Cash Desk Closing

## Future/Backlog
- Create "Акт повернення" document template
- Real-time updates for client cabinet
- Unify NewOrderViewWorkspace.jsx and IssueCardWorkspace.jsx
- Full RBAC
- Monthly Financial Report
- HR/Ops Module
