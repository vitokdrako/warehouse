# RentalHub - Product Requirements Document

## Project Overview
Full-stack rental management system (React + FastAPI + MySQL/OpenCart) for FarforRent company.

## Core Features Implemented

### 1. Order Management System
- Order creation, editing, viewing
- Order status workflow (new → assembly → issued → return → completed)
- Manager dashboard with order columns
- Issue card workspace for order assembly

### 2. Versioned Partial Return System ✅ (Feb 2026)
- Database schema: `partial_return_versions`, `partial_return_version_items`
- API: `/api/return-versions/`
- Frontend: `PartialReturnVersionWorkspace.jsx`
- Creates versioned orders (e.g., #OC-7266(1)) for unreturned items
- Integrates with Finance Hub for late fee calculation

### 3. Unified Damage Hub ✅ (Feb 2026)
- Complete refactor from tab-based to 3-column layout
- Files: `DamageHubApp.jsx`, `product_damage_history.py`
- Features:
  - Processing workflow: Wash, Restoration, Dry Cleaning
  - Archive/Restore damage cases
  - One-click write-off for TOTAL_LOSS items
  - "На склад" button to return items without processing
  - Photo display with zoom
  - Damage reason badges
- NO direct financial settlements (processing/tracking only)

### 4. Finance Hub
- Deposit management
- Payment tracking
- Late fee calculation and posting

### 5. Authentication & Authorization
- JWT-based authentication
- User roles (manager, admin, staff)

## Bug Fixes (Feb 2026)

### Fixed: "На склад" Button No Feedback
- Added alert messages for all processing operations
- Fixed React StrictMode race condition in data loading
- Used useRef for mount status tracking

## Pending Tasks

### P1 - High Priority
- [ ] Calendar timezone bug (incorrect date highlighting)

### P2 - Medium Priority  
- [ ] Unify order workspaces (NewOrderViewWorkspace + IssueCardWorkspace)
- [ ] Full RBAC implementation
- [ ] Monthly financial report

### P3 - Low Priority
- [ ] Digital signature integration

## Technical Architecture

### Backend (FastAPI)
- `/app/backend/routes/` - API routes
- `/app/backend/database_rentalhub.py` - DB connection
- Key routes:
  - `return_versions.py` - Versioned returns API
  - `product_damage_history.py` - Damage Hub API
  - `finance.py` - Finance operations

### Frontend (React)
- `/app/frontend/src/pages/` - Page components
- `/app/frontend/src/components/` - Reusable components
- Key pages:
  - `DamageHubApp.jsx` - Damage management
  - `PartialReturnVersionWorkspace.jsx` - Versioned returns
  - `ManagerDashboard.jsx` - Main dashboard

### Database (MySQL)
- OpenCart integration
- Custom tables: `partial_return_versions`, `product_damage_history`, `damage_case_archive`, etc.

## API Endpoints

### Damage Hub
- `GET /api/product-damage-history/cases/grouped` - Get damage cases
- `POST /api/product-damage-history/{id}/return-to-stock` - Return to stock
- `POST /api/product-damage-history/{id}/send-to-wash` - Send to wash
- `POST /api/product-damage-history/order/{id}/archive` - Archive case

### Return Versions
- `POST /api/return-versions/order/{id}/create-version` - Create version
- `GET /api/return-versions/version/{id}` - Get version details
- `GET /api/return-versions/active` - Get active versions

## Credentials
- Test account: vitokdrako@gmail.com / test123
