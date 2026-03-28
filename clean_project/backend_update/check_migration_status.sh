#!/bin/bash
# Швидка перевірка статусу міграції зображень

LOG_FILE="/home/farforre/image_migration.log"

# Якщо лог файл не існує
if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Лог файл не знайдено: $LOG_FILE"
    echo "Міграція ще не запускалась або інший шлях до логу."
    exit 1
fi

# Перевірити чи процес працює
PROCESS=$(ps aux | grep -v grep | grep "migrate_images_from_opencart.py")

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           📊 СТАТУС МІГРАЦІЇ ЗОБРАЖЕНЬ                   ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Статус процесу
if [ -n "$PROCESS" ]; then
    echo "🟢 Статус: ПРАЦЮЄ"
    PID=$(echo "$PROCESS" | awk '{print $2}')
    echo "   PID: $PID"
else
    echo "⚪ Статус: НЕ ПРАЦЮЄ"
    echo "   Останній запуск був:"
    tail -n 100 "$LOG_FILE" | grep "Started:" | tail -1 | sed 's/.*Started: /   /'
fi

echo ""
echo "───────────────────────────────────────────────────────────"

# Підрахунки
TOTAL=$(tail -n 1000 "$LOG_FILE" | grep "Found" | grep "products with images" | tail -1 | grep -oP '\d+' | head -1)
SUCCESS=$(grep -c "✅ Updated DB" "$LOG_FILE")
FAILED=$(grep -c "❌" "$LOG_FILE")

if [ -z "$TOTAL" ]; then
    TOTAL="N/A"
    PERCENT="N/A"
else
    if [ "$TOTAL" -gt 0 ]; then
        PERCENT=$(awk "BEGIN {printf \"%.1f\", ($SUCCESS / $TOTAL) * 100}")
    else
        PERCENT="0.0"
    fi
fi

echo "📦 Всього товарів:  $TOTAL"
echo "✅ Успішно:         $SUCCESS"
echo "❌ Помилки:         $FAILED"
echo "📈 Прогрес:         $PERCENT%"

echo ""
echo "───────────────────────────────────────────────────────────"

# Файли на диску
PRODUCTS_DIR="/home/farforre/farforrent.com.ua/rentalhub/backend/uploads/products"
if [ -d "$PRODUCTS_DIR" ]; then
    FILES_COUNT=$(find "$PRODUCTS_DIR" -maxdepth 1 -type f \( -name "*.jpg" -o -name "*.png" -o -name "*.jpeg" -o -name "*.webp" \) 2>/dev/null | wc -l)
    SIZE=$(du -sh "$PRODUCTS_DIR" 2>/dev/null | cut -f1)
    echo "💾 Файлів на диску: $FILES_COUNT"
    echo "📊 Розмір:          $SIZE"
else
    echo "⚠️  Директорія не знайдена: $PRODUCTS_DIR"
fi

echo ""
echo "───────────────────────────────────────────────────────────"
echo "📝 Останні 5 рядків логу:"
echo ""
tail -n 5 "$LOG_FILE" | sed 's/^/   /'

echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "💡 Команди для моніторингу:"
echo "   tail -f $LOG_FILE          # Дивитись в реальному часі"
echo "   bash $(basename "$0")                      # Оновити статус"
echo ""
