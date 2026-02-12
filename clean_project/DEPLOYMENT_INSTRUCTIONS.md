# 🚀 DEPLOYMENT ІНСТРУКЦІЯ - EventTool Convert-to-Order Fix

## Дата: 12 лютого 2026

---

## 📦 Файли для заміни на production

### Backend файли (замінити на `/home/farforre/farforrent.com.ua/rentalhub/backend/`):

1. **server.py** - виправлений CORS (використовує CORS_ORIGINS з .env правильно)
2. **routes/event_tool.py** - виправлений convert-to-order:
   - Детальне логування помилок
   - IT- нумерація починається з 10000
   - source='event_tool' для трекінгу
   - error handling з trace_id
3. **routes/migrations.py** - нова міграція event-tool-orders
4. **services/email_provider.py** - SMTP email provider

---

## ⚙️ Конфігурація .env

Переконайтесь що `/home/farforre/farforrent.com.ua/rentalhub/backend/.env` містить:

```env
# CORS - всі домени!
CORS_ORIGINS=https://rentalhub.farforrent.com.ua,https://www.rentalhub.farforrent.com.ua,https://events.farforrent.com.ua

# SMTP (вже налаштовано)
SMTP_HOST=mail.adm.tools
SMTP_PORT=465
SMTP_USERNAME=info@farforrent.com.ua
SMTP_PASSWORD=Reveron2468
SMTP_USE_SSL=True
SMTP_FROM_EMAIL=info@farforrent.com.ua
SMTP_FROM_NAME=FarforRent
```

---

## 🔧 Після заміни файлів

1. **Запустити міграцію** (одноразово):
```bash
curl -X POST https://backrentalhub.farforrent.com.ua/api/migrations/event-tool-orders
```

Очікувана відповідь:
```json
{
  "success": true,
  "migration": "event-tool-orders",
  "results": ["orders.source: ...", "orders.event_board_id: ..."]
}
```

2. **Перезапустити backend**:
```bash
sudo systemctl restart gunicorn
# або
sudo supervisorctl restart backend
```

---

## ✅ Перевірка

1. **CORS preflight**:
```bash
curl -I -X OPTIONS https://backrentalhub.farforrent.com.ua/api/event/boards/test/convert-to-order \
  -H "Origin: https://events.farforrent.com.ua" \
  -H "Access-Control-Request-Method: POST"
```
Має бути: `Access-Control-Allow-Origin: https://events.farforrent.com.ua`

2. **Тест на events.farforrent.com.ua**:
   - Зайти в каталог
   - Додати товари в мудборд
   - Встановити дати оренди
   - Натиснути "Оформити замовлення"
   - Заповнити форму
   - Має створитись замовлення IT-10000+

---

## 📝 Що було виправлено

### CORS:
- server.py тепер правильно читає CORS_ORIGINS з .env
- Додає credentials: true для авторизованих запитів

### convert-to-order endpoint:
- Замінено небезпечну індексацію board[14] на dict
- Додано try-except з trace_id для дебагу
- IT- нумерація: окремий лічильник, старт з 10000
- Записується source='event_tool' та event_board_id

### Email:
- SMTPEmailProvider автоматично визначається якщо SMTP_HOST налаштований
- Повний audit log (provider, email_id, status)

---

## 🆘 При проблемах

Логи:
```bash
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/backend.out.log
```

Trace ID з помилки 500 → шукати в логах.
