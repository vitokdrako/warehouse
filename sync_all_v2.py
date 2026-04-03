#!/usr/bin/env python3
"""
Master sync script - RentalHub <-> OpenCart
PRODUCTION VERSION v2 — RentalHub is the source of truth for quantities

Changes from v1:
- Orders: after import, OC status changed to 29 (Відправлено в РХ)
- Products: only INSERT new, never UPDATE existing from OC
- Quantities: REVERSED — push from RH → OC (oc_product.quantity)
- Categories & images: unchanged

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

# Статус в OC після імпорту в RH
OC_STATUS_SENT_TO_RH = 29


def log(msg):
    """Log with timestamp"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def ensure_client_from_order(cursor, customer_name, phone, email):
    """
    Знайти або створити клієнта в client_users на основі даних ордеру.
    Повертає client_user_id або None.
    Унікальний ідентифікатор — email. Без email клієнт не створюється.
    """
    if not customer_name:
        return None
    
    email = (email or '').strip()
    email_normalized = email.lower().strip() if email else ''
    
    if not email_normalized or '@' not in email_normalized:
        return None
    
    cursor.execute(
        "SELECT id FROM client_users WHERE email_normalized = %s LIMIT 1",
        (email_normalized,)
    )
    row = cursor.fetchone()
    if row:
        client_id = row[0] if isinstance(row, tuple) else row['id']
        phone = (phone or '').strip()
        if phone:
            cursor.execute(
                """UPDATE client_users 
                   SET phone = COALESCE(NULLIF(phone, ''), %s),
                       last_order_date = CURDATE(), updated_at = NOW() 
                   WHERE id = %s""",
                (phone, client_id)
            )
        else:
            cursor.execute(
                "UPDATE client_users SET last_order_date = CURDATE(), updated_at = NOW() WHERE id = %s",
                (client_id,)
            )
        return client_id
    
    phone = (phone or '').strip()
    cursor.execute("""
        INSERT INTO client_users 
            (email, email_normalized, full_name, phone, source, is_active, created_at, updated_at, last_order_date)
        VALUES (%s, %s, %s, %s, 'opencart', 1, NOW(), NOW(), CURDATE())
    """, (email, email_normalized, customer_name, phone or None))
    
    cursor.execute("SELECT LAST_INSERT_ID()")
    new_id = cursor.fetchone()
    return new_id[0] if new_id else None


# ============================================================
# IMAGE FUNCTIONS
# ============================================================

def create_thumbnail(image_path: str, size: tuple, output_subdir: str) -> str:
    try:
        img = Image.open(image_path)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        img.thumbnail(size, Image.Resampling.LANCZOS)
        filename = os.path.basename(image_path)
        name, ext = os.path.splitext(filename)
        suffix = "_thumb" if output_subdir == "thumbnails" else "_medium"
        thumb_path = os.path.join(PRODUCTS_DIR, output_subdir, f"{name}{suffix}{ext}")
        img.save(thumb_path, quality=85, optimize=True)
        return thumb_path
    except Exception as e:
        return None


def download_image(url: str) -> bytes:
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
    try:
        if not oc_image_path:
            return False
        image_url = f"{OPENCART_IMAGE_BASE}{oc_image_path}"
        image_content = download_image(image_url)
        if not image_content:
            return False
        file_ext = os.path.splitext(oc_image_path)[1].lower()
        if not file_ext or file_ext not in ALLOWED_EXTENSIONS:
            file_ext = ".jpg"
        safe_sku = sku.replace("/", "_").replace("\\", "_").replace(" ", "_")
        timestamp = int(time.time())
        filename = f"{safe_sku}_{timestamp}{file_ext}"
        file_path = os.path.join(PRODUCTS_DIR, filename)
        with open(file_path, "wb") as f:
            f.write(image_content)
        create_thumbnail(file_path, (300, 300), "thumbnails")
        create_thumbnail(file_path, (800, 800), "medium")
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
    """Синхронізувати зображення для товарів які ще не мають локальних фото"""
    log("  Syncing product images...")
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor(dictionary=True)
        rh_cur.execute("""
            SELECT product_id, sku, image_url 
            FROM products 
            WHERE (image_url IS NULL 
                   OR image_url = '' 
                   OR image_url NOT LIKE 'uploads/products/%%')
            LIMIT 100
        """)
        products_without_images = rh_cur.fetchall()
        if not products_without_images:
            log("    All products have local images")
            oc_cur.close(); rh_cur.close(); oc.close(); rh.close()
            return 0
        log(f"    Found {len(products_without_images)} products without local images")
        product_ids = [p['product_id'] for p in products_without_images]
        ids_str = ','.join(map(str, product_ids))
        oc_cur.execute(f"""
            SELECT product_id, model as sku, image 
            FROM oc_product 
            WHERE product_id IN ({ids_str}) AND image IS NOT NULL AND image != ''
        """)
        oc_images = {row['product_id']: row for row in oc_cur.fetchall()}
        success_count = 0
        failed_count = 0
        rh_cur_update = rh.cursor()
        for product in products_without_images:
            product_id = product['product_id']
            sku = product['sku']
            if product_id not in oc_images:
                continue
            oc_image = oc_images[product_id]['image']
            if download_product_image(product_id, sku, oc_image, rh_cur_update, rh):
                success_count += 1
                if success_count <= 10 or success_count % 20 == 0:
                    log(f"      Downloaded: {sku}")
            else:
                failed_count += 1
                if failed_count <= 5:
                    log(f"      Failed: {sku}")
        log(f"    Downloaded {success_count} images, {failed_count} failed")
        oc_cur.close(); rh_cur.close(); rh_cur_update.close(); oc.close(); rh.close()
        return success_count
    except Exception as e:
        log(f"    Error: {e}")
        import traceback
        traceback.print_exc()
        return 0


# ============================================================
# SYNC FUNCTIONS
# ============================================================

def sync_categories():
    """Sync categories from OpenCart"""
    log("  Syncing categories...")
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor()
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
        log(f"    Synced {len(categories)} categories")
        oc_cur.close(); rh_cur.close(); oc.close(); rh.close()
        return len(categories)
    except Exception as e:
        log(f"    Error: {e}")
        return 0


def sync_products_new_only():
    """
    Import ONLY NEW products from OpenCart.
    Existing products are NEVER updated from OC — RentalHub is the source of truth.
    """
    log("  Importing new products from OpenCart...")
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor()

        # Get existing product IDs in RH
        rh_cur.execute("SELECT product_id FROM products")
        existing_ids = set(row[0] for row in rh_cur.fetchall())

        # Get all active products from OpenCart
        oc_cur.execute("""
            SELECT 
                p.product_id, p.model, pd.name, pd.description, p.price, 
                p.status, p.image, p.quantity, p.ean,
                p.height, p.width, p.length,
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

        if not new_products:
            log("    No new products to import")
            oc_cur.close(); rh_cur.close(); oc.close(); rh.close()
            return 0

        count = 0
        for p in new_products:
            sku = p['model'] or f"SKU-{p['product_id']}"
            rental_price = float(p['price']) if p.get('price') else 0
            purchase_price = float(p['ean']) if p.get('ean') else 0

            oc_height = float(p['height'] or 0) if p.get('height') else None
            oc_width = float(p['width'] or 0) if p.get('width') else None
            oc_depth = float(p['length'] or 0) if p.get('length') else None

            rh_cur.execute("""
                INSERT INTO products (
                    product_id, sku, name, description, price, rental_price, status, quantity, 
                    color, material, image_url,
                    height_cm, width_cm, depth_cm,
                    synced_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """, (
                p['product_id'],
                sku[:100],
                p['name'][:500],
                (p['description'] or '')[:2000],
                purchase_price,
                rental_price,
                p['status'],
                p['quantity'] or 0,
                (p['color'] or '')[:100] if p.get('color') else None,
                (p['material'] or '')[:100] if p.get('material') else None,
                (p['image'] or '')[:500] if p['image'] else None,
                oc_height if oc_height and oc_height > 0 else None,
                oc_width if oc_width and oc_width > 0 else None,
                oc_depth if oc_depth and oc_depth > 0 else None,
            ))
            count += 1
            if count <= 10 or count % 20 == 0:
                log(f"      New: {sku} - {p['name'][:40]}")

        rh.commit()
        log(f"    Imported {count} new products")
        oc_cur.close(); rh_cur.close(); oc.close(); rh.close()
        return count
    except Exception as e:
        log(f"    Error: {e}")
        import traceback
        traceback.print_exc()
        return 0


def sync_product_categories():
    """Update category info for products"""
    log("  Updating product categories...")
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor()
        rh_cur.execute("SELECT product_id FROM products")
        product_ids = [row[0] for row in rh_cur.fetchall()]
        if not product_ids:
            log("    No products to update")
            oc_cur.close(); rh_cur.close(); oc.close(); rh.close()
            return 0
        ids_str = ','.join(map(str, product_ids))
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
                rh_cur.execute("""
                    UPDATE products 
                    SET category_id = %s, category_name = %s 
                    WHERE product_id = %s
                """, (m['category_id'], m['name'], m['product_id']))
            else:
                rh_cur.execute("""
                    UPDATE products 
                    SET category_id = %s, category_name = %s, 
                        subcategory_id = %s, subcategory_name = %s
                    WHERE product_id = %s
                """, (m['parent_id'], m['parent_name'], m['category_id'], m['name'], m['product_id']))
            count += 1
        rh.commit()
        log(f"    Updated {count} products")
        oc_cur.close(); rh_cur.close(); oc.close(); rh.close()
        return count
    except Exception as e:
        log(f"    Error: {e}")
        import traceback
        traceback.print_exc()
        return 0


def push_quantities_to_opencart():
    """
    REVERSED: Push quantities FROM RentalHub TO OpenCart.
    RentalHub is the source of truth for stock quantities.
    Updates oc_product.quantity by product_id.
    """
    log("  Pushing quantities RH -> OpenCart...")
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        oc_cur = oc.cursor()
        rh_cur = rh.cursor(dictionary=True)

        # Read all quantities from RentalHub
        rh_cur.execute("SELECT product_id, quantity FROM products WHERE product_id IS NOT NULL")
        rh_products = rh_cur.fetchall()

        if not rh_products:
            log("    No products to push")
            oc_cur.close(); rh_cur.close(); oc.close(); rh.close()
            return 0

        count = 0
        skipped = 0
        for p in rh_products:
            product_id = p['product_id']
            qty = p['quantity'] or 0
            oc_cur.execute("""
                UPDATE oc_product SET quantity = %s WHERE product_id = %s
            """, (qty, product_id))
            count += 1

        oc.commit()
        log(f"    Pushed {count} quantities to OpenCart")
        oc_cur.close(); rh_cur.close(); oc.close(); rh.close()
        return count
    except Exception as e:
        log(f"    Error: {e}")
        import traceback
        traceback.print_exc()
        return 0


def sync_orders_from_opencart():
    """
    Sync NEW orders from OpenCart (order_status_id = 2 "В обробці").
    After successful import, update OC status to 29 (Відправлено в РХ).
    """
    log("  Syncing NEW orders from OpenCart...")
    try:
        oc_conn = mysql.connector.connect(**OC)
        rh_conn = mysql.connector.connect(**RH)
        oc_cur = oc_conn.cursor(dictionary=True)
        rh_cur = rh_conn.cursor()

        # Знайти останнє синхронізоване замовлення
        rh_cur.execute("SELECT MAX(order_id) FROM orders")
        last_synced = rh_cur.fetchone()[0] or 0
        log(f"    Last synced order_id: {last_synced}")

        # Витягнути НОВІ замовлення зі статусом 2 (В обробці)
        oc_cur.execute("""
            SELECT 
                o.order_id, o.order_status_id, o.customer_id,
                o.firstname, o.lastname, o.email, o.telephone,
                o.total, o.date_added, o.comment,
                osf.rent_issue_date, osf.rent_return_date
            FROM oc_order o
            LEFT JOIN oc_order_simple_fields osf ON o.order_id = osf.order_id
            WHERE o.order_status_id = 2
              AND o.order_id > %s
            ORDER BY o.order_id ASC
            LIMIT 50
        """, (last_synced,))

        new_orders = oc_cur.fetchall()
        log(f"    Found {len(new_orders)} new orders with status=2")

        synced_count = 0
        marked_count = 0

        for order in new_orders:
            order_id = order['order_id']
            customer_name = f"{order['firstname']} {order['lastname']}".strip()

            # Отримати товари замовлення
            oc_cur.execute("""
                SELECT 
                    op.order_product_id, op.product_id, op.name as product_name,
                    op.model as sku, op.quantity, op.price, op.total,
                    p.image, p.ean
                FROM oc_order_product op
                LEFT JOIN oc_product p ON op.product_id = p.product_id
                WHERE op.order_id = %s
            """, (order_id,))

            order_items = oc_cur.fetchall()
            if not order_items:
                log(f"    Order {order_id} has no items, skipping")
                continue

            # Розрахунки
            total_rental = sum(float(item['total'] or 0) for item in order_items)
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

            try:
                # Insert order into RentalHub
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
                    order_id, f"OC-{order_id}", order['customer_id'], customer_name,
                    order['telephone'], order['email'],
                    rental_start, rental_end, rental_days,
                    'awaiting_customer', total_rental, total_deposit, total_loss_value,
                    order['comment'], order['date_added']
                ))

                # Insert order items
                for item in order_items:
                    image_url = None
                    if item['image']:
                        image_url = f"https://www.farforrent.com.ua/image/{item['image']}"
                    rh_cur.execute("""
                        INSERT INTO order_items (
                            order_id, product_id, product_name, 
                            quantity, price, total_rental, image_url
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (
                        order_id, item['product_id'], item['product_name'],
                        item['quantity'], item['price'], item['total'], image_url
                    ))

                # Insert client comment if exists
                client_comment = order.get('comment', '').strip() if order.get('comment') else ''
                if client_comment:
                    rh_cur.execute("""
                        INSERT INTO order_internal_notes 
                        (order_id, user_id, user_name, message, created_at)
                        VALUES (%s, %s, %s, %s, NOW())
                    """, (order_id, None, 'Komentap klienta', client_comment))

                # Auto-create/link client
                try:
                    client_user_id = ensure_client_from_order(
                        rh_cur, customer_name, order['telephone'], order['email']
                    )
                    if client_user_id:
                        rh_cur.execute(
                            "UPDATE orders SET client_user_id = %s WHERE order_id = %s",
                            (client_user_id, order_id)
                        )
                except Exception as ce:
                    log(f"    Client auto-create error for order {order_id}: {ce}")

                rh_conn.commit()
                synced_count += 1
                log(f"    Imported order #{order_id} ({customer_name})")

                # ============================================
                # MARK ORDER AS SENT TO RH IN OPENCART
                # ============================================
                try:
                    oc_cur.execute("""
                        UPDATE oc_order SET order_status_id = %s WHERE order_id = %s
                    """, (OC_STATUS_SENT_TO_RH, order_id))

                    oc_cur.execute("""
                        INSERT INTO oc_order_history 
                        (order_id, order_status_id, notify, comment, date_added)
                        VALUES (%s, %s, 0, %s, NOW())
                    """, (order_id, OC_STATUS_SENT_TO_RH, 'Auto: Vidpravleno v RentalHub'))

                    oc_conn.commit()
                    marked_count += 1
                    log(f"    OC order #{order_id} -> status {OC_STATUS_SENT_TO_RH}")
                except Exception as oc_err:
                    log(f"    Failed to update OC status for #{order_id}: {oc_err}")

            except mysql.connector.IntegrityError:
                log(f"    Order {order_id} already exists")
                continue

        log(f"    Synced {synced_count} orders, marked {marked_count} in OpenCart")
        oc_cur.close(); rh_cur.close(); oc_conn.close(); rh_conn.close()
        return synced_count
    except Exception as e:
        log(f"    Error: {e}")
        import traceback
        traceback.print_exc()
        return 0


def main():
    print("=" * 60)
    print("RENTALHUB SYNC v2 (RH = source of truth)")
    print("=" * 60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Images dir: {PRODUCTS_DIR}\n")

    total_start = time.time()

    # 1. Categories (OC -> RH)
    cat_count = sync_categories()

    # 2. NEW products only (OC -> RH, one-time import)
    prod_count = sync_products_new_only()

    # 3. Product categories (OC -> RH)
    cat_update_count = sync_product_categories()

    # 4. Images for products without photos (OC -> RH)
    img_count = sync_product_images()

    # 5. QUANTITIES: RH -> OC (reversed!)
    qty_count = push_quantities_to_opencart()

    # 6. Orders (OC -> RH, then mark as 29 in OC)
    order_count = sync_orders_from_opencart()

    total_duration = time.time() - total_start

    print("\n" + "=" * 60)
    print("SYNC COMPLETED")
    print("=" * 60)
    print(f"Categories:         {cat_count}")
    print(f"New products:       {prod_count}")
    print(f"Category updates:   {cat_update_count}")
    print(f"Images downloaded:  {img_count}")
    print(f"Qty pushed to OC:   {qty_count}")
    print(f"Orders imported:    {order_count}")
    print(f"Duration:           {total_duration:.1f}s")
    print("=" * 60)


if __name__ == "__main__":
    main()
