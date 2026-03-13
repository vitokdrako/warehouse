# RentalHub PRD

## Original Problem Statement
Stabilize and optimize the "Damage Cabinet" system. Evolved into a large-scale system-wide optimization: unify DB tables, refactor app, simplify UI, build CRM, fix document generation, and apply all changes to live production.

## Architecture
- Backend: FastAPI + MySQL (farforre.mysql.tools) + MongoDB
- Frontend: React
- External: OpenCart MySQL, SMTP email, Telegram bot
- Production: rentalhub.farforrent.com.ua

## Completed Work
- Production schema sync & data migration
- Client CRM feature (live)
- Document generation: invoices & service acts (live)
- Production data fixes (payer profiles, stuck items)
- Released 49 textile items from мийка (washing) → completed in product_damage_history
- Updated 10 textile products state from on_laundry → available in products table
- **Auto-client creation from orders:**
  - Fixed `sync_all.py` to auto-create/link clients when OpenCart orders are synced
  - Fixed `create_order` endpoint bugs (wrong column `name` → `full_name`, missing `email_normalized`)
  - Fixed `accept_order` endpoint (removed broken logger reference, fixed column names)
  - Added `/api/clients/sync-from-orders` endpoint for bulk migration
  - Migrated all 74 unlinked orders → linked to client_users (created 5 new clients)
  - Updated total_revenue and last_order_date for all 98 clients

## Pending Issues (P2)
- convert-to-order endpoint instability
- Moodboard export likely broken
- Recurring Calendar Timezone Bug

## Upcoming Tasks (P1)
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
