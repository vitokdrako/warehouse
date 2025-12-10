# Rental Hub - Версія 20 - Production Deployment

## 📦 Що включено:

### Frontend (Static Build)
- **Папка:** `frontend/`
- **Тип:** React production build (статичні файли)
- **Розмір:** ~300KB (gzipped)
- **Файли:** index.html + static/js + static/css

### Backend (Python FastAPI)
- **Папка:** `backend/`
- **Тип:** FastAPI application
- **Python:** 3.9+
- **Dependencies:** requirements.txt

---

## 🎨 Що нового у версії 20:

### ✅ Корпоративний стиль FarforRent
- Primary: #b1cb29 (зелений)
- Gold: #C9A961 (золотий)
- Font: Montserrat
- "Powered by FarforRent" на Login + Dashboard

### ✅ P0: Laundry Management (Хімчистка)
- Управління текстилем у хімчистці
- Заморожування товарів
- Часткове повернення

### ✅ P1: Повна мобільна адаптація
- iOS оптимізація
- Touch-friendly UI
- Responsive design

### ✅ P2: User Tracking
- Захоплення created_by_id
- Історія змін

### ✅ P3: Internal Notes
- Система внутрішніх нотаток

### ✅ P4: Event Tool Integration
- Інтеграція з Event Planner

---

## 🚀 Deployment на ваш хостинг:

### Frontend (статика):
Ваша адреса фронту: **https://farforrent.com.ua** (або ваш домен)

1. Завантажте всі файли з папки `frontend/` на ваш веб-сервер
2. Вкажіть `index.html` як головну сторінку
3. Налаштуйте nginx/Apache для React Router (все на index.html)

**Nginx конфігурація:**
```nginx
location / {
    try_files $uri /index.html;
}
```

### Backend (Python API):
Ваша адреса API: **https://api.farforrent.com.ua** (або ваш API домен)

1. Завантажте папку `backend/` на сервер
2. Встановіть залежності: `pip install -r requirements.txt`
3. Створіть/оновіть `.env` файл з правильними URL:

**Backend .env (важливо!):**
```
# MySQL Database
RH_DB_HOST=farforre.mysql.tools
RH_DB_PORT=3306
RH_DB_DATABASE=farforre_rentalhub
RH_DB_USERNAME=farforre_rentalhub
RH_DB_PASSWORD=-nu+3Gp54L

# Frontend URL (для CORS)
FRONTEND_URL=https://farforrent.com.ua

# JWT Secret
JWT_SECRET_KEY=your-super-secret-key-here
```

4. Запустіть: `uvicorn server:app --host 0.0.0.0 --port 8001`

### Frontend .env (якщо потрібен rebuild):
```
REACT_APP_BACKEND_URL=https://api.farforrent.com.ua
```

**ВАЖЛИВО:** Якщо ви змінюєте URL backend, треба буде перебудувати frontend з правильним `REACT_APP_BACKEND_URL` в `.env`

---

## 📝 Структура файлів:

```
версія_20_deployment/
├── frontend/               # React production build (статика)
│   ├── index.html         # Головна сторінка
│   ├── static/
│   │   ├── js/           # JavaScript bundles
│   │   └── css/          # CSS styles
│   └── asset-manifest.json
│
└── backend/               # FastAPI application
    ├── server.py         # Головний файл
    ├── requirements.txt  # Python dependencies
    ├── routes/           # API endpoints
    ├── utils/            # Helpers
    ├── migrations/       # DB migrations
    └── .env             # Environment variables (створіть!)
```

---

## ✅ Чеклист перед deployment:

**Frontend:**
- [ ] Завантажити всі файли з `frontend/` на веб-сервер
- [ ] Налаштувати nginx/Apache для SPA
- [ ] Перевірити що index.html відкривається

**Backend:**
- [ ] Завантажити `backend/` на сервер
- [ ] Створити `.env` з правильними credentials
- [ ] `pip install -r requirements.txt`
- [ ] Запустити `uvicorn server:app --host 0.0.0.0 --port 8001`
- [ ] Перевірити `/docs` для Swagger API

**Database:**
- [ ] MySQL доступ працює (farforre.mysql.tools)
- [ ] Всі таблиці створені

**CORS:**
- [ ] Backend `.env` має правильний `FRONTEND_URL`
- [ ] CORS налаштований в `server.py`

---

## 🔗 API Endpoints структура:

- `/api/orders` - Замовлення
- `/api/laundry` - Хімчистка (НОВЕ!)
- `/api/issue-cards` - Видача
- `/api/return-cards` - Повернення
- `/api/finance` - Фінанси
- `/api/damages` - Пошкодження
- `/api/user-tracking` - User tracking (НОВЕ!)
- `/api/order-notes` - Нотатки (НОВЕ!)
- `/api/event-boards` - Event Tool (НОВЕ!)

---

## 📱 Мобільна версія:

Система повністю адаптована для мобільних:
- iOS/Android оптимізація
- Touch-friendly (44px targets)
- Responsive grid
- Theme color: #b1cb29

---

## 🎨 Корпоративні кольори:

```css
--corp-primary: #b1cb29      /* Зелений FarforRent */
--corp-gold: #C9A961         /* Золотий акцент */
--corp-text-dark: #2b292b    /* Темний текст */
--corp-text-main: #838182    /* Основний текст */
```

---

## 📞 Підтримка:

Якщо виникнуть питання:
1. Перевірте логи backend: `tail -f uvicorn.log`
2. Перевірте browser console для frontend
3. Перевірте MySQL connection

---

**Створено:** 10 грудня 2024
**Версія:** 20
**Стиль:** FarforRent Corporate Design

✅ Готово до deployment!
