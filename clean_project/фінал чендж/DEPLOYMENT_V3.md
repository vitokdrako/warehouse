# DEPLOYMENT v3: Клієнтська база + Рахунки

## Дата: 2026-03-11

---

## Крок 1: БЕКАП (обов'язково!)

```bash
# На production сервері
mysqldump farforre_rentalhub > backup_before_v3_$(date +%Y%m%d_%H%M).sql
```

---

## Крок 2: SQL Міграція

Виконати `MIGRATION_V3_CLIENTS.sql` на production базі `farforre_rentalhub`:

```bash
mysql -u farforre -p farforre_rentalhub < MIGRATION_V3_CLIENTS.sql
```

Що робить:
- Додає нові колонки в `client_users` (is_regular, company, rating, internal_notes, instagram)
- Заповнює total_revenue та last_order_date з orders
- Імпортує клієнтів з orders яких ще немає в client_users

---

## Крок 3: Оновлення бекенд файлів

Замінити на `/home/farforre/farforrent.com.ua/rentalhub/backend/`:

```bash
# Основні файли
cp backend_update/routes/clients.py    /home/farforre/.../backend/routes/
cp backend_update/routes/documents.py  /home/farforre/.../backend/routes/

# Нові шаблони документів
cp backend_update/templates/documents/invoice_payment.html  /home/farforre/.../backend/templates/documents/
cp backend_update/templates/documents/service_act.html      /home/farforre/.../backend/templates/documents/
```

---

## Крок 4: Оновлення фронтенду

Замінити вміст фронтенд директорії:

```bash
cp -r frontend_build/* /home/farforre/.../frontend/build/
```

---

## Крок 5: Перезапуск

```bash
sudo systemctl restart gunicorn
# або
sudo supervisorctl restart backend
```

---

## Перевірка після деплою

1. **Клієнти** — зайти в Менеджерську → Клієнти → має показати список
2. **Рахунок** — відкрити замовлення Христини Мулярчук → секція Рахунки → має показати "ФОП Мельник" та 2 опції
3. **Генерація** — натиснути "Рахунок на оплату (ФОП)" → відкриється рахунок з правильними реквізитами

---

## Нові файли

| Файл | Опис |
|------|------|
| `routes/clients.py` | CRM поля: is_regular, company, rating, internal_notes, instagram |
| `routes/documents.py` | + invoice-payment, service-act, available-invoices ендпоінти |
| `templates/documents/invoice_payment.html` | Шаблон "Рахунок на оплату" |
| `templates/documents/service_act.html` | Шаблон "Акт надання послуг" |

---

## При проблемах

```bash
# Логи
tail -f /var/log/supervisor/backend.err.log

# Відкат SQL (якщо потрібно)
ALTER TABLE client_users DROP COLUMN IF EXISTS is_regular;
ALTER TABLE client_users DROP COLUMN IF EXISTS company;
ALTER TABLE client_users DROP COLUMN IF EXISTS rating;
ALTER TABLE client_users DROP COLUMN IF EXISTS rating_labels;
ALTER TABLE client_users DROP COLUMN IF EXISTS internal_notes;
ALTER TABLE client_users DROP COLUMN IF EXISTS instagram;
```
