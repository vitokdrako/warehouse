# Rental Hub PRD

## Original Problem Statement
Система управління орендою товарів для FarforRent. Основні модулі: каталог товарів, замовлення, клієнтський кабінет, damage hub (обробка пошкоджених товарів).

## User Personas
- **Менеджер прокату:** Управляє замовленнями, видачею, поверненням, контролює стан товарів
- **Адміністратор:** Повний доступ, управління каталогом, звіти, налаштування
- **Клієнт:** Перегляд каталогу, статус замовлень через кабінет

## Core Requirements
1. Каталог товарів з фільтрами по категоріях, кольору, матеріалу
2. Перевірка доступності на конкретні дати
3. Damage Hub для обробки пошкоджених товарів (wash, restoration, to_stock)
4. Часткові повернення замовлень
5. Система сетів (families) та наборів товарів

---

## What's Been Implemented

### Session 2025-02-23
- ✅ **family_id відображення на картках товарів** — виправлено API endpoint `/api/catalog/items-by-category`, тепер повертає family_id
- ✅ **Damage Hub awaiting_assignment status** — проміжний статус для товарів що чекають обробки
- ✅ **Availability Checker overhaul** — non-blocking warnings для товарів в обробці
- ✅ **Partial Processing feature** — часткове завершення обробки (наприклад, помити 5 з 80 тарілок)
- ✅ **Backend fix for partial processing** — оновлення aggregate counts (in_laundry, frozen_quantity)
- ✅ **Multiple UI/UX fixes** — modal z-index, quantity display, debounce на Quick Add search

### Previous Sessions
- Мобільна адаптація Families Manager та Products tab
- Розділення dashboard по ролях
- Система часткових повернень
- Email templates (накладна, ТТН)

---

## Architecture

```
/app/
├── backend/
│   ├── routes/
│   │   ├── catalog.py       # MODIFIED: Added family_id to items-by-category
│   │   ├── damage.py        # Damage Hub endpoints
│   │   ├── laundry.py       # Processing endpoints with partial completion
│   │   └── finance.py       # Financial reports
│   └── utils/
│       └── availability_checker.py  # Processing warnings logic
└── frontend/
    └── src/
        ├── pages/
        │   ├── CatalogBoard.jsx       # Products tab with family_id badge
        │   ├── DamageHubApp.jsx       # Full Damage Hub UI
        │   └── NewOrderViewWorkspace.jsx
        └── components/
            └── catalog/
                └── FamiliesManager.jsx  # Sets management (slow due to API)
```

---

## Prioritized Backlog

### P0 - Critical
- (none currently)

### P1 - High Priority
1. **Optimize Catalog API** — `/api/catalog` та `/api/catalog/items-by-category` дуже повільні (20-35 секунд)
2. **System Cleanup** — видалення 18 невикористаних таблиць та 7 застарілих файлів
3. **FamiliesManager infinite loading** — blocked by slow Catalog API

### P2 - Medium Priority
- `convert-to-order` endpoint instability
- Moodboard export functionality
- Calendar timezone bug
- Additional document templates (Акт повернення, Дефектний акт)

### P3 - Future
- Real-time updates for client cabinet
- Unify NewOrderViewWorkspace & IssueCardWorkspace
- Full RBAC implementation
- Monthly financial report
- HR/Ops Module

---

## 3rd Party Integrations
- **SMTPEmailProvider:** Custom SMTP for email sending
- **OpenCart:** Product data synchronization

## Test Credentials
- **Admin:** vitokdrako@gmail.com / test123

## Build Output
Production frontend build: `/app/clean_project/frontend_build/`
