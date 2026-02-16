# RentalHub + Ivent-tool Project PRD

## Original Problem Statement
Enhance the "Damage Hub" and integrate "Ivent-tool" into RentalHub. Later focus shifted to Finance Hub optimization and restructuring, then to Documents Engine, and now to Client/Payer architecture and Document Workflow restructuring.

---

## Latest Update: February 16, 2026

### Document Workflow Restructuring - IN PROGRESS

**Phase 1: Master Agreement UI in ClientsTab - DONE ✅**
- **Backend:**
  - `GET /api/agreements/active/{payer_id}` - Returns active/draft MA with status field
  - `POST /api/agreements/create` - Creates new MA with contract_number
  - `POST /api/agreements/{id}/sign` - Signs MA, sets as active for payer
  - All MA APIs tested: 16/16 tests passed
- **Frontend (ClientsTab.jsx):**
  - MA block displays for each payer card
  - Status badges: signed (green), draft (amber), none (dashed)
  - "Create MA" button calls POST /api/agreements/create
  - "Sign MA" button calls POST /api/agreements/{id}/sign
  - MA data loaded via GET /api/agreements/active/{payer_id}

**Phase 2: Payer Selection & Documents in Operations Tab - DONE ✅**
- **Backend:**
  - `GET /api/orders/{order_id}/payer-options` - Lists payers for order's client with MA status
  - `POST /api/orders/{order_id}/set-payer` - Sets payer for order
- **Frontend (FinanceHub.jsx OperationsTab):**
  - Payer dropdown in Documents card
  - Shows current payer with MA status
  - Legal documents (Акт, Додаток) disabled without signed MA
  - Visual indicators: ✅ (has MA) / ⚠️ (no MA)

**Phase 3: UX Improvements - TODO**
- Auto-suggest default payer when creating order
- Add "Link Client" flow for orders without client_user_id

**Phase 4: Documents Tab → Registry - TODO**
- Convert main Documents tab to read-only registry
- Remove document generation buttons
- Focus on search/filter/audit functionality

---

## Architecture

### Client/Payer Model
- **Client** = Contact (`client_users` table)
- **Payer** = Legal entity (`payer_profiles` table)
- **Link** = `client_payer_links` (many-to-many)
- **Order** links to both client and payer

### Document Hierarchy
1. **Master Agreement (MA)** → linked to `payer_profile`
2. **Order Annex** → linked to `order` AND `master_agreement`
3. **Acts/Invoices** → linked to `order`, require signed MA for legal entities

### Key Tables
- `payer_profiles` - Payer entities with billing details
- `master_agreements` - Contracts with status (draft/signed/expired)
- `order_annexes` - Order-specific document references
- `client_payer_links` - Client-Payer relationships
- `orders.payer_profile_id` - Selected payer for order

---

## Pending Issues (P1-P2)
- **P1:** `convert-to-order` endpoint unstable (needs testing after refactoring)
- **P2:** Moodboard export likely broken
- **P2:** Calendar timezone bug

## Future Tasks
- Real-time updates for client cabinet
- Unify NewOrderViewWorkspace and IssueCardWorkspace
- Full RBAC implementation
- Monthly Financial Report
- HR/Ops Module

---

## Previous Completed Work

### Phase 3.3: Email Provider + Print + Expiration UI - COMPLETE ✅
- SMTP Email Provider configured and working
- Print/PDF button with proper CSS
- Contract expiration banners and warnings

### Phase 3.2: Full Documents Lifecycle - COMPLETE ✅
- Manual fields form per document type
- Email workflow with audit trail
- Payment ↔ Annex linking validation

### Finance Cabinet "Clients" Tab - COMPLETE ✅
- CRM-lite tab in FinanceHub for managing clients and payers
- Client list with payer status indicators
- Quick actions for creating/editing payers

### Re-audit Cabinet Enhancement - COMPLETE ✅
- Added category/subcategory editing
- Split dimensions into separate DB columns
- New shape attribute with dictionary
- JSON-based hashtags system

---

## Test Reports
- `/app/test_reports/iteration_7.json` - MA APIs: 16/16 tests passed
- Backend tests at `/app/backend/tests/test_master_agreements.py`

## Credentials
- Admin: `vitokdrako@gmail.com` / `test123`
