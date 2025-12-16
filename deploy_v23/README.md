# RentalHub Deploy v23 - Finance Cabinet

## © FarforDecorOrenda 2025

## 🗓️ Дата релізу: 2025-12-16

## 📦 Структура:
```
deploy_v23/
├── frontend/          # Static files для rentalhub.farforrent.com.ua
│   ├── index.html
│   └── static/
│       ├── css/
│       └── js/
├── backend/           # FastAPI сервер для backrentalhub.farforrent.com.ua
│   ├── server.py
│   ├── routes/
│   ├── services/
│   └── ...
└── README.md
```

## 🔧 Конфігурація URL:
- **Frontend**: https://rentalhub.farforrent.com.ua
- **Backend API**: https://backrentalhub.farforrent.com.ua

## ✨ Нові функції v23:

### Finance Cabinet (/finance)
1. **Огляд** - 7 фінансових метрик (прибуток, оренда, шкоди, застави, витрати)
2. **Замовлення** - реальні дані з БД (24+ записів), форми оплат
3. **Застави з валютою** - перемикач UAH/USD/EUR з курсами
4. **Журнал** - double-entry ledger транзакції
5. **Витрати** - список, категорії, додавання
6. **ЗП (Зарплата)** - співробітники, нарахування, виплати
7. **Підрядники** - компанії, контакти, баланси

### Backend API (/api/finance)
- GET /api/finance/dashboard
- GET /api/finance/ledger
- GET /api/finance/payments
- GET /api/finance/expenses
- GET /api/finance/deposits
- POST /api/finance/deposits/create (з валютою)
- GET /api/finance/employees
- POST /api/finance/employees
- GET /api/finance/payroll
- POST /api/finance/payroll
- POST /api/finance/payroll/{id}/pay
- GET /api/finance/vendors
- POST /api/finance/vendors

## 🚀 Деплой:

### Frontend (Nginx):
```nginx
server {
    listen 80;
    server_name rentalhub.farforrent.com.ua;
    root /var/www/rentalhub/frontend;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Backend (Gunicorn/Uvicorn):
```bash
cd /var/www/rentalhub/backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```

## 📋 База даних:
- MySQL (rentalhub) - основна БД
- Нові таблиці: rh_employees, hr_payroll, fin_vendors (оновлені)
- Виконати міграцію: POST /api/finance/migrate-tables

## 📝 Зміни від v22:
- Додано Finance Cabinet UI
- Підтримка валют для застав
- Модуль Зарплати (ЗП)
- Модуль Підрядників
- Інтеграція з реальними даними замовлень

## 📋 Після деплою:
1. Виконати міграцію таблиць: `POST /api/finance/migrate-tables`
2. Перезапустити backend сервер

## 📜 Правові документи:
- Умови оренди: https://www.farforrent.com.ua/terms
- Оферта: https://www.farforrent.com.ua/oferta
- Політика конфіденційності: https://www.farforrent.com.ua/privacy
- Опис збитків: https://www.farforrent.com.ua/opis-zbitkiv

## 🏢 Компанія:
- **Назва**: FarforDecorOrenda
- **Юр. особа**: ФОП Арсалані Олександра Ігорівна
- **ІПН**: 3234423422
- **Адреса**: 61082, Харківська обл., місто Харків, ПРОСПЕКТ МОСКОВСЬКИЙ, будинок 216/3А
- **Склад**: Військовий провулок 1
- **Email**: rfarfordecor@gmail.com.ua

## 💼 Умови оренди (з офіційних документів):
- **Мін. замовлення**: 2000 грн
- **Знижка 10%**: від 30 000 грн
- **Застава**: 50% від повної вартості можливого збитку
- **Термінове замовлення (<24 год)**: +30%
- **Передоплата**: 50%, решта при поверненні
- **Робочі години**: пн-пт 10:00-18:00, видача пн-сб 10:00-17:00
- **Штраф за прострочення**: 0.5% за кожен день

**Без архівів — всі файли видимі для GitHub!**
