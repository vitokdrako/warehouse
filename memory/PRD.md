# RentalHub + Ivent-tool PRD

## Original Problem Statement
Інтеграція публічного каталогу декору (Ivent-tool) з адміністративною панеллю RentalHub. Створення візуального мудборд-редактора для декораторів та функціоналу відправки замовлень до RentalHub.

## User's Preferred Language
Українська

---

## What's Been Implemented

### 2025-02-06: Complete Moodboard + Order System + Workspace Unification

**Moodboard Features (Complete)**
- ✅ Drag & Drop Products
- ✅ Image Rendering (CORS fixed)
- ✅ Text Elements
- ✅ Transform (resize/rotate)
- ✅ Layer Management (LayersPanel)
- ✅ Layout Templates (TemplatesPanel)
- ✅ Background Colors + Images
- ✅ Canvas Size Presets (A4, Square, Instagram)
- ✅ Export: PNG, JPG, PDF
- ✅ Undo/Redo, Zoom/Pan, Grid

**Order Submission (Complete)**
- ✅ 4-step checkout wizard (OrderCheckoutModal)
- ✅ #IT-XXXX prefix for Ivent-tool orders
- ✅ Rental days calculator with FarForRent rules
- ✅ Event info (name, type, location, date)
- ✅ Delivery options, setup notes, company details

**Workspace Unification (Complete)**
- ✅ Badge "Ivent-tool" for IT- orders in WorkspaceHeader
- ✅ ZoneEventInfo component - shows event details for IT- orders
- ✅ useOrderData hook - unified order loading
- ✅ parseEventToolNotes - parses structured notes

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
│   └── src/
│       ├── hooks/
│       │   └── useOrderData.js  # Unified order hook (NEW)
│       ├── components/
│       │   └── order-workspace/
│       │       ├── WorkspaceHeader.jsx (IT- badge)
│       │       └── zones/
│       │           └── ZoneEventInfo.jsx (NEW)
│       └── pages/
│           ├── NewOrderViewWorkspace.jsx
│           └── IssueCardWorkspace.jsx
│
└── clean_project/
    ├── front_event_tool_src/  # Ivent-tool React source
    │   └── src/
    │       ├── moodboard/     # Konva.js + Zustand
    │       │   ├── components/
    │       │   │   ├── canvas/ (CanvasStage + background images)
    │       │   │   ├── panels/ (TopBar, LeftPanel, LayersPanel, TemplatesPanel)
    │       │   │   └── inspector/
    │       │   └── store/
    │       ├── components/
    │       │   └── OrderCheckoutModal.jsx
    │       └── utils/
    │           └── rentalDaysCalculator.js
    │
    └── front_event_tool/      # Production build
```

---

## P0 Pending Issues
- None

## P1 Upcoming Tasks
- [ ] Test on production (events.farforrent.com.ua)
- [ ] Calendar timezone bug (recurring)

## P2 Future Tasks
- [ ] Full RBAC implementation
- [ ] Monthly Financial Reports

## P3 Backlog
- [ ] Digital Signature Integration

---

## Dependencies Added
- `jspdf` - PDF generation
- `konva`, `react-konva` - Canvas rendering
- `zustand` - State management

## Production URLs
- Ivent-tool: events.farforrent.com.ua
- Backend: backrentalhub.farforrent.com.ua

## Test Credentials
- RentalHub: vitokdrako@gmail.com / test123
- Ivent-tool: test@decorator.com / test123
