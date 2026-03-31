"""
Fast sync script - only sync orders (runs every 1 minute)
"""
import mysql.connector
from datetime import datetime
import sys

OC = {'host': 'farforre.mysql.tools', 'database': 'farforre_db',
      'user': 'farforre_db', 'password': 'gPpAHTvv', 'charset': 'utf8mb4'}
RH = {'host': 'farforre.mysql.tools', 'database': 'farforre_rentalhub',
      'user': 'farforre_rentalhub', 'password': '-nu+3Gp54L', 'charset': 'utf8mb4'}

def log(msg):
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] {msg}", flush=True)

def sync_orders():
    """Sync only new orders from OpenCart"""
    log("🔄 Syncing orders...")
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor()
        
        # Get last sync time
        rh_cur.execute("SELECT MAX(synced_at) FROM orders")
        last_sync = rh_cur.fetchone()[0]
        log(f"  Last sync: {last_sync}")
        
        # Get existing order IDs
        rh_cur.execute("SELECT order_id FROM orders")
        existing_ids = set(row[0] for row in rh_cur.fetchall())
        
        # Get new orders from OpenCart (only status = 2 "processing")
        oc_cur.execute("""
            SELECT 
                o.order_id,
                CONCAT('OC-', o.order_id) as order_number,
                o.customer_id,
                CONCAT(o.firstname, ' ', o.lastname) as customer_name,
                o.email as customer_email,
                o.telephone as customer_phone,
                o.total as total_amount,
                osf.rent_issue_date as rental_start_date,
                osf.rent_return_date as rental_end_date,
                o.date_added,
                o.order_status_id
            FROM oc_order o
            LEFT JOIN oc_order_simple_fields osf ON o.order_id = osf.order_id
            WHERE o.order_status_id = 2
            ORDER BY o.order_id DESC
            LIMIT 100
        """)
        
        new_orders = [o for o in oc_cur.fetchall() if o['order_id'] not in existing_ids]
        
        if not new_orders:
            log("  ✅ No new orders")
            oc_cur.close()
            rh_cur.close()
            oc.close()
            rh.close()
            return 0
        
        count = 0
        for o in new_orders:
            # Calculate deposit and total loss from EAN values
            # Get all products in this order with their EAN values
            oc_cur.execute("""
                SELECT 
                    op.product_id,
                    op.quantity,
                    p.ean
                FROM oc_order_product op
                JOIN oc_product p ON op.product_id = p.product_id
                WHERE op.order_id = %s
            """, (o['order_id'],))
            
            order_products = oc_cur.fetchall()
            
            # Calculate total EAN (sum of all EAN * quantity)
            total_ean = 0
            for prod in order_products:
                ean_value = float(prod['ean']) if prod['ean'] else 0
                total_ean += ean_value * prod['quantity']
            
            # Deposit = Total EAN / 2
            deposit_amount = total_ean / 2
            
            # Total loss value = Total EAN
            total_loss_value = total_ean
            
            # Calculate rental days
            rental_days = None
            if o['rental_start_date'] and o['rental_end_date']:
                from datetime import datetime
                start = datetime.strptime(str(o['rental_start_date']), '%Y-%m-%d')
                end = datetime.strptime(str(o['rental_end_date']), '%Y-%m-%d')
                rental_days = (end - start).days
                if rental_days < 1:
                    rental_days = 1
            
            # Insert order
            rh_cur.execute("""
                INSERT INTO orders (
                    order_id, order_number, customer_id, customer_name, 
                    customer_email, customer_phone, total_price, deposit_amount, total_loss_value,
                    rental_start_date, rental_end_date, rental_days,
                    status, created_at, synced_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'awaiting_customer', %s, NOW())
            """, (
                o['order_id'], o['order_number'], o['customer_id'],
                o['customer_name'], o['customer_email'], o['customer_phone'],
                o['total_amount'], deposit_amount, total_loss_value,
                o['rental_start_date'], o['rental_end_date'], rental_days,
                o['date_added']
            ))
            
            # Get order items with images
            oc_cur.execute("""
                SELECT 
                    op.product_id, 
                    op.name, 
                    op.quantity, 
                    op.price, 
                    op.total,
                    p.image
                FROM oc_order_product op
                LEFT JOIN oc_product p ON op.product_id = p.product_id
                WHERE op.order_id = %s
            """, (o['order_id'],))
            
            items = oc_cur.fetchall()
            for item in items:
                # Format image URL
                image_url = None
                if item['image']:
                    image_url = f"https://www.farforrent.com.ua/image/{item['image']}"
                
                rh_cur.execute("""
                    INSERT INTO order_items (
                        order_id, product_id, product_name, quantity, price, total_rental, image_url
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    o['order_id'], item['product_id'], item['name'],
                    item['quantity'], item['price'], item['total'], image_url
                ))
            
            count += 1
        
        rh.commit()
        log(f"  ✅ Synced {count} new orders")
        
        oc_cur.close()
        rh_cur.close()
        oc.close()
        rh.close()
        return count
        
    except Exception as e:
        log(f"  ❌ Error: {e}")
        return 0

if __name__ == "__main__":
    log("=" * 50)
    log("FAST ORDER SYNC")
    log("=" * 50)
    count = sync_orders()
    log(f"Completed: {count} orders synced")
