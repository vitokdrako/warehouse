# 💼 Фінансовий Кабінет (FinanceHub) - Повний Воркфлоу

## 📌 Огляд

**Фінансовий кабінет** — це центральний інструмент для управління фінансами компанії з прокату декору. Розташований у файлі `/frontend/src/pages/FinanceHub.jsx` та використовує бекенд `/backend/routes/finance.py`.

**URL:** `https://rentalhub.farforrent.com.ua/finance`

---

## 🗂️ Структура вкладок

| # | ID | Назва | Опис |
|---|---|---|---|
| 1 | `operations` | 💰 Операції | Головна — список замовлень з фінансами |
| 2 | `documents` | 📄 Документи | Генерація договорів, додатків, актів |
| 3 | `cash` | 💵 Каси | Баланси готівкової та безготівкової кас |
| 4 | `forecast` | 📊 План надходжень | Прогноз платежів від клієнтів |
| 5 | `expenses` | 📉 Витрати | Облік операційних витрат |
| 6 | `deposits` | 🔒 Депозити | Управління заставами клієнтів |
| 7 | `analytics` | 📈 Аналітика | Фінансова звітність та графіки |
| 8 | `clients` | 👥 Клієнти | CRM-lite: клієнти та платники |

---

## 🏗️ Архітектура даних

### База даних (MySQL)

```
┌─────────────────────────────────────────────────────────────────┐
│                        ОСНОВНІ ТАБЛИЦІ                          │
├─────────────────────────────────────────────────────────────────┤
│ orders              - Замовлення на прокат                      │
│ client_users        - Клієнти (контактні особи)                 │
│ payer_profiles      - Платники (юридичні/фіз особи)             │
│ client_payer_links  - Зв'язок клієнтів з платниками             │
├─────────────────────────────────────────────────────────────────┤
│                      ФІНАНСОВІ ТАБЛИЦІ                          │
├─────────────────────────────────────────────────────────────────┤
│ fin_payments        - Платежі (оренда, застава, шкода)          │
│ fin_deposit_holds   - Утримані застави                          │
│ fin_expenses        - Витрати компанії                          │
│ fin_accounts        - Рахунки (каси)                            │
│ fin_ledger_entries  - Журнал подвійної бухгалтерії              │
│ fin_transactions    - Транзакції                                │
│ fin_vendors         - Постачальники                             │
├─────────────────────────────────────────────────────────────────┤
│                       HR ТАБЛИЦІ                                │
├─────────────────────────────────────────────────────────────────┤
│ rh_employees        - Співробітники                             │
│ hr_payroll          - Зарплатні відомості                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Детальний воркфлоу кожної вкладки

---

### 1. 💰 Операції (Operations)

**Мета:** Перегляд всіх замовлень з їх фінансовим станом, запис платежів.

#### API Endpoints:
```
GET  /api/manager/finance/orders-with-finance?limit=100
GET  /api/finance/orders/{orderId}/snapshot
POST /api/finance/payments
```

#### Воркфлоу:
```
┌──────────────────────────────────────────────────────────────────┐
│                    ЗАВАНТАЖЕННЯ ДАНИХ                            │
├──────────────────────────────────────────────────────────────────┤
│ 1. Frontend викликає /api/manager/finance/orders-with-finance    │
│ 2. Backend повертає список замовлень з:                          │
│    - order_id, order_number, customer_name                       │
│    - total_rental (сума оренди)                                  │
│    - total_deposit (сума застави)                                │
│    - rent_paid (оплачено за оренду)                              │
│    - deposit_held (утримана застава)                             │
│    - damage_total, damage_paid, damage_due (шкода)               │
│ 3. Список відображається в таблиці зліва                         │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    ВИБІР ЗАМОВЛЕННЯ                              │
├──────────────────────────────────────────────────────────────────┤
│ 1. Клік на рядок → selectedOrderId встановлюється                │
│ 2. Викликається /api/finance/orders/{orderId}/snapshot           │
│ 3. Справа відкривається панель з детальною інформацією:          │
│    - Статус платежу (оплачено/частково/не оплачено)              │
│    - Сума до сплати                                              │
│    - Історія платежів                                            │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    ЗАПИС ПЛАТЕЖУ                                 │
├──────────────────────────────────────────────────────────────────┤
│ 1. Вибрати тип платежу: rent / deposit / damage                  │
│ 2. Вибрати метод: cash / bank / use_deposit                      │
│ 3. Ввести суму                                                   │
│ 4. POST /api/finance/payments                                    │
│    {                                                             │
│      "order_id": 7329,                                           │
│      "payment_type": "rent",                                     │
│      "method": "cash",                                           │
│      "amount": 5000                                              │
│    }                                                             │
│ 5. Backend записує в fin_payments + fin_ledger_entries           │
│ 6. Оновлюються баланси кас                                       │
└──────────────────────────────────────────────────────────────────┘
```

#### Структура таблиці fin_payments:
```sql
CREATE TABLE fin_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    payment_type ENUM('rent', 'deposit', 'damage'),
    method ENUM('cash', 'bank', 'use_deposit'),
    amount DECIMAL(12,2),
    payer_name VARCHAR(200),
    payer_contact VARCHAR(100),
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 2. 📄 Документи (Documents)

**Мета:** Генерація юридичних документів для замовлень.

#### API Endpoints:
```
GET  /api/documents/policy/available?order_id={id}
GET  /api/agreements
POST /api/agreements/create
GET  /api/annexes?order_id={id}
POST /api/annexes/generate-for-order/{orderId}
POST /api/documents/generate
```

#### Типи документів:
| Код | Назва | Потребує платника? |
|-----|-------|-------------------|
| `quote` | Комерційна пропозиція | ❌ |
| `invoice_offer` | Рахунок-оферта | ❌ |
| `master_agreement` | Генеральний договір | ✅ |
| `annex` | Додаток до договору | ✅ |
| `service_act` | Акт наданих послуг | ✅ |
| `damage_claim` | Претензія по шкоді | ✅ |

#### Policy Matrix (логіка доступності):
```javascript
// Документи доступні тільки якщо є payer_profile_id
if (!order.payer_profile_id) {
  // Доступні тільки: quote, invoice_offer
  // Недоступні: master_agreement, annex, service_act
}
```

#### Воркфлоу генерації:
```
1. Вибрати замовлення
2. GET /api/documents/policy/available?order_id={id}
   → Повертає список доступних типів документів
3. Вибрати тип документа
4. POST /api/documents/generate
   {
     "order_id": 7329,
     "doc_type": "annex",
     "payer_id": 3
   }
5. Backend генерує PDF з шаблону
6. Повертається URL для завантаження
```

---

### 3. 💵 Каси (Cash)

**Мета:** Перегляд балансів готівкової та безготівкової кас.

#### API Endpoints:
```
GET /api/finance/payouts-stats-v2
```

#### Структура відповіді:
```json
{
  "rent_cash": {
    "income": 125000,
    "expenses": 45000,
    "deposits": 5000,
    "balance": 85000
  },
  "rent_bank": {
    "income": 80000,
    "expenses": 20000,
    "balance": 60000
  },
  "damage_cash": {
    "income": 15000,
    "expenses": 8000,
    "balance": 7000
  },
  "total_damage_collected": 15000
}
```

#### Логіка розрахунку:
```
rent_cash_balance = rent_cash_income - rent_cash_expenses + rent_cash_deposits
damage_cash_balance = damage_cash_income - damage_cash_expenses + damage_cash_deposits
```

---

### 4. 📊 План надходжень (Forecast)

**Мета:** Прогноз майбутніх платежів на основі активних замовлень.

#### Воркфлоу:
```
1. Аналізує замовлення зі статусом != "completed"
2. Рахує суми до оплати:
   - Оренда: total_rental - rent_paid
   - Застава: total_deposit - deposit_held
3. Групує по тижнях/місяцях
4. Відображає календар очікуваних платежів
```

---

### 5. 📉 Витрати (Expenses)

**Мета:** Облік операційних витрат компанії.

#### API Endpoints:
```
GET  /api/finance/expenses/all?limit=200
POST /api/finance/expenses/simple
```

#### Категорії витрат:
```javascript
const EXPENSE_CATEGORIES = [
  { code: "TRANSPORT", label: "Транспорт" },
  { code: "REPAIRS", label: "Ремонт обладнання" },
  { code: "CLEANING", label: "Хімчистка/прання" },
  { code: "PACKAGING", label: "Пакування" },
  { code: "OFFICE", label: "Офіс" },
  { code: "SALARY", label: "Зарплата" },
  { code: "OTHER", label: "Інше" }
];
```

#### Воркфлоу запису витрати:
```
1. Вибрати категорію
2. Ввести суму та опис
3. Вибрати бюджет: rent / damage
4. Вибрати метод оплати: cash / bank
5. POST /api/finance/expenses/simple
   {
     "category_code": "TRANSPORT",
     "amount": 500,
     "budget": "rent",
     "method": "cash",
     "description": "Доставка на захід"
   }
6. Backend створює запис в fin_expenses
7. Оновлюється баланс відповідної каси
```

#### Структура таблиці fin_expenses:
```sql
CREATE TABLE fin_expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_code VARCHAR(50),
    expense_type VARCHAR(50),
    amount DECIMAL(12,2),
    budget ENUM('rent', 'damage'),
    method ENUM('cash', 'bank'),
    description TEXT,
    vendor_id INT,
    order_id INT,
    tx_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 6. 🔒 Депозити (Deposits)

**Мета:** Управління заставами клієнтів.

#### API Endpoints:
```
GET  /api/finance/deposits
POST /api/finance/deposits/create
POST /api/finance/deposits/{id}/use?amount={amount}
POST /api/finance/deposits/{id}/refund?amount={amount}&method={method}
```

#### Статуси депозитів:
| Статус | Опис |
|--------|------|
| `held` | Утримана (активна) |
| `partially_used` | Частково використана |
| `used` | Повністю використана |
| `refunded` | Повернена |

#### Воркфлоу депозиту:
```
┌────────────────────────────────────────────────────────────────┐
│                 ЖИТТЄВИЙ ЦИКЛ ДЕПОЗИТУ                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  [Клієнт вносить заставу]                                      │
│           │                                                    │
│           ▼                                                    │
│  ┌─────────────────┐                                           │
│  │   held (5000)   │  ← Застава утримана                       │
│  └────────┬────────┘                                           │
│           │                                                    │
│     ┌─────┴─────┐                                              │
│     │           │                                              │
│     ▼           ▼                                              │
│  [Шкода]    [Без шкоди]                                        │
│     │           │                                              │
│     ▼           ▼                                              │
│  ┌─────────┐  ┌─────────┐                                      │
│  │  use    │  │ refund  │                                      │
│  │ (2000)  │  │ (5000)  │                                      │
│  └────┬────┘  └────┬────┘                                      │
│       │            │                                           │
│       ▼            ▼                                           │
│  partially_used  refunded                                      │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────┐                                                   │
│  │ refund  │ ← Повернення залишку                              │
│  │ (3000)  │                                                   │
│  └─────────┘                                                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### Структура таблиці fin_deposit_holds:
```sql
CREATE TABLE fin_deposit_holds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    held_amount DECIMAL(12,2) DEFAULT 0,
    used_amount DECIMAL(12,2) DEFAULT 0,
    refunded_amount DECIMAL(12,2) DEFAULT 0,
    status ENUM('held', 'partially_used', 'used', 'refunded'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

### 7. 📈 Аналітика (Analytics)

**Мета:** Фінансова звітність та візуалізація.

#### Метрики:
- Загальний дохід за період
- Середній чек
- Кількість замовлень
- Рейтинг клієнтів за виручкою
- Графік доходів по місяцях
- Порівняння з попереднім періодом

---

### 8. 👥 Клієнти (CRM Lite)

**Мета:** Управління клієнтами та їх платіжними профілями.

#### API Endpoints:
```
GET    /api/clients                     - Список клієнтів
GET    /api/clients/{id}                - Деталі клієнта
POST   /api/clients                     - Створити клієнта
PATCH  /api/clients/{id}                - Оновити клієнта
GET    /api/clients/{id}/payers         - Платники клієнта
POST   /api/clients/{id}/payers/{pid}/link   - Прив'язати платника
DELETE /api/clients/{id}/payers/{pid}/unlink - Відв'язати платника

GET    /api/payer-profiles              - Список платників
POST   /api/payer-profiles              - Створити платника
PATCH  /api/payer-profiles/{id}         - Оновити платника
```

#### Модель даних Client-Payer:
```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  client_users   │     │  client_payer_links  │     │ payer_profiles  │
├─────────────────┤     ├──────────────────────┤     ├─────────────────┤
│ id              │◄────┤ client_user_id       │     │ id              │
│ email           │     │ payer_profile_id     │────►│ type            │
│ email_normalized│     │ is_default           │     │ display_name    │
│ full_name       │     │ created_at           │     │ tax_mode        │
│ phone           │     └──────────────────────┘     │ legal_name      │
│ source          │                                  │ edrpou          │
│ created_at      │                                  │ iban            │
└─────────────────┘                                  │ bank_name       │
                                                     │ address         │
                                                     │ signatory_name  │
                                                     │ signatory_basis │
                                                     └─────────────────┘
```

#### Типи платників:
| Type | Label | Документи |
|------|-------|-----------|
| `individual` | Фізична особа | quote, invoice_offer |
| `fop` | ФОП | + master_agreement, annex, service_act |
| `company` | ТОВ/ПП | + master_agreement, annex, service_act |
| `foreign` | Нерезидент | quote, invoice_offer |
| `pending` | Буде уточнено | quote |

#### Режими оподаткування (tax_mode):
| Mode | Опис | ПДВ |
|------|------|-----|
| `none` | Фіз особа | ❌ |
| `simplified` | Спрощена система | ❌ |
| `general` | Загальна система | ❌ |
| `vat` | Платник ПДВ | ✅ |

#### Воркфлоу створення платника:
```
1. Відкрити вкладку "Клієнти"
2. Знайти клієнта в списку
3. Натиснути "+ Платник"
4. Заповнити форму:
   - Тип: individual/fop/company
   - Назва для відображення
   - Режим оподаткування
   - Юридична назва
   - ЄДРПОУ/ІПН
   - IBAN
   - Банк
   - Адреса
   - Підписант
5. POST /api/payer-profiles
6. POST /api/clients/{clientId}/payers/{payerId}/link
7. Платник прив'язаний до клієнта
```

---

## 🔗 Зв'язки з замовленнями

```
┌─────────────┐
│   orders    │
├─────────────┤
│ order_id    │
│ ...         │
│ client_user_id ────────────► client_users.id
│ payer_profile_id ──────────► payer_profiles.id
│ payer_snapshot_json ───────► JSON копія платника на момент замовлення
└─────────────┘
```

#### Навіщо payer_snapshot_json?
Якщо платник змінить реквізити після створення замовлення, в документах повинні залишитись старі дані. Тому при прив'язці платника до замовлення зберігається JSON-копія.

---

## 📊 Повний ланцюг даних

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         ПОТІК ДАНИХ                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [Клієнт робить замовлення]                                              │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────┐                                                 │
│  │      orders         │ ← order_id, customer_name, total_price          │
│  └──────────┬──────────┘                                                 │
│             │                                                            │
│    ┌────────┼────────┐                                                   │
│    │        │        │                                                   │
│    ▼        ▼        ▼                                                   │
│ [Оплата] [Застава] [Шкода]                                               │
│    │        │        │                                                   │
│    ▼        ▼        ▼                                                   │
│ ┌──────┐ ┌───────────────┐ ┌───────────────────┐                         │
│ │ fin_ │ │ fin_deposit_  │ │ product_damage_   │                         │
│ │paymts│ │ holds         │ │ history           │                         │
│ └──┬───┘ └───────┬───────┘ └─────────┬─────────┘                         │
│    │             │                   │                                   │
│    └─────────────┼───────────────────┘                                   │
│                  │                                                       │
│                  ▼                                                       │
│         ┌────────────────┐                                               │
│         │ fin_ledger_    │ ← Подвійна бухгалтерія                        │
│         │ entries        │                                               │
│         └────────┬───────┘                                               │
│                  │                                                       │
│                  ▼                                                       │
│         ┌────────────────┐                                               │
│         │ fin_accounts   │ ← Баланси кас                                 │
│         │ (cash/bank)    │                                               │
│         └────────────────┘                                               │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Файлова структура

```
/frontend/src/
├── pages/
│   └── FinanceHub.jsx           # Головний компонент фін.кабінету
├── components/
│   ├── ClientsTab.jsx           # Вкладка "Клієнти"
│   ├── OrderFinancePanel.jsx    # Панель фінансів замовлення
│   ├── ExpensesTab.jsx          # Вкладка "Витрати"
│   ├── DepositsTab.jsx          # Вкладка "Депозити"
│   ├── AnalyticsTab.jsx         # Вкладка "Аналітика"
│   └── ForecastTab.jsx          # Вкладка "План надходжень"

/backend/routes/
├── finance.py                   # Основні фінансові API
├── clients.py                   # API клієнтів
├── payer_profiles.py            # API платників
├── documents.py                 # Генерація документів
├── document_policy.py           # Логіка доступності документів
└── orders.py                    # API замовлень
```

---

## ✅ Підсумок

Фінансовий кабінет RentalHub забезпечує:

1. **Повний облік платежів** — оренда, застави, шкода
2. **Управління касами** — готівка та безготівка окремо
3. **CRM-lite функціонал** — клієнти та їх платники
4. **Генерація документів** — з врахуванням типу платника
5. **Подвійна бухгалтерія** — через ledger entries
6. **Облік витрат** — категоризовані витрати з різних бюджетів
7. **Аналітика** — звітність та прогнозування

---

*Документ створено: 13.02.2026*
*Версія: 1.0*
