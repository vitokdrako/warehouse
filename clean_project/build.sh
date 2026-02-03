#!/bin/bash
# ===========================================
# RentalHub Build Script
# ===========================================

echo "🔨 Компіляція RentalHub Frontend..."
echo ""

# Перехід в папку frontend_src
cd /app/clean_project/frontend_src

# Компіляція з правильним URL
echo "📦 Building with REACT_APP_BACKEND_URL=https://backrentalhub.farforrent.com.ua"
REACT_APP_BACKEND_URL=https://backrentalhub.farforrent.com.ua yarn build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build успішний!"
    
    # Копіювання результату
    echo "📁 Копіюю в frontend_build/..."
    rm -rf /app/clean_project/frontend_build/*
    cp -r build/* /app/clean_project/frontend_build/
    
    echo ""
    echo "=========================================="
    echo "  ✅ ГОТОВО ДО ДЕПЛОЮ!"
    echo "=========================================="
    echo ""
    echo "Frontend build: /app/clean_project/frontend_build/"
    echo "Backend:        /app/clean_project/backend/"
    echo ""
    echo "Розмір build:"
    du -sh /app/clean_project/frontend_build/
else
    echo ""
    echo "❌ Build failed!"
    exit 1
fi
