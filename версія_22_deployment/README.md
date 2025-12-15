# Версія 22 - RentalHub Deployment

## Зміни в версії 22:
- ✅ Уніфікована архітектура Order Workspace для всіх типів замовлень
- ✅ Нові компоненти: NewOrderCleanWorkspace, NewOrderViewWorkspace, IssueCardWorkspace, ReturnOrderWorkspace, ArchivedOrderWorkspace
- ✅ 22 zone-компоненти для модульної побудови інтерфейсу
- ✅ Виправлено баги: неправильна ціна, оновлення кількості, 405 помилка
- ✅ Додано вибір комплектувальників (реквізиторів)
- ✅ Додано 4-й вид пакування (чорний кейс)
- ✅ Видалено старі компоненти

## Структура

### Frontend (rentalhub.farforrent.com.ua)
```
frontend/
├── index.html
├── asset-manifest.json
└── static/
    ├── js/
    └── css/
```

**Налаштування:**
- Backend URL: https://backrentalhub.farforrent.com.ua (вбудовано в білд)

### Backend (backrentalhub.farforrent.com.ua)
```
backend/
├── server.py              # Головний файл FastAPI
├── requirements.txt       # Залежності Python
├── database_rentalhub.py  # З'єднання з MySQL
├── routes/                # API роути
│   ├── orders.py
│   ├── admin.py
│   ├── inventory.py
│   └── ...
├── models.py              # Pydantic моделі
└── .env.example           # Приклад конфігурації
```

## Деплой Frontend

1. Скопіювати вміст `frontend/` в root веб-сервера
2. Налаштувати nginx для SPA:
```nginx
server {
    listen 80;
    server_name rentalhub.farforrent.com.ua;
    root /var/www/rentalhub;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /static {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Деплой Backend

1. Скопіювати вміст `backend/` на сервер
2. Створити `.env` на основі `.env.example`
3. Встановити залежності:
```bash
pip install -r requirements.txt
```
4. Запустити:
```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

Або через systemd/supervisor.

## CORS

Backend налаштований приймати запити з:
- https://rentalhub.farforrent.com.ua

---
Дата збірки: 2024-12-15
