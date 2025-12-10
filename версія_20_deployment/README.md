# 🚀 RentalHub - Версія 20 (Production Build)

## 📦 Що в цій версії

### ✅ Нові функції:
1. **User Tracking System** - Повне відстеження дій користувачів
2. **Мобільна адаптація** - Календар та картки видачі оптимізовані для mobile
3. **Кабінет Шкоди (розширений)** - З інтеграцією мийки, реставрації та хімчистки
4. **Admin Cabinet Fix** - Виправлено 403 помилку на production

### 🔧 Технічні виправлення:
- Видалено всі хардкоджені URLs
- Виправлено AUTO_INCREMENT для orders
- Оптимізовано мобільний інтерфейс
- Покращено стабільність backend

---

## 🌐 Production URLs

**Frontend:** https://rentalhub.farforrent.com.ua  
**Backend:** https://backrentalhub.farforrent.com.ua

---

## 📁 Структура пакету

```
версія_20_deployment/
├── build/              # Скомпільований frontend (React)
│   ├── static/
│   ├── index.html
│   └── ...
├── backend/            # Backend source code (FastAPI)
│   ├── routes/
│   ├── database_rentalhub.py
│   ├── requirements.txt
│   └── server.py
└── README.md          # Ця інструкція
```

---

## 🚀 Інструкція з розгортання

### Frontend (Nginx)

1. **Скопіювати build на сервер:**
```bash
scp -r build/* user@server:/var/www/rentalhub.farforrent.com.ua/
```

2. **Налаштувати Nginx** (`/etc/nginx/sites-available/rentalhub`):
```nginx
server {
    listen 80;
    server_name rentalhub.farforrent.com.ua;
    
    root /var/www/rentalhub.farforrent.com.ua;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

3. **Перезапустити Nginx:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Backend (FastAPI)

1. **Скопіювати backend на сервер:**
```bash
scp -r backend/* user@server:/opt/rentalhub-backend/
```

2. **Встановити залежності:**
```bash
cd /opt/rentalhub-backend
pip install -r requirements.txt
```

3. **Налаштувати .env:**
```bash
MONGO_URL=mongodb://localhost:27017/rentalhub
PORT=8001
```

4. **Запустити через systemd** (`/etc/systemd/system/rentalhub-backend.service`):
```ini
[Unit]
Description=RentalHub Backend API
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/rentalhub-backend
Environment="PATH=/opt/rentalhub-backend/venv/bin"
ExecStart=/opt/rentalhub-backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
```

5. **Запустити сервіс:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable rentalhub-backend
sudo systemctl start rentalhub-backend
```

### Backend Nginx Proxy

```nginx
server {
    listen 80;
    server_name backrentalhub.farforrent.com.ua;
    
    location / {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🔐 SSL Сертифікати (Let's Encrypt)

```bash
# Frontend
sudo certbot --nginx -d rentalhub.farforrent.com.ua

# Backend
sudo certbot --nginx -d backrentalhub.farforrent.com.ua
```

---

## ✅ Перевірка після розгортання

### 1. Frontend:
```bash
curl https://rentalhub.farforrent.com.ua
# Повинен повернути HTML
```

### 2. Backend:
```bash
curl https://backrentalhub.farforrent.com.ua/api/health
# Повинен повернути {"status": "ok"}
```

### 3. Admin Panel:
- Відкрити: https://rentalhub.farforrent.com.ua/admin
- Перевірити чи завантажуються користувачі
- Перевірити чи немає 403 помилок

---

## 📊 База даних

**MongoDB:**
- База: `rentalhub`
- Нові таблиці/колонки:
  - `product_damage_history` - 7 нових колонок для processing
  - `issue_cards` - додано `created_by_id`
  - `return_cards` - додано `created_by_id`, `received_by_id`, `checked_by_id`

**Міграція не потрібна** - колонки додаються автоматично при першому запуску.

---

## 🔍 Відладка

### Frontend не завантажується:
```bash
# Перевірити логи Nginx
sudo tail -f /var/log/nginx/error.log

# Перевірити права доступу
sudo chown -R www-data:www-data /var/www/rentalhub.farforrent.com.ua
```

### Backend 403/500 помилки:
```bash
# Перевірити статус сервісу
sudo systemctl status rentalhub-backend

# Перевірити логи
sudo journalctl -u rentalhub-backend -f

# Перевірити MongoDB
mongosh --eval "db.adminCommand('ping')"
```

### Admin Panel не завантажує дані:
- Перевірити Network tab у DevTools
- Переконатися що CORS налаштовано правильно
- Перевірити токен автентифікації

---

## 📝 Що змінилося у версії 20

### User Tracking:
- Всі зміни у замовленнях тепер записують user_id
- Історія дій доступна через API

### Damage Cabinet:
- 4 вкладки: Головна, Мийка, Реставрація, Хімчистка
- Інтеграція з Laundry Cabinet
- Workflow обробки пошкоджень

### Mobile:
- Календар: адаптивні картки, скролінг
- Issue Card: мобільна версія з великими QR кодами

### Fixes:
- ✅ Видалено хардкоджені URLs
- ✅ Admin Cabinet тепер працює на production
- ✅ Виправлено order_id generation

---

## 📞 Підтримка

При виникненні проблем:
1. Перевірити логи (Nginx + Backend)
2. Перевірити .env налаштування
3. Перевірити MongoDB з'єднання
4. Перевірити SSL сертифікати

---

**Дата компіляції:** 10 грудня 2024  
**Версія:** 20  
**Compiled by:** E1 Agent
