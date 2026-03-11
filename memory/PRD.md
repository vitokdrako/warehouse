# RentalHub PRD

## Продукт
Система управління орендою декору — бекофіс з менеджерським кабінетом, каталогом, кабінетом шкоди, касою.

## Архітектура
- **Frontend:** React (CRA) + Tailwind CSS
- **Backend:** FastAPI + MySQL (external farforre.mysql.tools)
- **Дві БД:** farforre_db (OpenCart), farforre_rentalhub (RentalHub)
- **Deploy model:** manual — backend .py → clean_project/backend_update/, frontend build → clean_project/frontend_build/

## Реалізовано (Березень 2026)

### Кабінет Шкоди (DamageHubApp)
- Пошук по SKU/назві через API
- Додавання товарів з кількістю в черги (wash/restoration/laundry)
- Часткові повернення (batch + individual)
- frozen_quantity логіка виправлена

### Оптимізація системи (11.03.2026)
- **product_damage_history** — єдине джерело істини для стану обробки
- `orders.py` → пише в PDH замість `product_cleaning_status`
- `return_cards.py` → пише в PDH замість `damages`+`damage_items`
- `catalog.py` → restoration читає з PDH замість `product_cleaning_status`
- `product_cleaning.py` → повністю переписаний на PDH
- `damage_cases.py` → пише тільки в PDH
- Уніфікація `washing` → `wash` (БД + бекенд + фронтенд)

### Фінансова оптимізація (11.03.2026)
- `orders.py` → fin_transactions замість finance_transactions
- `user_tracking.py` → fin_transactions замість finance_transactions
- Каса (/kasa) вбудована в менеджерський кабінет як вкладка
- /finance (FinanceHub) → redirect на /manager-cabinet

### Очистка
- Видалено 8 порожніх таблиць (customers, inventory, etc.)
- Видалено 14 backup/old файлів бекенду

## Менеджерський кабінет (/manager-cabinet)
3 вкладки:
1. **Замовлення** — 3 колонки + KPI
2. **Клієнти** — ClientsTab (документація, історія замовлень)
3. **Каса** — KasaPage embedded (дохід/депозити/витрати)

## Тестова база
- `farforre_laravell` на farforre.mysql.tools — копія production для безпечного тестування

## Бекенд файли для deploy
`/app/clean_project/backend_update/routes/`:
- orders.py, return_cards.py, catalog.py, product_cleaning.py
- product_damage_history.py, laundry.py, damage_cases.py, user_tracking.py

## Міграційний скрипт
`/app/clean_project/MIGRATION_SCRIPT.sql`

## Credentials
- Admin: `vitokdrako@gmail.com` / `test123`

## Backlog (P1)
- Виправити FamiliesManager.jsx (повільний Catalog API)
- Оптимізація Catalog API (N+1 queries)
- Місячне закриття каси
- Клієнти: документація + історія замовлень

## Backlog (P2)
- convert-to-order стабільність
- Moodboard export
- Timezone bug в календарі
- Email шаблони
- Real-time оновлення
- Уніфікація workspaces
- RBAC
