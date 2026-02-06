# RentalHub + Ivent-tool PRD

## Original Problem Statement
Інтеграція публічного каталогу декору (Ivent-tool) з адміністративною панеллю RentalHub. Створення візуального мудборд-редактора для декораторів та функціоналу відправки замовлень до RentalHub.

## User's Preferred Language
Українська

---

## What's Been Implemented

### 2025-02-06: Complete Moodboard + Order System

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
- Rental days calculator with FarForRent business rules

**P1: PDF Export (NEW)**
- Integrated `jsPDF` library
- Export dropdown menu with PNG, JPG, PDF options
- High-quality export with pixelRatio=3

**P1: Layers Panel (NEW)**
- Full layer management: visibility, lock, delete
- Layer ordering: bring to front, send to back
- Visual thumbnail previews

**P1: Templates Panel (NEW)**
- Layout templates: Single, Grid 2x2, Collage, etc.
- Canvas size presets: A4 Portrait/Landscape, Square, Instagram
- Background color picker with presets

**P1: Inspector Panel**
- Position, size, rotation, opacity controls
- Layer controls and actions
- Type-specific properties (text font size, color)

### Previous Session Work
- Moodboard MVP architecture with Konva.js + Zustand
- Color filter deduplication  
- Availability check sync with RentalHub
- Backend caching for filters

---

## Moodboard Feature Summary

| Feature | Status |
|---------|--------|
| Drag & Drop Products | ✅ Done |
| Image Rendering (CORS) | ✅ Fixed |
| Text Elements | ✅ Done |
| Transform (resize/rotate) | ✅ Done |
| Layer Management | ✅ Done |
| Layout Templates | ✅ Done |
| Background Colors | ✅ Done |
| Canvas Size Presets | ✅ Done |
| Export PNG | ✅ Done |
| Export JPG | ✅ Done |
| Export PDF | ✅ Done |
| Undo/Redo | ✅ Done |
| Zoom/Pan | ✅ Done |
| Grid Overlay | ✅ Done |
| Inspector Panel | ✅ Done |

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
RentalHub Admin sees order with #IT-XXXX prefix
```

---

## P0 Pending Issues
- None currently blocking

## P1 Upcoming Tasks
- [ ] Test checkout flow on events.farforrent.com.ua
- [ ] Verify #IT-XXXX orders display correctly in RentalHub
- [ ] Calendar timezone bug (recurring 3+ times)

## P2 Future Tasks
- [ ] Unify Order Workspaces (NewOrderViewWorkspace + IssueCardWorkspace)
- [ ] Full RBAC implementation
- [ ] Monthly Financial Reports
- [ ] Background images for moodboard

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
    │       │   ├── components/
    │       │   │   ├── canvas/ (CanvasStage, DecorItemNode, TextNode)
    │       │   │   ├── panels/ (TopBar, LeftPanel, RightPanel, LayersPanel, TemplatesPanel)
    │       │   │   └── inspector/ (InspectorPanel)
    │       │   ├── store/ (moodboardStore.js - Zustand)
    │       │   ├── domain/ (types, ops)
    │       │   └── utils/ (imageUtils)
    │       ├── components/
    │       │   └── OrderCheckoutModal.jsx
    │       └── utils/
    │           └── rentalDaysCalculator.js
    │
    ├── front_event_tool/      # Production build
    └── backend/               # Backend source (synced to /app/backend)
```

## Dependencies Added
- `jspdf` - PDF generation
- `konva`, `react-konva` - Canvas rendering
- `zustand` - State management
- `use-image` - Image loading for canvas

## Production URLs
- RentalHub Admin: Internal
- Ivent-tool Catalog: events.farforrent.com.ua
- Backend API: backrentalhub.farforrent.com.ua

## Test Credentials
- RentalHub: vitokdrako@gmail.com / test123
- Ivent-tool: test@decorator.com / test123
