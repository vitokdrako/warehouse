# RentalHub - Product Requirements Document

## Original Problem Statement
Система управління орендою декору FarforRent (RentalHub) з модулями:
- Управління каталогом та сім'ями товарів
- Кабінет шкоди (Damage Hub) з розподілом на мийку, реставрацію, прання, хімчистку
- Управління партіями прання/хімчистки
- Друковані документи (кошториси, акти передачі)
- Фінансовий модуль
- Календар замовлень

## User Personas
1. **Менеджер складу** - управління товарами, обробка шкоди, формування партій
2. **Адміністратор** - повний доступ до системи
3. **Клієнт** - перегляд кошторисів та актів

## Core Requirements

### Damage Hub (Кабінет шкоди)
- ✅ Розподіл товарів на категорії обробки: Мийка, Реставрація, Прання, Хімчистка, На склад
- ✅ Формування партій прання/хімчистки
- ✅ Часткове повернення товарів з партій
- ✅ Видалення завершених партій
- ✅ Друк актів передачі партій (endpoint `/preview`)
- ✅ Мобільна адаптація модальних вікон
- ✅ Проміжний стан `awaiting_assignment` для товарів що очікують розподілу
- ✅ Endpoint `return-to-stock` для швидкого повернення на склад

### Availability Check (Перевірка доступності)
- ✅ Показує попередження про товари на обробці (мийка/прання/хімчистка/реставрація)
- ✅ Враховує `frozen_quantity` та `in_laundry` з products
- ✅ Показує `ready_quantity` (готова до видачі без обробки)
- ✅ НЕ блокує видачу - тільки попередження
- ✅ Типи попереджень: `on_wash`, `on_laundry`, `on_restoration`, `awaiting_assignment`

### Documents
- ✅ Кошторис (estimate) - стилізований HTML документ
- ✅ Акт передачі партії (laundry_batch) - оновлено під стиль estimate

### Known Issues (P1-P2)
- 🔴 P1: Catalog API повільний `/api/catalog` - блокує FamiliesManager та Quick Add
- 🟡 P2: `convert-to-order` endpoint нестабільний
- 🟡 P2: Moodboard export може бути зламаний
- 🟡 P2: Recurring Calendar Timezone Bug

## Architecture

### Backend (FastAPI + MySQL)
```
/app/backend/
├── routes/
│   ├── laundry.py          # Управління пранням/хімчисткою, партіями
│   ├── catalog.py          # Каталог товарів (NEEDS OPTIMIZATION)
│   └── product_damage_history.py  # Історія пошкоджень + return-to-stock
├── utils/
│   └── availability_checker.py  # Перевірка доступності з processing warnings
├── templates/documents/
│   ├── estimate.html       # Шаблон кошторису
│   └── laundry_batch.html  # Шаблон акту передачі партії
└── database_rentalhub.py   # DB connection
```

### Frontend (React)
```
/app/frontend/src/
├── pages/
│   ├── DamageHubApp.jsx    # Кабінет шкоди (UPDATED - awaiting_assignment status)
│   └── NewOrderViewWorkspace.jsx  # Створення замовлення (UPDATED - processing warnings)
└── components/
    ├── catalog/
    │   └── FamiliesManager.jsx  # Управління сім'ями (BLOCKED by slow API)
    └── order-workspace/zones/
        └── ZoneAvailabilityGate.jsx  # Показ конфліктів та processing warnings (UPDATED)
```

## API Endpoints

### Availability Check
- `POST /api/orders/check-availability` - Перевірка доступності товарів
  - Повертає: `has_processing_warnings`, `processing_warnings`, `ready_quantity`, `on_processing_quantity`
  - Попередження НЕ блокують видачу, тільки інформують

### Laundry/Washing
- `GET /api/laundry/queue?type=washing|laundry` - Черга товарів
- `POST /api/laundry/queue/add-to-batch` - Додати в партію
- `GET /api/laundry/batches?type=washing|laundry` - Список партій
- `GET /api/laundry/batches/{id}` - Деталі партії
- `GET /api/laundry/batches/{id}/preview` - HTML preview для друку ✅ NEW
- `GET /api/laundry/batches/{id}/print` - Редірект на /preview
- `POST /api/laundry/batches/{id}/receive-items` - Прийом товарів
- `DELETE /api/laundry/batches/{id}` - Видалення партії

## What's Been Implemented (December 2025)

### Session: 2025-12-XX
1. **Batch Print View Redesign**
   - Created `/api/laundry/batches/{id}/preview` endpoint
   - Updated `laundry_batch.html` template to match `estimate.html` style
   - Professional brand-consistent document layout

2. **Mobile Responsive Modals in DamageHub**
   - Batch Creation Modal (`batchModal`) - mobile optimized
   - Full-screen Section Modal (`fullScreenModal`) - mobile optimized
   - Quick Add Modal (`quickAddModal`) - mobile optimized
   - Bottom sheet pattern on mobile, centered on desktop
   - Touch-friendly button sizes and spacing

### Previous Sessions
- Damage Hub refactor with separate Washing/Dry Cleaning workflows
- Batch management (create, expand, delete, partial return)
- Quick Add feature for queues
- Project build for deployment

## Next Tasks (Priority Order)

### P1: Critical
1. **Optimize Catalog API** - `/app/backend/routes/catalog.py`
   - Investigate slow queries in `GET /api/catalog` and `GET /api/catalog/families`
   - Add pagination, reduce data fetching, or improve indexing
   - Unblocks: FamiliesManager, Quick Add in DamageHub

### P2: Important
2. Fix `convert-to-order` endpoint instability
3. Fix Moodboard export
4. Fix Calendar timezone bug
5. Create email templates for documents

### Future/Backlog
- Real-time updates for client cabinet
- Unify `NewOrderViewWorkspace.jsx` and `IssueCardWorkspace.jsx`
- Full Role-Based Access Control (RBAC)
- Monthly Financial Report
- HR/Ops Module

## Credentials
- **RentalHub Admin:** `vitokdrako@gmail.com` / `test123`

## Technical Notes
- User's DB connection is slow - avoid screenshot testing
- User prefers Ukrainian language for communication
