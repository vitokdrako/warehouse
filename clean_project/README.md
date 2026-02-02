# RentalHub - Чиста версія проекту

## Структура

```
clean_project/
├── backend/                 # Серверна частина (FastAPI + Python)
│   ├── server.py           # Головний файл сервера
│   ├── database.py         # Підключення до OpenCart DB
│   ├── database_rentalhub.py # Підключення до RentalHub DB
│   ├── models.py           # Pydantic моделі
│   ├── finance_rules.py    # Правила фінансів
│   ├── pdf_generator.py    # Генерація PDF
│   ├── requirements.txt    # Python залежності
│   ├── .env                # Конфігурація (НЕ КОМІТИТИ!)
│   ├── routes/             # API endpoints (52 файли)
│   ├── services/           # Бізнес-логіка
│   ├── utils/              # Допоміжні функції
│   └── templates/          # Шаблони документів (Jinja2)
│
├── frontend_src/           # Вихідний код фронтенду (React + TypeScript)
│   ├── package.json        # NPM залежності
│   ├── yarn.lock           # Lock-файл
│   ├── tsconfig.json       # TypeScript конфіг
│   ├── tailwind.config.js  # Tailwind CSS конфіг
│   ├── .env                # Конфігурація фронтенду
│   ├── src/                # Вихідний код
│   │   ├── App.tsx         # Головний компонент
│   │   ├── pages/          # Сторінки (22 файли)
│   │   ├── components/     # UI компоненти
│   │   ├── hooks/          # React хуки
│   │   ├── services/       # API сервіси
│   │   └── utils/          # Допоміжні функції
│   └── public/             # Статичні файли
│
├── frontend_build/         # Скомпільований фронтенд (для деплою)
│   ├── index.html
│   └── static/
│       ├── js/             # JavaScript бандли
│       └── css/            # CSS стилі
│
└── docs/                   # Документація
```

## Бази даних

1. **OpenCart DB** (farforre_opencart) - Основна база для товарів, замовлень
2. **RentalHub DB** (farforre_rentalhub) - Нова база для фінансів, issue_cards, return_cards

## Конфігурація

### Backend (.env)
```
# OpenCart DB
OC_DB_HOST=farforre.mysql.tools
OC_DB_NAME=farforre_opencart
OC_DB_USER=...
OC_DB_PASS=...

# RentalHub DB
RH_DB_HOST=farforre.mysql.tools
RH_DB_DATABASE=farforre_rentalhub
RH_DB_USERNAME=...
RH_DB_PASSWORD=...
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://backrentalhub.farforrent.com.ua
```

## Деплой

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```

### Frontend (з вихідного коду)
```bash
cd frontend_src
yarn install
yarn build
# Результат у build/
```

### Frontend (скомпільований)
Просто скопіюйте вміст `frontend_build/` на веб-сервер.

## Основні модулі

### Фінанси
- Оренда, застава, шкода, прострочення
- Знижки (записуються при видачі)
- Фін кабінет - джерело правди

### Замовлення
- Статуси: awaiting → processing → issued → returned
- Issue Cards - картки видачі
- Return Cards - картки повернення
- Часткове повернення

### Календар
- Видачі/повернення
- Завдання
- Шкода
- Прострочення

## Дата створення
2 лютого 2026

## Розмір
- Backend routes: 52 файли
- Frontend pages: 22 файли
- Build: ~5 MB
