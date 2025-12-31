#!/usr/bin/env python3
"""
Master sync script - syncs all data from OpenCart to RentalHub DB
PRODUCTION VERSION з автоматичним скачуванням фотографій
Run this via cron every 30 minutes
"""
import mysql.connector
from datetime import datetime
import time
import os
import requests
from PIL import Image
from io import BytesIO

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

# Image paths - Production or Local
PRODUCTION_DIR = "/home/farforre/farforrent.com.ua/rentalhub/backend/uploads/products"
LOCAL_DIR = "/app/backend/uploads/products"

# Визначити який шлях використовувати
if os.path.exists(os.path.dirname(PRODUCTION_DIR)):
    PRODUCTS_DIR = PRODUCTION_DIR
else:
    PRODUCTS_DIR = LOCAL_DIR

# Створити директорії
os.makedirs(PRODUCTS_DIR, exist_ok=True)
os.makedirs(os.path.join(PRODUCTS_DIR, "thumbnails"), exist_ok=True)
os.makedirs(os.path.join(PRODUCTS_DIR, "medium"), exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
IMAGE_TIMEOUT = 30
MAX_RETRIES = 2


def log(msg):
    """Log with timestamp"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


# ============================================================
# IMAGE FUNCTIONS
# ============================================================

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
        return thumb_path
        
    except Exception as e:
        return None


def download_image(url: str) -> bytes:
    """Скачати зображення з URL"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(url, timeout=IMAGE_TIMEOUT, headers=headers, stream=True)
            response.raise_for_status()
            return response.content
        except requests.exceptions.RequestException as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(1)
            else:
                return None
    return None


def download_product_image(product_id: int, sku: str, oc_image_path: str, rh_cur, rh_conn) -> bool:
    """
    Скачати та обробити зображення одного товару
    
    Returns:
        bool: True якщо успішно
    """
    try:
        if not oc_image_path:
            return False
        
        # Побудувати URL зображення в OpenCart
        # НЕ видаляємо catalog/ - URL має бути повним
        image_url = f"{OPENCART_IMAGE_BASE}{oc_image_path}"
        
        # Скачати зображення
        image_content = download_image(image_url)
        if not image_content:
            return False
        
        # Визначити розширення файлу
        file_ext = os.path.splitext(oc_image_path)[1].lower()
        if not file_ext or file_ext not in ALLOWED_EXTENSIONS:
            file_ext = ".jpg"
        
        # Згенерувати безпечне ім'я файлу
        safe_sku = sku.replace("/", "_").replace("\\", "_").replace(" ", "_")
        timestamp = int(time.time())
        filename = f"{safe_sku}_{timestamp}{file_ext}"
        file_path = os.path.join(PRODUCTS_DIR, filename)
        
        # Зберегти оригінал
        with open(file_path, "wb") as f:
            f.write(image_content)
        
        # Створити thumbnails
        create_thumbnail(file_path, (300, 300), "thumbnails")
        create_thumbnail(file_path, (800, 800), "medium")
        
        # Оновити БД
        relative_path = f"uploads/products/{filename}"
        rh_cur.execute("""
            UPDATE products 
            SET image_url = %s
            WHERE product_id = %s
        """, (relative_path, product_id))
        rh_conn.commit()
        
        return True
        
    except Exception as e:
        return False


def sync_product_images():
    """
    Синхронізувати зображення для товарів які ще не мають локальних фото
    Беремо шлях зображення напряму з OpenCart БД
    """
    log("🖼️  Syncing product images...")
    
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor(dictionary=True)
        
        # Знайти товари без локальних зображень
        rh_cur.execute("""
            SELECT product_id, sku, image_url 
            FROM products 
            WHERE (image_url IS NULL 
                   OR image_url = '' 
                   OR image_url NOT LIKE 'uploads/products/%')
            LIMIT 100
        """)
        
        products_without_images = rh_cur.fetchall()
        
        if not products_without_images:
            log("  ✅ All products have local images")
            oc_cur.close()
            rh_cur.close()
            oc.close()
            rh.close()
            return 0
        
        log(f"  📦 Found {len(products_without_images)} products without local images")
        
        # Отримати ПРАВИЛЬНІ image paths напряму з OpenCart
        product_ids = [p['product_id'] for p in products_without_images]
        ids_str = ','.join(map(str, product_ids))
        
        oc_cur.execute(f"""
            SELECT product_id, model as sku, image 
            FROM oc_product 
            WHERE product_id IN ({ids_str}) AND image IS NOT NULL AND image != ''
        """)
        
        oc_images = {row['product_id']: row for row in oc_cur.fetchall()}
        
        # Скачати зображення
        success_count = 0
        failed_count = 0
        rh_cur_update = rh.cursor()
        
        for product in products_without_images:
            product_id = product['product_id']
            sku = product['sku']
            
            if product_id not in oc_images:
                continue
            
            # Беремо шлях напряму з OpenCart (не з RentalHub!)
            oc_image = oc_images[product_id]['image']
            
            if download_product_image(product_id, sku, oc_image, rh_cur_update, rh):
                success_count += 1
                if success_count <= 10 or success_count % 20 == 0:
                    log(f"    ✅ Downloaded: {sku}")
            else:
                failed_count += 1
                if failed_count <= 5:
                    log(f"    ⚠️  Failed: {sku}")
        
        log(f"  ✅ Downloaded {success_count} images, {failed_count} failed")
        
        oc_cur.close()
        rh_cur.close()
        rh_cur_update.close()
        oc.close()
        rh.close()
        
        return success_count
        
    except Exception as e:
        log(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 0


# ============================================================
# SYNC FUNCTIONS
# ============================================================

def sync_categories():
    """Sync categories from OpenCart"""
    log("📁 Syncing categories...")
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor()
        
        # Get all categories from OpenCart
        oc_cur.execute("""
            SELECT c.category_id, c.parent_id, cd.name, c.sort_order
            FROM oc_category c
            JOIN oc_category_description cd ON c.category_id = cd.category_id
            WHERE cd.language_id = 4
            ORDER BY c.parent_id, c.sort_order
        """)
        
        categories = oc_cur.fetchall()
        
        for cat in categories:
            rh_cur.execute("""
                INSERT INTO categories (category_id, parent_id, name, sort_order, created_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE
                    parent_id = VALUES(parent_id),
                    name = VALUES(name),
                    sort_order = VALUES(sort_order)
            """, (cat['category_id'], cat['parent_id'], cat['name'], cat['sort_order']))
        
        rh.commit()
        log(f"  ✅ Synced {len(categories)} categories")
        
        oc_cur.close()
        rh_cur.close()
        oc.close()
        rh.close()
        return len(categories)
        
    except Exception as e:
        log(f"  ❌ Error: {e}")
        return 0


def sync_products_incremental():
    """Sync only new products"""
    log("📦 Syncing products (incremental)...")
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor()
        
        # Get existing product IDs
        rh_cur.execute("SELECT product_id FROM products")
        existing_ids = set(row[0] for row in rh_cur.fetchall())
        
        # Get all active products from OpenCart
        oc_cur.execute("""
            SELECT 
                p.product_id, p.model, pd.name, pd.description, p.price, 
                p.status, p.image, p.quantity, p.ean,
                MAX(CASE WHEN ad.name = 'Колір' AND pa.language_id = 4 THEN pa.text END) as color,
                MAX(CASE WHEN ad.name = 'Матеріал' AND pa.language_id = 4 THEN pa.text END) as material
            FROM oc_product p
            JOIN oc_product_description pd ON p.product_id = pd.product_id
            LEFT JOIN oc_product_attribute pa ON p.product_id = pa.product_id
            LEFT JOIN oc_attribute_description ad ON pa.attribute_id = ad.attribute_id AND ad.language_id = 4
            WHERE pd.language_id = 4 AND p.status = 1
            GROUP BY p.product_id
        """)
        
        all_products = oc_cur.fetchall()
        new_products = [p for p in all_products if p['product_id'] not in existing_ids]
        count = 0
        
        for p in new_products:
            sku = p['model'] or f"SKU-{p['product_id']}"
            
            # Маппінг полів:
            # OpenCart price → RentalHub rental_price (ціна оренди за день)
            # OpenCart ean → RentalHub price (вартість товару/повний збиток)
            rental_price = float(p['price']) if p.get('price') else 0
            purchase_price = float(p['ean']) if p.get('ean') else 0
            
            rh_cur.execute("""
                INSERT INTO products (
                    product_id, sku, name, description, price, rental_price, status, quantity, 
                    color, material, image_url, synced_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """, (
                p['product_id'], 
                sku[:100], 
                p['name'][:500], 
                (p['description'] or '')[:2000], 
                purchase_price,  # OpenCart ean → вартість товару
                rental_price,    # OpenCart price → ціна оренди
                p['status'], 
                p['quantity'] or 0,
                (p['color'] or '')[:100] if p.get('color') else None,
                (p['material'] or '')[:100] if p.get('material') else None,
                (p['image'] or '')[:500] if p['image'] else None  # Тимчасово зберігаємо OC path
            ))
            count += 1
        
        rh.commit()
        log(f"  ✅ Synced {count} new products")
        
        oc_cur.close()
        rh_cur.close()
        oc.close()
        rh.close()
        return count
        
    except Exception as e:
        log(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 0


def sync_product_categories():
    """Update category info for products"""
    log("🏷️  Updating product categories...")
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor()
        
        # Get all products (limit 200 для категорій)
        rh_cur.execute("SELECT product_id FROM products LIMIT 200")
        product_ids = [row[0] for row in rh_cur.fetchall()]
        
        if not product_ids:
            log("  ✅ No products to update")
            oc_cur.close()
            rh_cur.close()
            oc.close()
            rh.close()
            return 0
        
        ids_str = ','.join(map(str, product_ids))
        
        # Get category mappings
        oc_cur.execute(f"""
            SELECT 
                ptc.product_id, 
                c.category_id, 
                cd.name, 
                c.parent_id, 
                pcd.name as parent_name
            FROM oc_product_to_category ptc
            JOIN oc_category c ON ptc.category_id = c.category_id
            JOIN oc_category_description cd ON c.category_id = cd.category_id AND cd.language_id = 4
            LEFT JOIN oc_category pc ON c.parent_id = pc.category_id
            LEFT JOIN oc_category_description pcd ON pc.category_id = pcd.category_id AND pcd.language_id = 4
            WHERE ptc.product_id IN ({ids_str})
        """)
        
        count = 0
        for m in oc_cur.fetchall():
            if m['parent_id'] == 0:
                # Top-level category
                rh_cur.execute("""
                    UPDATE products 
                    SET category_id = %s, category_name = %s 
                    WHERE product_id = %s
                """, (m['category_id'], m['name'], m['product_id']))
            else:
                # Subcategory
                rh_cur.execute("""
                    UPDATE products 
                    SET category_id = %s, category_name = %s, 
                        subcategory_id = %s, subcategory_name = %s
                    WHERE product_id = %s
                """, (m['parent_id'], m['parent_name'], m['category_id'], m['name'], m['product_id']))
            count += 1
        
        rh.commit()
        log(f"  ✅ Updated {count} products")
        
        oc_cur.close()
        rh_cur.close()
        oc.close()
        rh.close()
        return count
        
    except Exception as e:
        log(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 0


def sync_product_quantities():
    """Update quantities, prices, colors and materials"""
    log("📊 Updating product details (quantity, price, color, material)...")
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor()
        
        # Get all products (limit 10000 для оновлення цін)
        rh_cur.execute("SELECT product_id FROM products LIMIT 10000")
        product_ids = [row[0] for row in rh_cur.fetchall()]
        
        if not product_ids:
            log("  ✅ No products to update")
            oc_cur.close()
            rh_cur.close()
            oc.close()
            rh.close()
            return 0
        
        ids_str = ','.join(map(str, product_ids))
        
        # Get updated data from OpenCart
        oc_cur.execute(f"""
            SELECT 
                p.product_id, p.quantity, p.price, p.ean,
                MAX(CASE WHEN ad.name = 'Колір' THEN pa.text END) as color,
                MAX(CASE WHEN ad.name = 'Матеріал' THEN pa.text END) as material
            FROM oc_product p
            LEFT JOIN oc_product_attribute pa ON p.product_id = pa.product_id
            LEFT JOIN oc_attribute_description ad ON pa.attribute_id = ad.attribute_id AND ad.language_id = 4
            WHERE p.product_id IN ({ids_str})
            GROUP BY p.product_id
        """)
        
        count = 0
        for p in oc_cur.fetchall():
            # Маппінг полів:
            # OpenCart price → RentalHub rental_price (ціна оренди за день)
            # OpenCart ean → RentalHub price (вартість товару/повний збиток)
            rental_price = float(p['price']) if p.get('price') else 0
            purchase_price = float(p['ean']) if p.get('ean') else 0
            
            rh_cur.execute("""
                UPDATE products 
                SET quantity = %s, price = %s, rental_price = %s, color = %s, material = %s
                WHERE product_id = %s
            """, (
                p['quantity'] or 0, 
                purchase_price,  # OpenCart ean → вартість товару
                rental_price,    # OpenCart price → ціна оренди
                (p['color'] or '')[:100] if p.get('color') else None,
                (p['material'] or '')[:100] if p.get('material') else None,
                p['product_id']
            ))
            count += 1
        
        rh.commit()
        log(f"  ✅ Updated {count} products")
        
        oc_cur.close()
        rh_cur.close()
        oc.close()
        rh.close()
        return count
        
    except Exception as e:
        log(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 0


def sync_orders_from_opencart():
    """
    ✅ PRODUCTION VERSION
    Синхронізує НОВІ замовлення з OpenCart (order_status_id = 2 "В обробці")
    Використовує правильні назви колонок: total_price, deposit_amount
    """
    log("📋 Syncing NEW orders from OpenCart...")
    
    try:
        oc_conn = mysql.connector.connect(**OC)
        rh_conn = mysql.connector.connect(**RH)
        
        oc_cur = oc_conn.cursor(dictionary=True)
        rh_cur = rh_conn.cursor()
        
        # Знайти останнє синхронізоване замовлення
        rh_cur.execute("SELECT MAX(order_id) FROM orders")
        last_synced = rh_cur.fetchone()[0] or 0
        log(f"  📍 Last synced order_id: {last_synced}")
        
        # Витягнути НОВІ замовлення зі статусом 2 (В обробці)
        oc_cur.execute("""
            SELECT 
                o.order_id,
                o.order_status_id,
                o.customer_id,
                o.firstname,
                o.lastname,
                o.email,
                o.telephone,
                o.total,
                o.date_added,
                o.comment,
                osf.rent_issue_date,
                osf.rent_return_date
            FROM oc_order o
            LEFT JOIN oc_order_simple_fields osf ON o.order_id = osf.order_id
            WHERE o.order_status_id = 2
              AND o.order_id > %s
            ORDER BY o.order_id ASC
            LIMIT 50
        """, (last_synced,))
        
        new_orders = oc_cur.fetchall()
        log(f"  📦 Found {len(new_orders)} new orders with status=2")
        
        synced_count = 0
        
        for order in new_orders:
            order_id = order['order_id']
            customer_name = f"{order['firstname']} {order['lastname']}".strip()
            
            # Отримати товари замовлення з EAN для розрахунку депозиту
            oc_cur.execute("""
                SELECT 
                    op.order_product_id,
                    op.product_id,
                    op.name as product_name,
                    op.model as sku,
                    op.quantity,
                    op.price,
                    op.total,
                    p.image,
                    p.ean
                FROM oc_order_product op
                LEFT JOIN oc_product p ON op.product_id = p.product_id
                WHERE op.order_id = %s
            """, (order_id,))
            
            order_items = oc_cur.fetchall()
            
            if not order_items:
                log(f"  ⚠️  Order {order_id} has no items, skipping")
                continue
            
            # Розрахунки
            total_rental = sum(float(item['total'] or 0) for item in order_items)
            
            # Deposit = sum(EAN / 2 * quantity)
            total_deposit = 0
            total_loss_value = 0
            for item in order_items:
                ean_value = float(item['ean']) if item.get('ean') else 0
                quantity = int(item['quantity'])
                total_deposit += (ean_value / 2) * quantity
                total_loss_value += ean_value * quantity
            
            # Dates
            rental_start = order['rent_issue_date'] or order['date_added'].date()
            rental_end = order['rent_return_date'] or order['date_added'].date()
            
            # Calculate rental days
            rental_days = None
            if rental_start and rental_end:
                from datetime import datetime as dt
                if isinstance(rental_start, str):
                    rental_start = dt.strptime(rental_start, '%Y-%m-%d').date()
                if isinstance(rental_end, str):
                    rental_end = dt.strptime(rental_end, '%Y-%m-%d').date()
                rental_days = (rental_end - rental_start).days
                if rental_days < 1:
                    rental_days = 1
            
            # Додати замовлення (використовуємо total_price замість total_amount)
            try:
                rh_cur.execute("""
                    INSERT INTO orders (
                        order_id, order_number, customer_id, customer_name, 
                        customer_phone, customer_email,
                        rental_start_date, rental_end_date, rental_days,
                        status, total_price, deposit_amount, total_loss_value,
                        notes, created_at, synced_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                    )
                """, (
                    order_id,
                    f"OC-{order_id}",
                    order['customer_id'],
                    customer_name,
                    order['telephone'],
                    order['email'],
                    rental_start,
                    rental_end,
                    rental_days,
                    'awaiting_customer',  # Правильний статус для дашборду
                    total_rental,
                    total_deposit,
                    total_loss_value,
                    order['comment'],
                    order['date_added']
                ))
                
                # Додати товари
                for item in order_items:
                    # Format image URL
                    image_url = None
                    if item['image']:
                        image_url = f"https://www.farforrent.com.ua/image/{item['image']}"
                    
                    rh_cur.execute("""
                        INSERT INTO order_items (
                            order_id, product_id, product_name, 
                            quantity, price, total_rental, image_url
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s
                        )
                    """, (
                        order_id,
                        item['product_id'],
                        item['product_name'],
                        item['quantity'],
                        item['price'],
                        item['total'],
                        image_url
                    ))
                
                rh_conn.commit()
                synced_count += 1
                log(f"  ✅ Synced order #{order_id} ({customer_name})")
                
            except mysql.connector.IntegrityError:
                log(f"  ⚠️  Order {order_id} already exists")
                continue
        
        log(f"  ✅ Successfully synced {synced_count} new orders")
        
        oc_cur.close()
        rh_cur.close()
        oc_conn.close()
        rh_conn.close()
        
        return synced_count
        
    except Exception as e:
        log(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 0


def main():
    print("=" * 60)
    print("🔄 RENTALHUB AUTO-SYNC (PRODUCTION)")
    print("=" * 60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Images dir: {PRODUCTS_DIR}\n")
    
    total_start = time.time()
    
    # Sync everything
    cat_count = sync_categories()
    prod_count = sync_products_incremental()
    cat_update_count = sync_product_categories()
    qty_update_count = sync_product_quantities()
    
    # 🖼️ NEW: Download images for products without local photos
    img_count = sync_product_images()
    
    order_count = sync_orders_from_opencart()
    
    total_duration = time.time() - total_start
    
    print("\n" + "=" * 60)
    print("✅ SYNC COMPLETED")
    print("=" * 60)
    print(f"Categories: {cat_count}")
    print(f"New products: {prod_count}")
    print(f"Category updates: {cat_update_count}")
    print(f"Quantity updates: {qty_update_count}")
    print(f"🖼️  Images downloaded: {img_count}")
    print(f"📦 NEW ORDERS: {order_count}")
    print(f"Duration: {total_duration:.1f}s")
    print("=" * 60)


if __name__ == "__main__":
    main()
