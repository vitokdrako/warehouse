# RentalHub + Ivent-tool Project PRD

## Original Problem Statement
Enhance the "Damage Hub" and integrate "Ivent-tool" into RentalHub. Later focus shifted to Finance Hub optimization and restructuring, then to Documents Engine, and now to Client/Payer architecture and Document Workflow restructuring.

---

## Latest Update: February 16, 2026

### Bug Fix: Duplicate MA UI in ClientsTab - COMPLETE ✅ (Session 8)

**Проблема:** У drawer клієнта відображалися два блоки "Рамковий договір" — один на вкладці "Контакт" (правильний, client-level MA) і один на вкладці "Платники" (застаріла логіка, payer-level MA).

**Виправлення:**
1. ✅ Видалено дублюючий фрагмент коду (рядки 487-490)
2. ✅ Видалено використання неіснуючої змінної `payerMAs` в `payers.map()`
3. ✅ Блок MA тепер є тільки на вкладці "Контакт" (client-level)
4. ✅ Вкладка "Платники" показує тільки інформацію про платників без MA

**Тестування:** Backend 100% (11/11 тестів), Frontend візуально перевірено через скріншоти.

---

### Finance Hub Tab Restructuring - COMPLETE ✅

**Нова структура вкладок (8 вкладок):**

| # | Вкладка | Іконка | Роль |
|---|---------|--------|------|
| 1 | **Операції** | 💰 | ГОЛОВНА: ордери + ВСІ документи ордера |
| 2 | **Клієнти** | 👥 | CRM: клієнти + платники + Master Agreements |
| 3 | **Реєстр** | 📄 | READ-ONLY архів документів (пошук/фільтри) |
| 4 | **Каси** | 💵 | Готівкові операції |
| 5 | **Депозити** | 🔒 | Застави |
| 6 | **Витрати** | 📉 | Облік витрат |
| 7 | **Аналітика** | 📈 | Статистика |
| 8 | **План** | 📊 | План надходжень |

**Ключові зміни:**
- ❌ Видалено вкладку "Документи" як генератор
- ✅ Створено вкладку "Реєстр" (read-only архів)
- ✅ Документи ордера тепер в Операціях
- ✅ MA управління тільки в Клієнтах

---

### Вкладка "Операції" - Документи ордера

**Повний список документів:**
- 📄 Кошторис (Quote)
- 💵 Рахунок-оферта
- 📝 Договір оренди
- 📦 Акт видачі
- 📦 Акт повернення
- ⚠️ Дефектний акт
- 💰 Акт взаєморозрахунків

**Юр. особа / ФОП (потребують MA):**
- 📎 Додаток до договору (🔒 без MA)
- 📄 Рахунок (юр. особа)
- 📋 Акт виконаних робіт (🔒 без MA)

**Логіка:**
- Dropdown платників - тільки пов'язані з клієнтом ордера
- Annex/Act заблоковані якщо немає підписаного MA
- CTA посилання на вкладку "Клієнти" для підписання MA

---

### Вкладка "Реєстр" - Архів документів

**Функціонал:**
- 🔍 Пошук по номеру/платнику
- 📊 Фільтри: тип (Рамкові/Додатки/Рахунки/Акти), статус (Чернетка/Підписано/Закінчився)
- 📈 Статистика: загальна кількість, по типах, підписані
- ⚠️ Банер-нагадування: "Генерація документів в Операціях/Клієнтах"

**Жодних кнопок "Створити"!**

---

## Architecture

### Client/Payer Model
- **Client** = Contact (`client_users` table)
- **Payer** = Legal entity (`payer_profiles` table)
- **Link** = `client_payer_links` (many-to-many)
- **Order** links to both client and payer

### Document Hierarchy
1. **Master Agreement (MA)** → linked to `client_users` (creates in Clients tab on "Контакт" sub-tab)
2. **Order Annex** → linked to `order` AND `master_agreement` (creates in Operations)
3. **Acts/Invoices** → linked to `order`, require signed MA for legal entities

**NEW Client-Centric Model:**
- MA прив'язується до клієнта (`client_users.active_master_agreement_id`), а не до платника
- Платники (`payer_profiles`) — тільки біллінгові сутності
- Один клієнт = один активний MA

---

## Completed in Session 8
- ✅ Bug fix: Duplicate MA UI removed from ClientsTab
- ✅ Code cleanup: Removed unused `payerMAs` variable
- ✅ Test report: /app/test_reports/iteration_8.json

## Pending Issues (P1-P2)
- **P1:** `convert-to-order` endpoint unstable (needs testing after refactoring)
- **P2:** Moodboard export likely broken
- **P2:** Calendar timezone bug

## Future Tasks
- Real-time updates for client cabinet
- Unify NewOrderViewWorkspace and IssueCardWorkspace
- Full RBAC implementation
- Monthly Financial Report
- HR/Ops Module

---

## API Endpoints

### Master Agreements
- `GET /api/agreements` - List all
- `GET /api/agreements/active/{payer_id}` - Get active MA for payer
- `POST /api/agreements/create` - Create new draft
- `POST /api/agreements/{id}/sign` - Sign and activate

### Order Payer
- `GET /api/orders/{order_id}/payer-options` - List payers for order's client
- `POST /api/orders/{order_id}/set-payer` - Set payer for order

### Registry
- `GET /api/annexes` - List annexes

---

## Test Reports
- `/app/test_reports/iteration_8.json` - Bug fix verification: Backend 100% (11/11), MA duplication fixed
- `/app/test_reports/iteration_7.json` - MA APIs: 16/16 tests passed

## Credentials
- Admin: `vitokdrako@gmail.com` / `test123`
