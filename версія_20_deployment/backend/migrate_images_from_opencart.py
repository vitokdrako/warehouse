#!/usr/bin/env python3
"""
Міграція зображень товарів з OpenCart в RentalHub
Скачує оригінальні фото з OpenCart та завантажує через RentalHub uploader
"""
import mysql.connector
import requests
from PIL import Image
from io import BytesIO
import os
import time
import shutil
from pathlib import Path
import logging

# Налаштування логування
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Database configurations
OC = {
    'host': 'farforre.mysql.tools',
    'database': 'farforre_db',
    'user': 'farforre_db',
    'password': 'gPpAHTvv',
    'charset': 'utf8mb4'
}

RH = {
    'host': 'farforre.mysql.tools',
    'database': 'farforre_rentalhub',
    'user': 'farforre_rentalhub',
    'password': '-nu+3Gp54L',
    'charset': 'utf8mb4'
}

# OpenCart image base URL
OPENCART_IMAGE_BASE = "https://www.farforrent.com.ua/image/"

# Local paths (буде автоматично визначено production або dev)
PRODUCTION_DIR = "/home/farforre/farforrent.com.ua/rentalhub/backend/uploads/products"
LOCAL_DIR = "/app/backend/uploads/products"

# Визначити який шлях використовувати
if os.path.exists(os.path.dirname(PRODUCTION_DIR)):
    PRODUCTS_DIR = PRODUCTION_DIR
    logger.info(f"✅ Using PRODUCTION path: {PRODUCTS_DIR}")
else:
    PRODUCTS_DIR = LOCAL_DIR
    logger.info(f"✅ Using LOCAL path: {PRODUCTS_DIR}")

# Створити директорії
os.makedirs(PRODUCTS_DIR, exist_ok=True)
os.makedirs(os.path.join(PRODUCTS_DIR, "thumbnails"), exist_ok=True)
os.makedirs(os.path.join(PRODUCTS_DIR, "medium"), exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_RETRIES = 3
TIMEOUT = 30


def create_thumbnail(image_path: str, size: tuple, output_subdir: str) -> str:
    """
    Створити thumbnail зображення
    
    Args:
        image_path: Шлях до оригінального зображення
        size: Розмір (width, height)
        output_subdir: Піддиректорія ('thumbnails' або 'medium')
    """
    try:
        img = Image.open(image_path)
        
        # Convert RGBA to RGB if needed
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        
        # Resize keeping aspect ratio
        img.thumbnail(size, Image.Resampling.LANCZOS)
        
        # Save thumbnail
        filename = os.path.basename(image_path)
        name, ext = os.path.splitext(filename)
        
        suffix = "_thumb" if output_subdir == "thumbnails" else "_medium"
        thumb_path = os.path.join(PRODUCTS_DIR, output_subdir, f"{name}{suffix}{ext}")
        
        img.save(thumb_path, quality=85, optimize=True)
        logger.debug(f"  Created {output_subdir}: {os.path.basename(thumb_path)}")
        return thumb_path
        
    except Exception as e:
        logger.error(f"  ❌ Error creating {output_subdir}: {str(e)}")
        return None


def download_image(url: str, timeout: int = TIMEOUT) -> bytes:
    """
    Скачати зображення з URL
    
    Returns:
        bytes: Binary content зображення
    """
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(url, timeout=timeout, stream=True)
            response.raise_for_status()
            return response.content
        except requests.exceptions.RequestException as e:
            if attempt < MAX_RETRIES - 1:
                logger.warning(f"  ⚠️  Retry {attempt + 1}/{MAX_RETRIES} for {url}")
                time.sleep(2)
            else:
                logger.error(f"  ❌ Failed to download after {MAX_RETRIES} attempts: {url}")
                raise
    return None


def process_product_image(product_id: int, sku: str, product_name: str, oc_image_path: str, rh_cur) -> bool:
    """
    Обробити зображення одного товару:
    1. Скачати з OpenCart
    2. Зберегти оригінал
    3. Створити thumbnails
    4. Оновити БД
    
    Returns:
        bool: True якщо успішно, False якщо помилка
    """
    try:
        # Перевірити чи вже є локальна копія
        existing_url_query = "SELECT image_url FROM products WHERE product_id = %s"
        rh_cur.execute(existing_url_query, (product_id,))
        existing = rh_cur.fetchone()
        
        if existing and existing[0] and existing[0].startswith("uploads/products/"):
            logger.debug(f"  ⏭️  SKU {sku}: Already has local image, skipping")
            return True
        
        # Побудувати URL зображення в OpenCart
        if not oc_image_path:
            logger.warning(f"  ⚠️  SKU {sku}: No image path in OpenCart")
            return False
        
        # Видалити "catalog/" prefix якщо є
        clean_path = oc_image_path.replace("catalog/", "")
        image_url = f"{OPENCART_IMAGE_BASE}{clean_path}"
        
        logger.info(f"📥 Processing: SKU {sku} - {product_name[:50]}")
        logger.debug(f"  URL: {image_url}")
        
        # Скачати зображення
        image_content = download_image(image_url)
        if not image_content:
            return False
        
        # Визначити розширення файлу
        file_ext = os.path.splitext(oc_image_path)[1].lower()
        if not file_ext or file_ext not in ALLOWED_EXTENSIONS:
            file_ext = ".jpg"  # Default
        
        # Згенерувати безпечне ім'я файлу
        safe_sku = sku.replace("/", "_").replace("\\", "_").replace(" ", "_")
        timestamp = int(time.time())
        filename = f"{safe_sku}_{timestamp}{file_ext}"
        file_path = os.path.join(PRODUCTS_DIR, filename)
        
        # Зберегти оригінал
        with open(file_path, "wb") as f:
            f.write(image_content)
        
        logger.debug(f"  ✅ Saved original: {filename}")
        
        # Створити thumbnails
        thumbnail_path = create_thumbnail(file_path, (300, 300), "thumbnails")
        medium_path = create_thumbnail(file_path, (800, 800), "medium")
        
        # Оновити БД
        relative_path = f"uploads/products/{filename}"
        update_query = """
            UPDATE products 
            SET image_url = %s
            WHERE product_id = %s
        """
        rh_cur.execute(update_query, (relative_path, product_id))
        
        logger.info(f"  ✅ Updated DB: {relative_path}")
        
        return True
        
    except Exception as e:
        logger.error(f"  ❌ Error processing SKU {sku}: {str(e)}")
        return False


def migrate_images(limit: int = None, skip_existing: bool = True):
    """
    Головна функція міграції зображень
    
    Args:
        limit: Скільки товарів обробити (None = всі)
        skip_existing: Пропускати товари які вже мають локальні зображення
    """
    logger.info("=" * 70)
    logger.info("🖼️  МІГРАЦІЯ ЗОБРАЖЕНЬ З OPENCART → RENTALHUB")
    logger.info("=" * 70)
    
    start_time = time.time()
    stats = {
        "total": 0,
        "success": 0,
        "failed": 0,
        "skipped": 0
    }
    
    try:
        # Підключення до БД
        oc_conn = mysql.connector.connect(**OC)
        rh_conn = mysql.connector.connect(**RH)
        
        oc_cur = oc_conn.cursor(dictionary=True)
        rh_cur = rh_conn.cursor()
        
        logger.info(f"📊 Fetching products from OpenCart...")
        
        # Отримати товари з OpenCart які мають зображення
        query = """
            SELECT 
                p.product_id,
                p.model as sku,
                pd.name,
                p.image,
                p.status
            FROM oc_product p
            JOIN oc_product_description pd ON p.product_id = pd.product_id
            WHERE pd.language_id = 4
              AND p.image IS NOT NULL
              AND p.image != ''
              AND p.status = 1
            ORDER BY p.product_id
        """
        
        if limit:
            query += f" LIMIT {limit}"
        
        oc_cur.execute(query)
        products = oc_cur.fetchall()
        
        stats["total"] = len(products)
        logger.info(f"📦 Found {stats['total']} products with images")
        logger.info("")
        
        # Обробити кожен товар
        start_time_batch = time.time()
        
        for idx, product in enumerate(products, 1):
            product_id = product['product_id']
            sku = product['sku'] or f"P{product_id}"
            name = product['name']
            image_path = product['image']
            
            logger.info(f"[{idx}/{stats['total']}] Product ID: {product_id}")
            
            success = process_product_image(
                product_id=product_id,
                sku=sku,
                product_name=name,
                oc_image_path=image_path,
                rh_cur=rh_cur
            )
            
            if success:
                stats["success"] += 1
                rh_conn.commit()
            else:
                stats["failed"] += 1
                rh_conn.rollback()
            
            # Показувати прогрес кожні 10 товарів
            if idx % 10 == 0:
                elapsed = time.time() - start_time_batch
                avg_time = elapsed / idx
                remaining = stats['total'] - idx
                eta_seconds = remaining * avg_time
                eta_minutes = eta_seconds / 60
                
                percent = (idx / stats['total']) * 100
                progress_bar = "█" * int(percent / 5) + "░" * (20 - int(percent / 5))
                
                logger.info("")
                logger.info(f"{'='*70}")
                logger.info(f"📊 ПРОГРЕС: [{progress_bar}] {percent:.1f}%")
                logger.info(f"✅ Успішно: {stats['success']} | ❌ Помилки: {stats['failed']}")
                logger.info(f"⏱️  Середній час: {avg_time:.2f}s/товар")
                logger.info(f"⏳ Залишилось: ~{eta_minutes:.0f} хв ({remaining} товарів)")
                logger.info(f"{'='*70}")
                logger.info("")
                
                time.sleep(1)
            else:
                logger.info("")  # Empty line for readability
        
        # Закрити з'єднання
        oc_cur.close()
        rh_cur.close()
        oc_conn.close()
        rh_conn.close()
        
    except Exception as e:
        logger.error(f"❌ Critical error: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # Фінальна статистика
    duration = time.time() - start_time
    
    logger.info("=" * 70)
    logger.info("✅ МІГРАЦІЯ ЗАВЕРШЕНА")
    logger.info("=" * 70)
    logger.info(f"📊 Всього товарів:     {stats['total']}")
    logger.info(f"✅ Успішно:            {stats['success']}")
    logger.info(f"❌ Помилки:            {stats['failed']}")
    logger.info(f"⏭️  Пропущено:         {stats['skipped']}")
    logger.info(f"⏱️  Тривалість:        {duration:.1f}s ({duration/60:.1f} хв)")
    
    if stats['success'] > 0:
        avg_time = duration / stats['success']
        logger.info(f"📈 Середній час/товар: {avg_time:.2f}s")
    
    logger.info("=" * 70)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Міграція зображень з OpenCart в RentalHub")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Кількість товарів для обробки (за замовчуванням: всі)"
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Тестовий режим: обробити тільки 5 товарів"
    )
    
    args = parser.parse_args()
    
    limit = 5 if args.test else args.limit
    
    if args.test:
        logger.info("🧪 TEST MODE: Processing only 5 products")
    
    migrate_images(limit=limit)
