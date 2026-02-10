# RentalHub + Ivent-tool Project PRD

## Original Problem Statement
The user's initial request was to enhance the "Damage Hub" and integrate an existing public-facing decorator catalog application, "Ivent-tool," into the main RentalHub system.

---

## Latest Update: February 10, 2025

### Performance Optimization Phase 1 (P0) - COMPLETED ✅

**Problem:** Order Workspace had significant performance issues causing:
- Slow load times due to fetching ALL deposits (`GET /api/finance/deposits`)
- Duplicate data fetching (WebSocket + Polling + EventBus simultaneously)
- "Refetch storms" from rapid EventBus events
- Race conditions when sending emails after document generation

**Solution (Phase 1):**

1. **P0.1 LeftRailFinance - New Optimized Endpoint**
   - Created `GET /api/finance/deposit-hold?order_id={id}` endpoint in `/app/backend/routes/finance.py`
   - Returns single deposit for order instead of ALL deposits
   - Updated `LeftRailFinance.jsx` to use new endpoint

2. **P0.2 Polling Deduplication**
   - Modified `useOrderSync` hook to accept `wsConnected` parameter
   - When WebSocket connected: polling disabled (60s fallback)
   - Updated `IssueCardWorkspace.jsx` and `ReturnOrderWorkspace.jsx`

3. **P0.3 EventBus Debounce**
   - Added 300ms debounce to EventBus refetch triggers in `LeftRailFinance.jsx`
   - Prevents "refetch storms" from rapid events

4. **P1.1 Parallel Document Loading**
   - Changed `loadDocumentVersions` in `LeftRailDocuments.jsx` from serial loop to `Promise.allSettled`
   - Documents now load in parallel

5. **P1.2 Race Condition Fix**
   - `generateNewDocument` now returns document data
   - `sendEmail` uses returned data directly instead of relying on state
   - Fixes "Generate → Send Email" failing on first attempt

**Files Modified:**
- `/app/backend/routes/finance.py` - Added deposit-hold endpoint
- `/app/frontend/src/components/order-workspace/LeftRailFinance.jsx` - Optimized with debounce + new endpoint
- `/app/frontend/src/components/order-workspace/LeftRailDocuments.jsx` - Parallel loading + race condition fix
- `/app/frontend/src/hooks/useAutoRefresh.js` - WS-aware polling
- `/app/frontend/src/pages/IssueCardWorkspace.jsx` - Pass wsConnected to useOrderSync
- `/app/frontend/src/pages/ReturnOrderWorkspace.jsx` - Pass wsConnected to useOrderSync

---

### Previous Update: Catalog Inventory Status Fix (P0) - COMPLETED ✅

**Problem:** Items sent to repair/wash/laundry via "Quick Actions" were showing as "available" when they should show "on restoration".

**Solution:**
1. Updated `catalog.py` to read item status from `products.state` and `products.frozen_quantity`
2. Fixed `inventory.py` to set proper state values

---

## Project Architecture
```
/app/
├── backend/                  # Main backend (synced with clean_project/backend)
│   ├── routes/
│   │   └── event_tool.py     # Event Tool API routes
│   └── server.py
├── clean_project/
│   ├── backend/              # Source of truth for backend code
│   └── front_event_tool_src/ # Source of truth for Ivent-tool frontend
│       └── src/
│           ├── components/   # React components
│           ├── moodboard/    # Konva.js moodboard feature
│           ├── styles/       # CSS including mobile.css
│           └── utils/
└── frontend/                 # RentalHub Admin Panel frontend
```

## What's Been Implemented

### February 10, 2025:
- **Performance Optimization Phase 1** - Order Workspace optimization (debounce, parallel loading, polling dedup)

### Previous Sessions:
- **Inventory Status Fix** - Catalog now correctly shows items on restoration
- **Damage Hub Enhancements** - Complete/hide items, full-screen modals
- **Mobile Optimization** - Responsive design for Ivent-tool
- **Moodboard MVP** - Konva.js canvas with export (CORS blocked)
- **Ivent-tool Order Submission** - Full checkout flow

## Known Issues

### P1 - Moodboard Export
**Status:** BLOCKED - awaiting user to deploy backend CORS fix
**Details:** Export fails due to canvas tainting. Need to re-add `crossOrigin="anonymous"` after backend deploy.

### P2 - Calendar Timezone Bug
**Status:** NOT STARTED
**Recurrence:** 4+ times reported

## Upcoming Tasks (Phase 2)
1. **Batch endpoint for documents** - `POST /api/documents/latest-batch`
2. **Timeline dedupe + useMemo** - Optimize timeline rendering
3. **Footer scroll refactor** - Use useRef for scroll listener
4. **Workspace unification** - Merge NewOrderViewWorkspace + IssueCardWorkspace

## Future Tasks (P2+)
1. Fix moodboard export after CORS deployment
2. Calendar timezone bug fix
3. Role-Based Access Control (RBAC)
4. Monthly Financial Report
5. Digital Signature Integration

## Key API Endpoints
- `GET /api/finance/deposit-hold?order_id={id}` - **NEW** Single deposit for order
- `GET /api/finance/deposits` - All deposits (still works)
- `POST /api/event/boards` - Create moodboard
- `PATCH /api/event/boards/{board_id}` - Update board
- `POST /api/event/boards/{board_id}/convert-to-order` - Create RentalHub order

## Test Credentials
- **RentalHub Admin:** vitokdrako@gmail.com / test123
- **Ivent-tool Decorator:** test@decorator.com / test123
