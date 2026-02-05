# 🚨 СТРОГА ІНСТРУКЦІЯ ЗБІРКИ ТА ДЕПЛОЮ - FARFORRENT

> **УВАГА!** Цей документ є обов'язковим для прочитання перед будь-якими змінами в проекті.
> Недотримання інструкцій призведе до поломки production!

---

## 📁 СТРУКТУРА ПРОЕКТУ

```
/app/clean_project/
│
├── 📋 BUILD_INSTRUCTIONS.md   # ← ЦЕЙ ФАЙЛ! Читати першим!
├── 📋 PRD.md                  # Архітектура та вимоги
├── 📋 README.md               # Загальний опис
│
├── 🔧 backend/                # FastAPI бекенд (ОДИН на всі фронтенди!)
│   ├── server.py              # Головний файл - всі роутери тут
│   ├── database.py            # OpenCart DB connection
│   ├── database_rentalhub.py  # RentalHub DB connection (ОСНОВНА!)
│   ├── routes/                # API роутери
│   │   ├── orders.py          # Замовлення
│   │   ├── catalog.py         # Каталог товарів
│   │   ├── product_damage_history.py  # Damage Hub
│   │   ├── laundry.py         # Хімчистка
│   │   ├── event_tool.py      # 🆕 Event Tool API для декораторів
│   │   └── ...                # Інші роутери
│   └── .env.example           # Приклад credentials
│
├── 🎨 frontend_admin_src/     # SRC: React адмінка
│   ├── src/                   # Сорси
│   ├── public/                # Статичні файли
│   ├── package.json           # Залежності
│   └── .env.example           # REACT_APP_BACKEND_URL
│
├── 🎨 frontend/               # BUILD: Готовий білд адмінки
│   └── build/                 # → rentalhub.farforrent.com.ua
│
├── 🎪 front_event_tool_src/   # SRC: React каталог декораторів
│   ├── src/                   # Сорси
│   │   └── api/               # ⚠️ Всі шляхи з /event/ prefix!
│   ├── public/                # Статичні файли
│   ├── package.json           # Залежності
│   └── .env.example           # REACT_APP_BACKEND_URL
│
├── 🎪 front_event_tool/       # BUILD: Готовий білд каталогу
│   └── (build files)          # → events.farforrent.com.ua
│
└── 📦 backups/                # Резервні копії
```

---

## 🌐 PRODUCTION ДОМЕНИ

| Домен | Що там | Порт |
|-------|--------|------|
| `rentalhub.farforrent.com.ua` | Адмінка (React) | 443 (nginx) |
| `events.farforrent.com.ua` | Каталог декораторів (React) | 443 (nginx) |
| `backrentalhub.farforrent.com.ua` | FastAPI бекенд | 8001 |

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│  rentalhub.farforrent.com.ua│     │  events.farforrent.com.ua   │
│        (Адмінка)            │     │     (Каталог декораторів)   │
└──────────────┬──────────────┘     └──────────────┬──────────────┘
               │                                    │
               └──────────────┬─────────────────────┘
                              │
                              ▼
               ┌──────────────────────────────┐
               │ backrentalhub.farforrent.com.ua │
               │         FastAPI :8001         │
               │                               │
               │  /api/orders/*    ← адмінка  │
               │  /api/catalog/*   ← обидва   │
               │  /api/event/*     ← каталог  │
               └──────────────────────────────┘
                              │
                              ▼
               ┌──────────────────────────────┐
               │   farforre_rentalhub (MySQL) │
               └──────────────────────────────┘
```

---

## 🔧 ЗБІРКА БЕКЕНДУ

### Крок 1: Перевірка server.py

**ОБОВ'ЯЗКОВО** перевірити що всі роутери підключені в `/app/clean_project/backend/server.py`:

```python
# Імпорти роутерів (рядок ~15)
from routes import ..., event_tool, ...

# Підключення роутерів (рядок ~90+)
app.include_router(event_tool.router, prefix="/api")  # Event Tool API
```

### Крок 2: Перевірка CORS

В `server.py` перевірити що CORS дозволяє всі потрібні домени:

```python
default_origins = [
    "https://rentalhub.farforrent.com.ua",
    "https://events.farforrent.com.ua",
    "https://backrentalhub.farforrent.com.ua",
    "http://localhost:3000",
    "http://localhost:3001",
]
```

### Крок 3: .env на сервері

```env
# RentalHub Database
RH_DB_HOST=farforre.mysql.tools
RH_DB_PORT=3306
RH_DB_DATABASE=farforre_rentalhub
RH_DB_USERNAME=farforre_rentalhub
RH_DB_PASSWORD=<PASSWORD>

# CORS - ВСІ домени в ОДНОМУ рядку!
CORS_ORIGINS=https://rentalhub.farforrent.com.ua,https://events.farforrent.com.ua

# JWT
JWT_SECRET_KEY=<SECRET>
```

### Крок 4: Деплой бекенду

```bash
# На сервері
cd /path/to/backend
pip install -r requirements.txt
sudo systemctl restart rentalhub-backend
# або
pm2 restart backend
```

---

## 🎨 ЗБІРКА ФРОНТЕНДУ АДМІНКИ

### Крок 1: .env для build

```bash
cd /app/frontend
echo "REACT_APP_BACKEND_URL=https://backrentalhub.farforrent.com.ua" > .env
```

### Крок 2: Build

```bash
yarn install
yarn build
```

### Крок 3: Результат

```
/app/frontend/build/ → копіювати на сервер → rentalhub.farforrent.com.ua
```

---

## 🎪 ЗБІРКА ФРОНТЕНДУ EVENT TOOL (Каталог декораторів)

### ⚠️ КРИТИЧНО: API Prefix

Event Tool використовує **ОКРЕМИЙ prefix** `/api/event/*`!

**Файли API (в `/app/evetnsnew/frontend/src/api/`):**

| Файл | Правильний шлях |
|------|-----------------|
| `auth.js` | `/event/auth/login`, `/event/auth/register`, `/event/auth/me` |
| `boards.js` | `/event/boards`, `/event/boards/{id}`, `/event/boards/{id}/items` |
| `products.js` | `/event/products`, `/event/products/{id}` |
| `categories.js` | `/event/categories`, `/event/subcategories` |

**❌ НЕПРАВИЛЬНО:**
```javascript
api.post('/auth/login', data)  // Це піде на RentalHub auth!
```

**✅ ПРАВИЛЬНО:**
```javascript
api.post('/event/auth/login', data)  // Це піде на Event Tool auth
```

### Крок 1: .env для build

```bash
cd /app/evetnsnew/frontend
echo "REACT_APP_BACKEND_URL=https://backrentalhub.farforrent.com.ua" > .env
```

### Крок 2: Build

```bash
yarn install
yarn build
```

### Крок 3: Результат

```
/app/evetnsnew/frontend/build/ → копіювати на сервер → events.farforrent.com.ua
```

---

## 🗄️ БАЗИ ДАНИХ

### OpenCart DB (тільки для синхронізації)
- Host: `farforre.mysql.tools`
- Database: `farforre_db`
- Prefix: `oc_`
- **Використання:** Тільки читання orders та products для синхронізації

### RentalHub DB (ОСНОВНА!)
- Host: `farforre.mysql.tools`
- Database: `farforre_rentalhub`
- **Використання:** ВСЯ бізнес-логіка

### Таблиці Event Tool (в RentalHub DB)
```sql
-- Створюються автоматично при першому запиті
event_customers        -- Декоратори (email, password, etc)
event_boards          -- Мудборди
event_board_items     -- Товари в мудбордах
event_soft_reservations -- Тимчасові резервації
```

---

## 🔐 API ENDPOINTS

### RentalHub (Адмінка)
| Prefix | Опис |
|--------|------|
| `/api/orders/*` | Замовлення |
| `/api/catalog/*` | Каталог |
| `/api/product-damage-history/*` | Damage Hub |
| `/api/laundry/*` | Хімчистка |
| `/api/auth/*` | Авторизація адмінки |

### Event Tool (Каталог декораторів)
| Prefix | Опис |
|--------|------|
| `/api/event/auth/*` | Авторизація декораторів |
| `/api/event/products/*` | Каталог для декораторів |
| `/api/event/categories/*` | Категорії |
| `/api/event/boards/*` | Мудборди |
| `/api/event/boards/{id}/convert-to-order` | Конвертація в замовлення |

---

## ⚡ ШВИДКІ КОМАНДИ

### Локальна розробка
```bash
# Бекенд
cd /app/backend && sudo supervisorctl restart backend

# Фронт адмінки
cd /app/frontend && yarn start

# Перевірка логів
tail -f /var/log/supervisor/backend.err.log
```

### Тестування API
```bash
# Health check Event Tool
curl https://backrentalhub.farforrent.com.ua/api/event/health

# Логін декоратора
curl -X POST https://backrentalhub.farforrent.com.ua/api/event/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123"}'
```

---

## 🚫 ЗАБОРОНЕНО

1. **НЕ ВИДАЛЯТИ** файли з `/app/clean_project/` без backup
2. **НЕ ЗМІНЮВАТИ** порти (бекенд = 8001)
3. **НЕ КОМІТИТИ** `.env` файли з паролями
4. **НЕ ВИКОРИСТОВУВАТИ** `CORS_ORIGINS=*` на production
5. **НЕ ПЛУТАТИ** `/api/auth/*` (адмінка) з `/api/event/auth/*` (декоратори)
6. **НЕ ПЕРЕЗАПИСУВАТИ** `server.py` без перевірки всіх роутерів

---

## ✅ ЧЕКЛИСТ ПЕРЕД ДЕПЛОЄМ

- [ ] CORS містить всі потрібні домени
- [ ] `.env` на сервері має правильні credentials
- [ ] `event_tool.py` підключений в `server.py`
- [ ] Фронт Event Tool використовує `/event/*` prefix в API
- [ ] Build фронтендів має правильний `REACT_APP_BACKEND_URL`
- [ ] Бекенд запущений і `/api/event/health` відповідає

---

## 📞 КОНТАКТИ

- **Мова спілкування:** Українська
- **Власник:** vitokdrako@gmail.com
- **Production URL:** https://rentalhub.farforrent.com.ua

---

*Останнє оновлення: 5 лютого 2026*
*Автор: E1 Agent*
