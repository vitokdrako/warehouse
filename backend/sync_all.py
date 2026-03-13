"""
Master sync script - syncs all data from OpenCart to RentalHub DB
ВИПРАВЛЕНА ВЕРСІЯ - правильно синхронізує замовлення
Run this via cron every 30 minutes
"""
import mysql.connector
from datetime import datetime
import time

# ⚠️ ЗАМІНІТЬ НА ВАШІ PRODUCTION ДАНІ
OC = {'host': 'farforre.mysql.tools', 'database': 'farforre_db',
      'user': 'farforre_db', 'password': 'gPpAHTvv', 'charset': 'utf8mb4'}
RH = {'host': 'farforre.mysql.tools', 'database': 'farforre_rentalhub',
      'user': 'farforre_rentalhub', 'password': '-nu+3Gp54L', 'charset': 'utf8mb4'}

def log(msg):
    """Log with timestamp"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def ensure_client_from_order(cursor, customer_name, phone, email):
    """
    Знайти або створити клієнта в client_users на основі даних ордеру.
    Повертає client_user_id або None.
    Пріоритет пошуку: email > phone.
    """
    if not customer_name:
        return None
    
    email = (email or '').strip()
    phone = (phone or '').strip()
    email_normalized = email.lower().strip() if email else ''
    
    # 1. Пошук по email (якщо є)
    if email_normalized and '@' in email_normalized:
        cursor.execute(
            "SELECT id FROM client_users WHERE email_normalized = %s LIMIT 1",
            (email_normalized,)
        )
        row = cursor.fetchone()
        if row:
            # Оновити last_order_date
            cursor.execute(
                "UPDATE client_users SET last_order_date = CURDATE(), updated_at = NOW() WHERE id = %s",
                (row[0] if isinstance(row, tuple) else row['id'],)
            )
            return row[0] if isinstance(row, tuple) else row['id']
    
    # 2. Пошук по телефону (останні 9 цифр)
    if phone:
        phone_digits = ''.join(c for c in phone if c.isdigit())
        if len(phone_digits) >= 9:
            phone_suffix = phone_digits[-9:]
            cursor.execute(
                "SELECT id FROM client_users WHERE phone LIKE %s LIMIT 1",
                (f'%{phone_suffix}',)
            )
            row = cursor.fetchone()
            if row:
                client_id = row[0] if isinstance(row, tuple) else row['id']
                # Оновити email якщо у клієнта його немає
                if email_normalized:
                    cursor.execute(
                        """UPDATE client_users 
                           SET email = %s, email_normalized = %s, 
                               last_order_date = CURDATE(), updated_at = NOW() 
                           WHERE id = %s AND (email IS NULL OR email = '')""",
                        (email, email_normalized, client_id)
                    )
                else:
                    cursor.execute(
                        "UPDATE client_users SET last_order_date = CURDATE(), updated_at = NOW() WHERE id = %s",
                        (client_id,)
                    )
                return client_id
    
    # 3. Не знайдено — створити нового клієнта
    cursor.execute("""
        INSERT INTO client_users 
            (email, email_normalized, full_name, phone, source, is_active, created_at, updated_at, last_order_date)
        VALUES (%s, %s, %s, %s, 'opencart', 1, NOW(), NOW(), CURDATE())
    """, (email or None, email_normalized, customer_name, phone or None))
    
    cursor.execute("SELECT LAST_INSERT_ID()")
    new_id = cursor.fetchone()
    return new_id[0] if new_id else None

def sync_categories():
    """Sync categories - fast"""
    log("📁 Syncing categories...")
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor()
        
        oc_cur.execute("""
            SELECT c.category_id, c.parent_id, cd.name, c.sort_order, c.status
            FROM oc_category c
            JOIN oc_category_description cd ON c.category_id = cd.category_id
            WHERE cd.language_id = 4
        """)
        
        categories = oc_cur.fetchall()
        
        for cat in categories:
            rh_cur.execute("""
                INSERT INTO categories (category_id, parent_id, name, sort_order, is_active, updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE
                    parent_id = VALUES(parent_id),
                    name = VALUES(name),
                    is_active = VALUES(is_active),
                    updated_at = NOW()
            """, (cat['category_id'], cat['parent_id'], cat['name'], cat['sort_order'], cat['status']))
        
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
    """Sync only new/updated products"""
    log("📦 Syncing products (incremental)...")
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor()
        
        rh_cur.execute("SELECT MAX(synced_at) FROM products")
        last_sync = rh_cur.fetchone()[0]
        
        if last_sync:
            log(f"  Last sync: {last_sync}")
        
        rh_cur.execute("SELECT product_id FROM products")
        existing_ids = set(row[0] for row in rh_cur.fetchall())
        
        oc_cur.execute("""
            SELECT 
                p.product_id, p.model, pd.name, pd.description, 
                p.price as rental_price, p.ean as price, p.status, p.image, p.quantity,
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
            rh_cur.execute("""
                INSERT INTO products (product_id, sku, name, description, price, rental_price, status, quantity, color, material, image_url, synced_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """, (p['product_id'], sku[:100], p['name'][:500], 
                  (p['description'] or '')[:2000], 
                  p['price'] or 0,  # з OpenCart ean (роздрібна ціна)
                  p['rental_price'] or 0,  # з OpenCart price (ціна оренди)
                  p['status'], 
                  p['quantity'] or 0,
                  (p['color'] or '')[:100] if p.get('color') else None,
                  (p['material'] or '')[:100] if p.get('material') else None,
                  (p['image'] or '')[:500] if p['image'] else None))
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
        return 0

def sync_product_categories():
    """Update category info for products"""
    log("🏷️  Updating product categories...")
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor()
        
        rh_cur.execute("SELECT product_id FROM products LIMIT 1000")
        product_ids = [row[0] for row in rh_cur.fetchall()]
        
        if not product_ids:
            log("  ✅ No products to update")
            oc_cur.close()
            rh_cur.close()
            oc.close()
            rh.close()
            return 0
        
        ids_str = ','.join(map(str, product_ids))
        
        oc_cur.execute(f"""
            SELECT ptc.product_id, c.category_id, cd.name, c.parent_id, pcd.name as parent_name
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
                    UPDATE products SET category_id = %s, category_name = %s WHERE product_id = %s
                """, (m['category_id'], m['name'], m['product_id']))
            else:
                rh_cur.execute("""
                    UPDATE products 
                    SET category_id = %s, category_name = %s, subcategory_id = %s, subcategory_name = %s
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
        return 0

def sync_product_quantities():
    """Update quantities, prices, colors and materials"""
    log("📊 Updating product details (quantity, price, color, material)...")
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor()
        
        rh_cur.execute("SELECT product_id FROM products LIMIT 5000")
        product_ids = [row[0] for row in rh_cur.fetchall()]
        
        if not product_ids:
            log("  ✅ No products to update")
            oc_cur.close()
            rh_cur.close()
            oc.close()
            rh.close()
            return 0
        
        ids_str = ','.join(map(str, product_ids))
        
        oc_cur.execute(f"""
            SELECT 
                p.product_id, p.quantity, p.price,
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
            rh_cur.execute("""
                UPDATE products 
                SET quantity = %s, price = %s, color = %s, material = %s
                WHERE product_id = %s
            """, (
                p['quantity'] or 0, 
                p['price'],
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
        return 0

def sync_orders_from_opencart():
    """
    ✅ ВИПРАВЛЕНА ФУНКЦІЯ
    Синхронізує НОВІ замовлення з OpenCart (order_status_id = 2 "В обробці")
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
                o.comment
            FROM oc_order o
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
            
            # Отримати товари замовлення
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
                    p.price as damage_cost
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
            total_deposit = sum(float(item['damage_cost'] or 0) / 2 * int(item['quantity']) for item in order_items)
            
            issue_date = order['date_added'].strftime('%Y-%m-%d')
            return_date = order['date_added'].strftime('%Y-%m-%d')
            
            # Додати замовлення
            try:
                rh_cur.execute("""
                    INSERT INTO orders (
                        order_id, order_number, customer_id, customer_name, 
                        customer_phone, customer_email,
                        rental_start_date, rental_end_date,
                        status, total_price, deposit_amount, 
                        notes, created_at, synced_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                    )
                """, (
                    order_id,
                    f"OC-{order_id}",
                    order['customer_id'],
                    customer_name,
                    order['telephone'],
                    order['email'],
                    issue_date,
                    return_date,
                    'awaiting_customer',  # ✅ ВИПРАВЛЕНО - правильний статус для дашборду
                    total_rental,
                    total_deposit,
                    order['comment'],
                    order['date_added']
                ))
                
                # Додати товари
                for item in order_items:
                    rh_cur.execute("""
                        INSERT INTO order_items (
                            order_id, product_id, product_name, 
                            quantity, price, total_rental
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s
                        )
                    """, (
                        order_id,
                        item['product_id'],
                        item['product_name'],
                        item['quantity'],
                        item['price'],
                        item['total']
                    ))
                
                # ✅ Автостворення/прив'язка клієнта
                try:
                    client_user_id = ensure_client_from_order(
                        rh_cur, customer_name, 
                        order['telephone'], order['email']
                    )
                    if client_user_id:
                        rh_cur.execute("""
                            UPDATE orders SET client_user_id = %s WHERE order_id = %s
                        """, (client_user_id, order_id))
                except Exception as ce:
                    log(f"  ⚠️  Client auto-create error for order {order_id}: {ce}")
                
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
    print("🔄 RENTALHUB AUTO-SYNC (CORRECTED)")
    print("=" * 60)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    total_start = time.time()
    
    # Sync everything
    cat_count = sync_categories()
    prod_count = sync_products_incremental()
    cat_update_count = sync_product_categories()
    qty_update_count = sync_product_quantities()
    order_count = sync_orders_from_opencart()  # ✅ ВИПРАВЛЕНА ФУНКЦІЯ
    
    total_duration = time.time() - total_start
    
    print("\n" + "=" * 60)
    print("✅ SYNC COMPLETED")
    print("=" * 60)
    print(f"Categories: {cat_count}")
    print(f"New products: {prod_count}")
    print(f"Category updates: {cat_update_count}")
    print(f"Quantity updates: {qty_update_count}")
    print(f"📦 NEW ORDERS: {order_count}")
    print(f"Duration: {total_duration:.1f}s")
    print("=" * 60)

if __name__ == "__main__":
    main()
