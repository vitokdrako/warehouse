# Rental Hub - Product Requirements Document

## Original Problem Statement
Система управління орендою реквізиту для івентів з повним lifecycle замовлень: від створення до повернення. Інтеграція з OpenCart для синхронізації товарів та клієнтів.

## User Personas
1. **Manager** - обробка замовлень, комунікація з клієнтами, фінанси
2. **Warehouse Staff** - комплектація, видача, приймання повернень
3. **Admin** - системні налаштування, користувачі, звіти

## Core Requirements
- Управління замовленнями з повним lifecycle
- Інвентаризація та відстеження товарів
- Фінансовий облік (оренда, застава, пошкодження)
- Документообіг (накладні, акти, QR коди)
- Синхронізація з OpenCart

---

## What's Been Implemented

### Latest Session (2026-01-30)
- ✅ **Real-time Order Synchronization** - WebSocket система для синхронізації змін між користувачами
  - Backend: WebSocket handler, REST API для версій, конфлікт-детекція
  - Frontend: useOrderWebSocket хук, індикатори активних юзерів, кнопка оновлення
  - Таблиця `order_section_versions` для версіонування секцій замовлення
- ✅ **Звукові сповіщення** - Web Audio API нотифікації при змінах
  - Різні звуки для: оновлення, приєднання користувача, конфлікту версій
  - Кнопка вмикання/вимикання звуку в хедері
- ✅ **Request Limiter Integration** - захист від ERR_HTTP2_SERVER_REFUSED_STREAM
  - Інтегровано в ManagerDashboard через limitedAuthFetch

### Previous Sessions
- ✅ Unified Calendar Hub - об'єднаний календар всіх подій
- ✅ Archive System Overhaul - модальне вікно з повною історією
- ✅ Inventory Re-audit "Critical" Status
- ✅ SKU with slashes fix (URL encoding)
- ✅ Order #7281 deletion (crash fix)
- ✅ CORS configuration fixes

---

## Prioritized Backlog

### P0 (Critical)
- [ ] Full RBAC (Role-Based Access Control)
- [x] Real-time Order Synchronization ← COMPLETED

### P1 (High Priority)
- [ ] Monthly Financial Report
- [x] ERR_HTTP2_SERVER_REFUSED_STREAM protection ← COMPLETED
- [ ] Product Sub-category Data (empty)

### P2 (Medium Priority)  
- [ ] Telegram Bot Integration
- [ ] Digital Signature Integration

### P3 (Low Priority / Tech Debt)
- [ ] Refactor `/app/backend/routes/finance.py`
- [ ] Clean up unused imports/variables in TypeScript files

---

## Architecture

### Backend Stack
- FastAPI + SQLAlchemy
- MySQL (RentalHub DB)
- WebSocket for real-time sync
- PDF generation (weasyprint)

### Frontend Stack
- React 18 + TypeScript
- Shadcn/UI components
- TailwindCSS
- React Router

### Key Files (Real-time Sync)
- `/app/backend/routes/order_sync.py` - WebSocket handler + REST API
- `/app/frontend/src/hooks/useOrderWebSocket.js` - WebSocket client hook
- `/app/frontend/src/hooks/useAutoRefresh.js` - Polling fallback
- `/app/frontend/src/utils/requestLimiter.js` - Request queue utility

### Database Tables (New)
- `order_section_versions` - tracks version per section (header, items, progress, comments)

---

## API Endpoints (Real-time Sync)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders/{id}/versions` | Get current versions of all sections |
| POST | `/api/orders/{id}/sections/{section}/update` | Update section version (returns conflict if outdated) |
| GET | `/api/orders/{id}/active-users` | Get users currently viewing the order |
| GET | `/api/orders/{id}/last-modified` | Get last modification timestamp |
| WS | `/api/orders/{id}/ws` | WebSocket connection for real-time updates |

---

## Test Credentials
- Email: `vitokdrako@gmail.com`
- Password: `test123`
