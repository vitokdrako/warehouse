# RentalHub версія 27

## Оновлення
- Виправлено реквізити компанії у всіх документах: "ФОП Арсалані Олександра Ігорівна"
- Генерація документів з правильними юридичними даними

## Структура

```
версія_27/
├── backend/           # FastAPI backend
│   ├── routes/        # API endpoints
│   ├── services/      # Business logic
│   └── .env           # Production config (НАЛАШТУЙТЕ!)
├── frontend/
│   ├── src/           # React source code
│   ├── build/         # Скомпільований frontend (готовий до deployment)
│   └── .env           # Production config
└── README.md
```

## URL конфігурація

- **Frontend:** https://rentalhub.farforrent.com.ua
- **Backend:** https://backrentalhub.farforrent.com.ua

## Deployment

### Frontend
Папка `frontend/build/` містить скомпільовані статичні файли.
Розмістіть на сервері та налаштуйте nginx для SPA.

### Backend
1. Налаштуйте `backend/.env` з реальними credentials
2. Встановіть залежності: `pip install -r requirements.txt`
3. Запустіть: `uvicorn server:app --host 0.0.0.0 --port 8001`

## Дата компіляції
23.12.2025
