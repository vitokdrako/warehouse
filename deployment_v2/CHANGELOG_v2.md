# RentalHub Deployment v2 - Changelog

## Зміни в цій версії:

### 1. Sync скрипт (`sync_production.py`)
- ✅ Додано синхронізацію SKU (артикулів) з OpenCart
- ✅ `color` та `material` більше НЕ перезаписуються при синхронізації

### 2. Фото пошкоджень (`routes/product_damage_history.py`)
- ✅ Виправлено шлях збереження фото на production
- ✅ Фото зберігаються у: `/home/farforre/.../backend/uploads/damage_photos/`

### 3. Новий роут (`routes/uploads.py`)
- ✅ API для віддачі завантажених файлів через `/api/uploads/`
- ✅ `/api/uploads/damage_photos/{filename}` - фото пошкоджень
- ✅ `/api/uploads/products/{filename}` - фото товарів

### 4. Генерація документів (`services/doc_engine/data_builders.py`)
- ✅ Виправлено шляхи до фото для production
- ✅ Фото в документах тепер відображаються коректно

### 5. Server.py
- ✅ Додано `uploads` роутер

## Інструкція оновлення:

1. Скопіюйте файли `backend/` в `/home/farforre/farforrent.com.ua/rentalhub/backend/`
2. Скопіюйте файли `frontend_build/` в `/home/farforre/farforrent.com.ua/rentalhub/frontend/build/`
3. Перезапустіть backend: `sudo systemctl restart rentalhub-backend`
