# RentalHub + Ivent-tool Project PRD

## Original Problem Statement
The user's initial request was to enhance the "Damage Hub" and integrate an existing public-facing decorator catalog application, "Ivent-tool," into the main RentalHub system.

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

### December 2025 Session:

#### 1. Mobile Optimization (COMPLETED)
- Created comprehensive mobile stylesheet (`/app/clean_project/front_event_tool_src/src/styles/mobile.css`)
- Responsive header with mobile menu icons
- Mobile-first product grid (2 columns on phones)
- Full-screen side panel overlay on mobile with dark backdrop
- Floating cart button on mobile
- Touch-optimized buttons (min 44px touch targets)
- iOS-specific fixes (font-size 16px to prevent zoom)
- Mobile-friendly modals (bottom sheet style)

#### 2. Date Bug Fix (COMPLETED)
- Fixed backend `POST /api/event/boards` endpoint to return full board object
- Previously only returned `{id, board_name, status, items}` - missing dates
- Now returns complete board with `rental_start_date`, `rental_end_date`, `rental_days`, etc.
- Added `cover_image` to `EventBoardCreate` schema

### Previous Sessions:

#### Moodboard MVP
- Konva.js canvas rendering with Zustand state management
- Inspector panel for editing nodes
- Layers panel and layout templates
- PNG/PDF export (currently affected by CORS workaround)
- Custom background images

#### Ivent-tool Order Submission
- Full checkout flow (`OrderCheckoutModal.jsx`)
- Backend order creation with `#IT-` prefix
- Custom rental day calculations
- Integration with RentalHub orders table

#### Bug Fixes
- CORS fix for user registration (`allow_origins=["*"]`)
- User registration flow working

## Known Issues

### P0 - Moodboard Export
**Status:** BLOCKED - awaiting user to deploy backend CORS fix to production
**Details:** Images render but export fails due to canvas tainting. Once backend is deployed, need to re-add `crossOrigin="anonymous"` in `DecorItemNode.jsx`.

### P1 - Calendar Timezone Bug
**Status:** NOT STARTED
**Recurrence:** 4+ times reported

## Key API Endpoints
- `POST /api/event/boards` - Create moodboard (NOW returns full board object)
- `PATCH /api/event/boards/{board_id}` - Update board dates/info
- `POST /api/event/boards/{board_id}/convert-to-order` - Create RentalHub order
- `POST /api/event/auth/register` - User registration

## Test Credentials
- **RentalHub Admin:** vitokdrako@gmail.com / test123
- **Ivent-tool Decorator:** test@decorator.com / test123

## Upcoming Tasks
1. Complete workspace unification (NewOrderViewWorkspace + IssueCardWorkspace)
2. Fix moodboard export after CORS deployment
3. Calendar timezone bug fix
4. Role-Based Access Control (RBAC)
5. Monthly Financial Report
6. Digital Signature Integration

## Files Modified This Session
- `/app/clean_project/backend/routes/event_tool.py` - Fixed board creation response
- `/app/clean_project/front_event_tool_src/src/App.js` - Mobile responsive layout
- `/app/clean_project/front_event_tool_src/src/index.css` - Added mobile.css import
- `/app/clean_project/front_event_tool_src/src/styles/mobile.css` - NEW: Comprehensive mobile styles
- `/app/clean_project/front_event_tool_src/src/components/ProductCard.css` - Mobile responsive
- `/app/clean_project/front_event_tool_src/src/components/BoardItemCard.css` - Mobile responsive
- `/app/clean_project/front_event_tool_src/src/components/CreateBoardModal.css` - Mobile responsive
- `/app/clean_project/front_event_tool_src/src/components/OrderCheckoutModal.jsx` - Mobile responsive
