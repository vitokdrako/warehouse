# RentalHub v26 Deploy

## Frontend (rentalhub.farforrent.com.ua)
Скопіюйте вміст папки `frontend/` в корінь веб-сервера:
```
scp -r frontend/* user@server:/var/www/rentalhub/
```

Nginx конфігурація:
```nginx
server {
    listen 80;
    server_name rentalhub.farforrent.com.ua;
    root /var/www/rentalhub;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Backend (backrentalhub.farforrent.com.ua)
1. Скопіюйте папку `backend/` на сервер
2. Створіть `.env` файл на основі `.env.example`
3. Встановіть залежності: `pip install -r requirements.txt`
4. Запустіть: `uvicorn server:app --host 0.0.0.0 --port 8000`

Systemd service:
```ini
[Unit]
Description=RentalHub Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/backend
ExecStart=/usr/bin/python3 -m uvicorn server:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

## Зміни в v26:
- ✅ Фінансова аналітика (/analytics)
- ✅ Версіонування документів (Генерувати/Перегляд/Історія)
- ✅ Шкоди у фінансовому кабінеті з автозаповненням
- ✅ Поле "кількість" у модалці пошкоджень
