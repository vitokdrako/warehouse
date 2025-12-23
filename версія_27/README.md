# RentalHub v27
## Система управління прокатом декору

### Конфігурація Production

**Frontend:** https://rentalhub.farforrent.com.ua
**Backend API:** https://backrentalhub.farforrent.com.ua

---

## Структура проекту

```
версія_27/
├── frontend/
│   ├── src/              # Вихідний код React
│   │   ├── pages/        # Сторінки додатку
│   │   ├── components/   # Компоненти
│   │   └── ...
│   ├── build/            # Скомпільований frontend (для деплою)
│   │   └── static/       # JS/CSS файли
│   ├── public/           # Статичні файли
│   ├── package.json      # Залежності
│   └── .env              # Налаштування (REACT_APP_BACKEND_URL)
│
└── backend/
    ├── routes/           # API endpoints
    ├── services/         # Бізнес-логіка
    ├── templates/        # HTML шаблони документів
    ├── server.py         # Головний файл FastAPI
    ├── requirements.txt  # Python залежності
    └── .env.example      # Приклад налаштувань
```

---

## Деплой Frontend

### Варіант 1: Статичний хостинг (рекомендовано)

Завантажте вміст папки `frontend/build/` на ваш хостинг (Nginx, Apache, Vercel, Netlify).

**Nginx конфігурація:**
```nginx
server {
    listen 80;
    server_name rentalhub.farforrent.com.ua;
    root /var/www/rentalhub/build;
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

### Варіант 2: Перебілд з новим URL

```bash
cd frontend
yarn install
yarn build
# Результат у папці build/
```

---

## Деплой Backend

### 1. Встановлення залежностей

```bash
cd backend
pip install -r requirements.txt
```

### 2. Налаштування .env

```bash
cp .env.example .env
# Відредагуйте .env з вашими налаштуваннями
```

### 3. Запуск

```bash
# Development
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Production (з Gunicorn)
gunicorn server:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8001
```

---

## Основні сторінки

| Сторінка | Шлях | Опис |
|----------|------|------|
| Dashboard | `/dashboard` | Головна панель |
| Каталог | `/catalog` | Каталог товарів з фільтрами |
| Календар | `/calendar` | Календар замовлень |
| Фінанси | `/finance` | Фінансова консоль |
| Шкода | `/damages` | Кабінет шкоди |
| Хімчистка | `/laundry` | Кабінет хімчистки |
| Адмін шаблони | `/admin/templates` | Редактор шаблонів документів |

---

## API Endpoints (основні)

### Авторизація
- `POST /api/auth/login` - Логін
- `POST /api/auth/register` - Реєстрація

### Замовлення
- `GET /api/orders` - Список замовлень
- `POST /api/orders` - Створити замовлення
- `GET /api/orders/{id}` - Деталі замовлення

### Каталог
- `GET /api/catalog/products-extended` - Розширений каталог
- `GET /api/catalog/filters` - Фільтри каталогу

### Фінанси
- `GET /api/finance/ledger` - Головна книга
- `GET /api/expense-management/templates` - Шаблони витрат
- `GET /api/expense-management/due-items` - Платежі до сплати

### Експорт
- `GET /api/export/ledger` - Експорт транзакцій CSV
- `GET /api/export/expenses` - Експорт витрат CSV
- `GET /api/export/damage-cases` - Експорт шкоди CSV

### Документи
- `POST /api/documents/generate` - Генерація документа
- `GET /api/admin/templates` - Список шаблонів

---

## Нові функції v27

1. ✅ **Експорт CSV** - Експорт даних в Excel/CSV для фінансів та шкоди
2. ✅ **Адмін шаблонів** - Редагування HTML шаблонів документів з превью
3. ✅ **Витрати** - Повна система управління витратами з шаблонами
4. ✅ **Каталог 3.0** - Оновлений каталог з вкладками (Товари/Набори/Сети)

---

## Контакти

**Розробка:** Emergent Labs
**Дата релізу:** 23.12.2025
