# RentalHub + Ivent-tool PRD

## Original Problem Statement
Інтеграція публічного каталогу декору (Ivent-tool) з адміністративною панеллю RentalHub. Створення візуального мудборд-редактора для декораторів та функціоналу відправки замовлень до RentalHub.

## User's Preferred Language
Українська

---

## What's Been Implemented

### 2025-02-06: Moodboard Canvas Fix + Order Submission
**P0 Bug Fix: Images rendering as grey squares**
- Fixed `DecorItemNode.jsx` - images now load correctly with CORS support
- Added multiple fallback URLs for image loading
- Added `imageSmoothingEnabled` for quality preservation during scaling

**P1: Order Submission from Ivent-tool**
- Created `OrderCheckoutModal.jsx` - 4-step checkout wizard:
  1. Contact info + payer type (individual/company)
  2. Delivery options (self pickup, delivery, event delivery with setup)
  3. Event details (name, type, location, date, guests, comments)
  4. Order confirmation with approximate pricing

- Orders from Ivent-tool have prefix `#IT-XXXX` (vs `#OC-XXXX` from OpenCart)
- All additional data saved in `notes` field for compatibility with existing DB schema
- Backend endpoint: `POST /api/event/boards/{board_id}/convert-to-order`

**P1: Rental Days Calculator**
- Created `rentalDaysCalculator.js` with FarForRent business rules:
  - 2 days: Mon→Thu, Tue→Fri, Wed→Sat, Fri→Tue, Sat→Tue
  - 1 day: Mon→Wed, Tue→Thu, Wed→Fri, Thu→Sat, Fri→Sat, Sat→Mon
- Shows approximate calculation with disclaimer that manager will confirm

**P1: Inspector Panel**
- Created `InspectorPanel.jsx` for moodboard element editing
- Position, size, rotation, opacity controls
- Layer controls (bring to front/send to back)
- Delete/duplicate actions

**P1: PNG Export with High Quality**
- Updated `TopBar.jsx` with pixelRatio=3 for high-res export

### Previous Session Work
- Moodboard MVP architecture with Konva.js + Zustand
- Color filter deduplication  
- Availability check sync with RentalHub
- Backend caching for filters

---

## Data Flow: Ivent-tool Order → RentalHub

```
OrderCheckoutModal (Frontend)
    ↓
POST /api/event/boards/{id}/convert-to-order
    ↓
INSERT INTO orders (
    order_id, order_number [IT-XXXX], status,
    rental_start_date, rental_end_date, rental_days,
    event_date, event_time, event_location,
    total_price, deposit_amount,
    customer_name, customer_phone, customer_email,
    notes [all extra data], created_at
)
    ↓
INSERT INTO order_items (...)
    ↓
INSERT INTO order_internal_notes (customer comment)
    ↓
INSERT INTO order_lifecycle (created from Ivent-tool)
    ↓
RentalHub Admin sees order with #IT-XXXX prefix
```

---

## Fields Comparison: OpenCart vs Ivent-tool

| Field | OpenCart (OC-) | Ivent-tool (IT-) |
|-------|----------------|------------------|
| order_number | OC-XXXX | IT-XXXX |
| customer_id | ✓ | ✗ |
| event_date | ✗ | ✓ (informative) |
| event_time | ✗ | ✓ |
| event_location | ✗ | ✓ (+ event name) |
| delivery_type | ✗ | ✓ (in notes) |
| delivery_address | ✗ | ✓ (in notes) |
| setup_required | ✗ | ✓ (in notes) |
| payer_type | ✗ | ✓ (in notes) |
| source | ✗ | 'event_tool' (in notes) |

---

## P0 Pending Issues
- None currently blocking

## P1 Upcoming Tasks
- [ ] Full Moodboard feature implementation (PDF export, templates, advanced layers)
- [ ] Calendar timezone bug (recurring 3+ times)

## P2 Future Tasks
- [ ] Unify Order Workspaces (NewOrderViewWorkspace + IssueCardWorkspace)
- [ ] Full RBAC implementation
- [ ] Monthly Financial Reports

## P3 Backlog
- [ ] Digital Signature Integration
- [ ] Product image 404s in catalog (deprioritized)

---

## Architecture

```
/app/
├── backend/                    # FastAPI (shared)
│   └── routes/
│       ├── event_tool.py      # Ivent-tool API
│       ├── orders.py          # Orders API
│       └── catalog.py         # Catalog API
│
├── frontend/                   # RentalHub Admin (port 3000)
│
└── clean_project/
    ├── front_event_tool_src/  # Ivent-tool React source
    │   └── src/
    │       ├── moodboard/     # Konva.js + Zustand module
    │       ├── components/
    │       │   └── OrderCheckoutModal.jsx
    │       └── utils/
    │           └── rentalDaysCalculator.js
    │
    ├── front_event_tool/      # Production build
    └── backend/               # Backend source (synced to /app/backend)
```

## Production URLs
- RentalHub Admin: Internal
- Ivent-tool Catalog: events.farforrent.com.ua
- Backend API: backrentalhub.farforrent.com.ua

## Test Credentials
- RentalHub: vitokdrako@gmail.com / test123
- Ivent-tool: test@decorator.com / test123
