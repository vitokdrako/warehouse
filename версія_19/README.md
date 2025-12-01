# 📦 RENTALHUB ВЕРСІЯ 19

**Дата створення:** 2025-12-01  
**Статус:** Production Ready ✅

---

## 📂 СТРУКТУРА ПАПКИ

```
версія_19/
├── backend/                    # Повний бекенд (8.0 MB)
│   ├── routes/                 # API routes
│   ├── models/                 # Database models
│   ├── database_*.py           # Database connections
│   ├── server.py               # FastAPI server
│   ├── requirements.txt        # Python dependencies
│   ├── migrations/             # SQL міграції
│   ├── sync_all_production.py # Синхронізація з OpenCart
│   ├── migrate_images_from_opencart.py  # Міграція зображень
│   └── ...
│
├── frontend_build/             # Скомпільований frontend (5.0 MB)
│   ├── index.html              # Головна сторінка
│   ├── static/                 # JS/CSS файли
│   │   ├── js/
│   │   └── css/
│   └── asset-manifest.json     # Manifest файлів
│
└── README.md                   # Цей файл
```

---

## 🚀 ЩО ВКЛЮЧЕНО В ЦЮ ВЕРСІЮ

### ✅ ВИПРАВЛЕННЯ:

1. **Календар:**
   - Видалено старий календар
   - Підключено новий з drag-and-drop
   - Route: `/calendar`

2. **Дашборд:**
   - Повернення показуються за ВСІ дати
   - Без фільтру по "тільки сьогодні"

3. **Синхронізація:**
   - Виправлено маппінг цін (price ↔ rental_price)
   - Оновлено ліміти (200/10000/50)
   - Файл: `sync_all_production.py`

4. **Міграція зображень:**
   - Скрипт для міграції фото з OpenCart
   - Progress bar та моніторинг
   - Файли: `migrate_images_from_opencart.py`, `check_migration_status.sh`

5. **Event Tool Integration:**
   - Повна документація інтеграції
   - SQL міграції готові
   - План покрокової інтеграції

6. **Виправлення orders.py:**
   - Підтримка нового формату з 15 колонками
   - Правильний parse для rental_days, total_loss_value

---

## 📋 DEPLOY НА PRODUCTION

### Backend:

```bash
# 1. Зупинити поточний backend
sudo supervisorctl stop rentalhub-backend

# 2. Backup поточної версії
cd /home/farforre/farforrent.com.ua/rentalhub
mv backend backend_old_$(date +%Y%m%d)

# 3. Копіювати новий backend
cp -r /шлях/до/версія_19/backend /home/farforre/farforrent.com.ua/rentalhub/

# 4. Перевірити .env
cat backend/.env
# Має бути:
# CORS_ORIGINS=https://rentalhub.farforrent.com.ua,https://events.farforrent.com.ua

# 5. Встановити залежності (якщо потрібно)
cd backend
pip install -r requirements.txt

# 6. Запустити backend
sudo supervisorctl start rentalhub-backend

# 7. Перевірити логи
sudo supervisorctl tail -f rentalhub-backend
```

### Frontend:

```bash
# 1. Backup поточного frontend
cd /home/farforre/farforrent.com.ua/rentalhub/frontend
mv build build_old_$(date +%Y%m%d)

# 2. Копіювати новий build
cp -r /шлях/до/версія_19/frontend_build /home/farforre/farforrent.com.ua/rentalhub/frontend/build

# 3. Перевірити що файли на місці
ls -la build/
```

---

## 🔧 НАЛАШТУВАННЯ СЕРЕДОВИЩА

### Backend .env (production):

```bash
# Database
DB_HOST=farforre.mysql.tools
DB_DATABASE=farforre_rentalhub
DB_USERNAME=farforre_rentalhub
DB_PASSWORD=-nu+3Gp54L

# CORS
CORS_ORIGINS=https://rentalhub.farforrent.com.ua,https://events.farforrent.com.ua

# OpenCart DB (для синхронізації)
OC_DB_HOST=farforre.mysql.tools
OC_DB_DATABASE=farforre_db
OC_DB_USERNAME=farforre_db
OC_DB_PASSWORD=gPpAHTvv
```

### Frontend .env (використовується при build):

```bash
REACT_APP_BACKEND_URL=https://backrentalhub.farforrent.com.ua
```

---

## 📊 CRON ЗАДАЧІ

### 1. Синхронізація даних з OpenCart (кожні 15 хвилин):

```bash
*/15 * * * * cd /home/farforre/farforrent.com.ua/rentalhub/backend && /opt/alt/python311/bin/python3.11 sync_all_production.py >> /home/farforre/sync.log 2>&1
```

### 2. Міграція зображень (щодня о 3:00):

```bash
0 3 * * * cd /home/farforre/farforrent.com.ua/rentalhub/backend && /opt/alt/python311/bin/python3.11 migrate_images_from_opencart.py >> /home/farforre/image_migration.log 2>&1
```

---

## ✅ ПЕРЕВІРКА ПІСЛЯ DEPLOY

### 1. Backend:
```bash
# Перевірити що працює
curl https://backrentalhub.farforrent.com.ua/api/health

# Перевірити CORS
curl -I https://backrentalhub.farforrent.com.ua/api/decor-orders?status=processing

# Має бути header:
# access-control-allow-origin: https://rentalhub.farforrent.com.ua
```

### 2. Frontend:
```bash
# Перевірити сайт
https://rentalhub.farforrent.com.ua

# Перевірити календар
https://rentalhub.farforrent.com.ua/calendar

# Не має бути /calendar-old
```

### 3. Дашборд:
- Зайти на https://rentalhub.farforrent.com.ua/manager
- Перевірити що повернення показуються за всі дати
- Перевірити що календар новий (з drag-and-drop)

---

## 📝 ВАЖЛИВІ ФАЙЛИ

### Backend:
- `server.py` - головний файл FastAPI
- `routes/orders.py` - логіка замовлень (ВИПРАВЛЕНО)
- `sync_all_production.py` - синхронізація (ВИПРАВЛЕНО)
- `migrate_images_from_opencart.py` - міграція фото (НОВИЙ)

### Frontend:
- `build/index.html` - головна сторінка
- `build/static/js/main.*.js` - скомпільований JS
- `build/static/css/main.*.css` - стилі

---

## 🐛 TROUBLESHOOTING

### Backend не запускається:
```bash
# Перевірити логи
tail -f /var/log/supervisor/rentalhub-backend.err.log

# Перевірити залежності
cd backend && pip list | grep -i fastapi

# Перевірити порт
netstat -tuln | grep 8001
```

### Frontend не завантажується:
```bash
# Перевірити nginx
sudo nginx -t
sudo systemctl status nginx

# Перевірити файли
ls -la /home/farforre/farforrent.com.ua/rentalhub/frontend/build/
```

### CORS помилки:
```bash
# Перевірити .env
grep CORS /home/farforre/farforrent.com.ua/rentalhub/backend/.env

# Має бути:
# CORS_ORIGINS=https://rentalhub.farforrent.com.ua,https://events.farforrent.com.ua
```

---

## 📚 ДОКУМЕНТАЦІЯ

В цій версії також є:

- `/app/EVENT_TOOL_INTEGRATION_ANALYSIS.md` - аналіз інтеграції Event Tool
- `/app/EVENT_TOOL_INTEGRATION_TODO.md` - покроковий план
- `/app/IMAGE_MIGRATION_INSTRUCTIONS.md` - інструкції міграції фото
- `/app/CALENDAR_DASHBOARD_FIXES.md` - що виправлено в календарі/дашборді

---

## 🔐 CREDENTIALS

**MySQL RentalHub DB:**
- Host: farforre.mysql.tools
- Database: farforre_rentalhub
- User: farforre_rentalhub
- Password: -nu+3Gp54L

**MySQL OpenCart DB:**
- Host: farforre.mysql.tools
- Database: farforre_db
- User: farforre_db
- Password: gPpAHTvv

**Manager Login:**
- Email: vitokdrako@gmail.com
- Password: test123

---

## 📊 СТАТИСТИКА

- **Backend:** 8.0 MB (Python, FastAPI)
- **Frontend:** 5.0 MB (React, TypeScript)
- **Total:** 13.0 MB
- **Files:** ~500+ files

---

**Версія готова до production deploy! 🚀**
