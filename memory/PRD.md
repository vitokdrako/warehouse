# RentalHub + Ivent-tool Project PRD

## Original Problem Statement
Enhance the "Damage Hub" and integrate "Ivent-tool" into RentalHub. Later focus shifted to Finance Hub optimization and restructuring, then to Documents Engine, and now to Client/Payer architecture and Document Workflow restructuring.

---

## Latest Update: February 20, 2026

### Session 10 - UI/UX Improvements

**Що виконано:**

#### 1. ✅ Виправлено кнопку "Відправити на збір" (P0 BUG FIX)
- **Проблема:** Кнопка "Відправити на збір" показувалась для замовлень що вже на комплектації (status=processing)
- **Рішення:** Додано `processing` до масиву `isInProgress` в `/app/frontend/src/pages/NewOrderViewWorkspace.jsx` (рядок 750)
- **Тест:** Замовлення #7340 (processing) - кнопка прихована ✅

#### 2. ✅ Мобільна адаптація каталогу (вкладка "Товари")
**Файл:** `/app/frontend/src/pages/CatalogBoard.jsx`
- Sidebar → слайд-панель з кнопкою "Фільтри" на мобільних
- Згортувані секції (дати, категорія, фільтри)
- Горизонтальний скрол статистик
- Грід товарів: 2 колонки на телефонах
- Компактніші ProductCard (менший padding, зображення)

#### 3. ✅ Розділення Реквізиторська / Менеджерська
**Реквізиторська** (`/app/frontend/src/pages/ManagerDashboard.jsx`):
- Перейменовано з "Кабінет менеджера"
- Тільки пошук + лічильник "Замовлення"
- 4 колонки: На комплектації, Готові до видачі, Повернення, Часткове повернення
- Прибрано: Виручка, Застави, фільтри Менеджер/Статус/Фінанси

**Менеджерська** (`/app/frontend/src/pages/ManagerCabinet.jsx`):
- KPI секція: Замовлення, Виручка ₴, Застави в холді
- Фільтри: Менеджер, Статус, Фінанси
- 2 колонки: Очікують підтвердження, Ордери в процесі

#### 4. ✅ Технічні виправлення
- WeasyPrint import → try-except обгортка (бекенд запускається без libpangoft2)
- TypeScript синтаксис в JSX → виправлено (function props)

---

### Session 9 - Estimate Template (February 16, 2026)

**Що було зроблено:**
1. ✅ Оновлено шаблон `quote.html` - новий детальний дизайн Кошторису
2. ✅ Backend логіка для нового шаблону
3. ✅ Дані компанії в футері
4. ✅ Зображення товарів
5. ✅ Сумісність з іншими документами

---

## Pending Issues

### P0 - Critical
- **NONE** (виправлено кнопку "Відправити на збір")

### P1 - High Priority
- `convert-to-order` endpoint стабільність
- Email шаблони для документів (Акт повернення, Дефектний акт)

### P2 - Medium Priority
- Moodboard export (ймовірно не працює)
- Calendar timezone bug
- Оптимізація API `/api/catalog` (занадто повільний для 5000+ товарів)

---

## Upcoming Tasks

1. **Мобільна адаптація FamiliesManager** (вкладка "Набори")
   - Код готовий, але потребує оптимізації API для швидшого завантаження
   
2. **Email шаблони документів**
   - Акт повернення
   - Дефектний акт
   - Потрібні приклади від користувача

---

## Future/Backlog Tasks

- Real-time оновлення кабінету клієнта
- Об'єднання NewOrderViewWorkspace та IssueCardWorkspace
- Повна система ролей (RBAC)
- Місячний фінансовий звіт
- HR/Ops Module

---

## Key Files Reference

### Frontend
- `/app/frontend/src/pages/CatalogBoard.jsx` - Каталог товарів (мобільно адаптований)
- `/app/frontend/src/pages/ManagerDashboard.jsx` - Реквізиторська
- `/app/frontend/src/pages/ManagerCabinet.jsx` - Менеджерська
- `/app/frontend/src/pages/NewOrderViewWorkspace.jsx` - Редагування замовлення
- `/app/frontend/src/components/catalog/FamiliesManager.jsx` - Розмірні сітки

### Backend
- `/app/backend/routes/catalog.py` - API каталогу
- `/app/backend/routes/documents.py` - Генерація документів
- `/app/backend/routes/orders.py` - Замовлення API
- `/app/backend/services/pdf_generator.py` - PDF (WeasyPrint optional)

---

## Credentials
- **Admin:** vitokdrako@gmail.com / test123
