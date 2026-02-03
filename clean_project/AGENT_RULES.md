# 🚨 ПРАВИЛА РОБОТИ З ПРОЕКТОМ RENTALHUB

## ⚠️ ВАЖЛИВО ДЛЯ ВСІХ АГЕНТІВ

### 1. РОБОЧА ПАПКА
**Працюємо ТІЛЬКИ з `/app/clean_project/`**

```
/app/clean_project/
├── backend/              ← Серверний код
├── frontend_src/         ← Вихідний код фронтенду
├── frontend_build/       ← Скомпільований фронтенд (для деплою)
└── docs/                 ← Документація
```

**❌ НЕ ЧІПАТИ:**
- `/app/backend/` (стара папка)
- `/app/frontend/` (стара папка)
- `/app/версія_*/`, `/app/deploy_*/` (застарілі)

---

### 2. КОМПІЛЯЦІЯ ФРОНТЕНДУ

При змінах у фронтенді **ЗАВЖДИ** виконувати:

```bash
# 1. Перейти в папку з вихідним кодом
cd /app/clean_project/frontend_src

# 2. Компілювати з правильним URL бекенду
REACT_APP_BACKEND_URL=https://backrentalhub.farforrent.com.ua yarn build

# 3. Скопіювати результат
rm -rf /app/clean_project/frontend_build/*
cp -r build/* /app/clean_project/frontend_build/
```

**URL продакшену:**
- Backend: `https://backrentalhub.farforrent.com.ua`
- Frontend: `https://rentalhub.farforrent.com.ua`

---

### 3. ЗМІНИ В БЕКЕНДІ

При змінах у бекенді редагувати файли в:
```
/app/clean_project/backend/
├── server.py
├── routes/*.py
├── services/
└── utils/
```

---

### 4. СТРУКТУРА ДЕПЛОЮ

Користувач копіює на продакшн:

**Backend** → `backrentalhub.farforrent.com.ua`
```
/app/clean_project/backend/ → весь вміст
```

**Frontend** → `rentalhub.farforrent.com.ua`
```
/app/clean_project/frontend_build/ → весь вміст (index.html, static/)
```

---

### 5. БАЗИ ДАНИХ

**OpenCart DB** (товари, замовлення):
- Host: `farforre.mysql.tools`
- Database: `farforre_opencart`

**RentalHub DB** (фінанси, issue_cards):
- Host: `farforre.mysql.tools`
- Database: `farforre_rentalhub`
- User: `farforre_rentalhub`
- Pass: `-nu+3Gp54L`

---

### 6. ТЕСТУВАННЯ

Для тестування API використовувати:
```bash
source /app/clean_project/frontend_src/.env
curl -s "$REACT_APP_BACKEND_URL/api/..."
```

---

### 7. ШВИДКИЙ СКРИПТ КОМПІЛЯЦІЇ

Використовувати `/app/clean_project/build.sh`:
```bash
./build.sh
```

---

## 📋 ЧЕКЛИСТ ПЕРЕД ДЕПЛОЄМ

- [ ] Зміни зроблені в `/app/clean_project/`
- [ ] Frontend скомпільований з правильним URL
- [ ] Build скопійований в `frontend_build/`
- [ ] Протестовано локально
- [ ] Готово до пушу на GitHub
