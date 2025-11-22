"""
Migrate decor_* tables from OpenCart DB to RentalHub DB
"""
import mysql.connector
import uuid
from datetime import datetime

OC = {'host': 'farforre.mysql.tools', 'database': 'farforre_db',
      'user': 'farforre_db', 'password': 'gPpAHTvv', 'charset': 'utf8mb4'}
RH = {'host': 'farforre.mysql.tools', 'database': 'farforre_rentalhub',
      'user': 'farforre_rentalhub', 'password': '-nu+3Gp54L', 'charset': 'utf8mb4'}

def migrate_inventory():
    """Migrate decor_product_catalog → inventory"""
    print("\n📦 Migrating inventory (decor_product_catalog → inventory)...")
    
    oc_conn = mysql.connector.connect(**OC)
    rh_conn = mysql.connector.connect(**RH)
    
    oc_cur = oc_conn.cursor(dictionary=True)
    rh_cur = rh_conn.cursor()
    
    # Clear existing
    rh_cur.execute("DELETE FROM inventory")
    
    # Fetch from OpenCart
    oc_cur.execute("""
        SELECT 
            product_id,
            location_zone,
            location_aisle,
            location_shelf,
            location_bin,
            cleaning_status,
            product_state,
            last_audit_date,
            last_audit_by,
            next_audit_date
        FROM decor_product_catalog
        WHERE product_id IS NOT NULL
    """)
    
    items = oc_cur.fetchall()
    count = 0
    
    for item in items:
        inv_id = str(uuid.uuid4())
        
        rh_cur.execute("""
            INSERT INTO inventory (
                id, product_id, zone, aisle, shelf, bin,
                cleaning_status, product_state, 
                last_audit_date, last_audit_by, next_audit_date,
                quantity, reserved_quantity
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0, 0)
        """, (
            inv_id,
            item['product_id'],
            item['location_zone'],
            item['location_aisle'],
            item['location_shelf'],
            item['location_bin'],
            item['cleaning_status'] or 'clean',
            item['product_state'] or 'available',
            item['last_audit_date'],
            item['last_audit_by'],
            item['next_audit_date']
        ))
        count += 1
    
    rh_conn.commit()
    print(f"  ✅ Migrated {count} inventory records")
    
    oc_cur.close()
    rh_cur.close()
    oc_conn.close()
    rh_conn.close()
    
    return count

def migrate_audit_records():
    """Migrate decor_product_audits → audit_records"""
    print("\n📋 Migrating audit records (decor_product_audits → audit_records)...")
    
    oc_conn = mysql.connector.connect(**OC)
    rh_conn = mysql.connector.connect(**RH)
    
    oc_cur = oc_conn.cursor(dictionary=True)
    rh_cur = rh_conn.cursor()
    
    # Clear existing
    rh_cur.execute("DELETE FROM audit_records")
    
    # Fetch from OpenCart
    oc_cur.execute("""
        SELECT 
            id,
            product_id,
            inventory_item_id,
            audit_date,
            audited_by,
            audit_status,
            qty_expected,
            qty_actual,
            audit_notes,
            photos
        FROM decor_product_audits
    """)
    
    audits = oc_cur.fetchall()
    count = 0
    
    for audit in audits:
        # Use existing ID or generate new
        audit_id = audit['id'] if audit['id'] else str(uuid.uuid4())
        
        rh_cur.execute("""
            INSERT INTO audit_records (
                id, product_id, inventory_id, audit_date, audited_by, 
                status, quantity_expected, quantity_actual, notes, photo_url
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            audit_id,
            audit['product_id'],
            audit['inventory_item_id'],
            audit['audit_date'],
            audit['audited_by'],
            audit['audit_status'] or 'ok',
            audit['qty_expected'],
            audit['qty_actual'],
            audit['audit_notes'],
            audit['photos']  # JSON field
        ))
        count += 1
    
    rh_conn.commit()
    print(f"  ✅ Migrated {count} audit records")
    
    oc_cur.close()
    rh_cur.close()
    oc_conn.close()
    rh_conn.close()
    
    return count

def migrate_product_history():
    """Migrate decor_product_history → product_history"""
    print("\n📜 Migrating product history (decor_product_history → product_history)...")
    
    oc_conn = mysql.connector.connect(**OC)
    rh_conn = mysql.connector.connect(**RH)
    
    oc_cur = oc_conn.cursor(dictionary=True)
    rh_cur = rh_conn.cursor()
    
    # Clear existing
    rh_cur.execute("DELETE FROM product_history")
    
    # Fetch from OpenCart
    oc_cur.execute("""
        SELECT 
            id,
            product_id,
            event_type,
            actor,
            notes,
            photo_url,
            created_at
        FROM decor_product_history
    """)
    
    history = oc_cur.fetchall()
    count = 0
    
    for h in history:
        history_id = h['id'] if h['id'] else str(uuid.uuid4())
        
        rh_cur.execute("""
            INSERT INTO product_history (
                id, product_id, action, actor, details, 
                photo_url, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            history_id,
            h['product_id'],
            h['event_type'],
            h['actor'],
            h['notes'],
            h['photo_url'],
            h['created_at']
        ))
        count += 1
    
    rh_conn.commit()
    print(f"  ✅ Migrated {count} history records")
    
    oc_cur.close()
    rh_cur.close()
    oc_conn.close()
    rh_conn.close()
    
    return count

def migrate_orders():
    """Migrate decor_orders → orders"""
    print("\n📦 Migrating orders (decor_orders → orders)...")
    
    oc_conn = mysql.connector.connect(**OC)
    rh_conn = mysql.connector.connect(**RH)
    
    oc_cur = oc_conn.cursor(dictionary=True)
    rh_cur = rh_conn.cursor()
    
    # Clear existing
    rh_cur.execute("DELETE FROM orders")
    rh_cur.execute("DELETE FROM order_items")
    
    # Fetch orders
    oc_cur.execute("""
        SELECT 
            id,
            order_number,
            client_name,
            client_phone,
            client_email,
            rent_date as event_date,
            rent_date,
            rent_return_date,
            rental_days,
            total_rental as total,
            total_deposit as deposit,
            status,
            created_at
        FROM decor_orders
    """)
    
    orders = oc_cur.fetchall()
    orders_count = 0
    
    for order in orders:
        rh_cur.execute("""
            INSERT INTO orders (
                order_id, order_number, customer_name, customer_phone, 
                customer_email, event_date, rental_start_date, 
                rental_end_date, rental_days, total_amount, 
                deposit_amount, status, created_at, synced_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        """, (
            order['id'],
            order['order_number'],
            order['client_name'],
            order['client_phone'],
            order['client_email'],
            order['event_date'],
            order['rent_date'],
            order['rent_return_date'],
            order['rental_days'],
            order['total'],
            order['deposit'],
            order['status'],
            order['created_at']
        ))
        orders_count += 1
    
    rh_conn.commit()
    
    # Fetch order items
    oc_cur.execute("""
        SELECT 
            id,
            order_id,
            product_id,
            name as product_name,
            quantity,
            price_per_day as price,
            total_rental
        FROM decor_order_items
    """)
    
    items = oc_cur.fetchall()
    items_count = 0
    
    for item in items:
        rh_cur.execute("""
            INSERT INTO order_items (
                id, order_id, product_id, product_name, 
                quantity, price, total_rental
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            item['id'],
            item['order_id'],
            item['product_id'],
            item['product_name'],
            item['quantity'],
            item['price'],
            item['total_rental']
        ))
        items_count += 1
    
    rh_conn.commit()
    print(f"  ✅ Migrated {orders_count} orders and {items_count} items")
    
    oc_cur.close()
    rh_cur.close()
    oc_conn.close()
    rh_conn.close()
    
    return orders_count, items_count

def migrate_issue_cards():
    """Migrate decor_issue_cards → issue_cards"""
    print("\n📦 Migrating issue_cards (decor_issue_cards → issue_cards)...")
    
    oc_conn = mysql.connector.connect(**OC)
    rh_conn = mysql.connector.connect(**RH)
    
    oc_cur = oc_conn.cursor(dictionary=True)
    rh_cur = rh_conn.cursor()
    
    # Fetch from OpenCart
    oc_cur.execute("""
        SELECT 
            id, order_id, order_number, status, prepared_by, issued_by,
            items, preparation_notes, issue_notes, prepared_at, issued_at,
            created_at, updated_at
        FROM decor_issue_cards
    """)
    
    cards = oc_cur.fetchall()
    count = 0
    
    for card in cards:
        # Convert JSON if needed
        items_json = card['items'] if isinstance(card['items'], str) else None
        
        rh_cur.execute("""
            INSERT INTO issue_cards (
                id, order_id, order_number, status, prepared_by, issued_by,
                items, preparation_notes, issue_notes, prepared_at, issued_at,
                created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                prepared_by = VALUES(prepared_by),
                issued_by = VALUES(issued_by),
                items = VALUES(items),
                updated_at = VALUES(updated_at)
        """, (
            card['id'], card['order_id'], card['order_number'],
            card['status'], card['prepared_by'], card['issued_by'],
            items_json, card['preparation_notes'], card['issue_notes'],
            card['prepared_at'], card['issued_at'],
            card['created_at'], card['updated_at']
        ))
        count += 1
    
    rh_conn.commit()
    print(f"  ✅ Migrated {count} issue cards")
    
    oc_cur.close()
    rh_cur.close()
    oc_conn.close()
    rh_conn.close()
    
    return count

def migrate_return_cards():
    """Migrate decor_return_cards → return_cards"""
    print("\n📦 Migrating return_cards (decor_return_cards → return_cards)...")
    
    oc_conn = mysql.connector.connect(**OC)
    rh_conn = mysql.connector.connect(**RH)
    
    oc_cur = oc_conn.cursor(dictionary=True)
    rh_cur = rh_conn.cursor()
    
    # Fetch from OpenCart
    oc_cur.execute("""
        SELECT 
            id, order_id, order_number, issue_card_id, status,
            received_by, checked_by, items_expected, items_returned,
            total_items_expected, total_items_returned, items_ok,
            items_dirty, items_damaged, items_missing,
            cleaning_fee, late_fee, return_notes,
            returned_at, checked_at, created_at, updated_at
        FROM decor_return_cards
    """)
    
    cards = oc_cur.fetchall()
    count = 0
    
    for card in cards:
        # Convert JSON if needed
        items_expected_json = card['items_expected'] if isinstance(card['items_expected'], str) else None
        items_returned_json = card['items_returned'] if isinstance(card['items_returned'], str) else None
        
        rh_cur.execute("""
            INSERT INTO return_cards (
                id, order_id, order_number, issue_card_id, status,
                received_by, checked_by, items_expected, items_returned,
                total_items_expected, total_items_returned, items_ok,
                items_dirty, items_damaged, items_missing,
                cleaning_fee, late_fee, return_notes,
                returned_at, checked_at, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                items_returned = VALUES(items_returned),
                updated_at = VALUES(updated_at)
        """, (
            card['id'], card['order_id'], card['order_number'],
            card['issue_card_id'], card['status'],
            card['received_by'], card['checked_by'],
            items_expected_json, items_returned_json,
            card['total_items_expected'], card['total_items_returned'],
            card['items_ok'], card['items_dirty'], card['items_damaged'],
            card['items_missing'], card['cleaning_fee'], card['late_fee'],
            card['return_notes'], card['returned_at'], card['checked_at'],
            card['created_at'], card['updated_at']
        ))
        count += 1
    
    rh_conn.commit()
    print(f"  ✅ Migrated {count} return cards")
    
    oc_cur.close()
    rh_cur.close()
    oc_conn.close()
    rh_conn.close()
    
    return count

def migrate_tasks():
    """Migrate decor_tasks → tasks"""
    print("\n📋 Migrating tasks (decor_tasks → tasks)...")
    
    oc_conn = mysql.connector.connect(**OC)
    rh_conn = mysql.connector.connect(**RH)
    
    oc_cur = oc_conn.cursor(dictionary=True)
    rh_cur = rh_conn.cursor()
    
    # Fetch from OpenCart
    oc_cur.execute("""
        SELECT 
            id, order_id, order_number, damage_id, title, description,
            task_type, status, priority, assigned_to, due_date,
            completed_at, created_by, created_at, updated_at
        FROM decor_tasks
    """)
    
    tasks = oc_cur.fetchall()
    count = 0
    
    for task in tasks:
        rh_cur.execute("""
            INSERT INTO tasks (
                id, order_id, order_number, damage_id, title, description,
                task_type, status, priority, assigned_to, due_date,
                completed_at, created_by, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                updated_at = VALUES(updated_at)
        """, (
            task['id'], task['order_id'], task['order_number'],
            task['damage_id'], task['title'], task['description'],
            task['task_type'], task['status'], task['priority'],
            task['assigned_to'], task['due_date'], task['completed_at'],
            task['created_by'], task['created_at'], task['updated_at']
        ))
        count += 1
    
    rh_conn.commit()
    print(f"  ✅ Migrated {count} tasks")
    
    oc_cur.close()
    rh_cur.close()
    oc_conn.close()
    rh_conn.close()
    
    return count

def migrate_damages():
    """Migrate decor_damages + decor_damage_items → damages + damage_items"""
    print("\n💥 Migrating damages (decor_damages → damages)...")
    
    oc_conn = mysql.connector.connect(**OC)
    rh_conn = mysql.connector.connect(**RH)
    
    oc_cur = oc_conn.cursor(dictionary=True)
    rh_cur = rh_conn.cursor()
    
    # Fetch damages
    oc_cur.execute("""
        SELECT 
            id, order_id, order_number, customer_id, customer_name,
            customer_phone, customer_email, event_name, return_date,
            case_status, severity, source, from_reaudit_item_id,
            finance_status, fulfillment_status, claimed_total, paid_total,
            withheld_total, deposit_available, notes, payment_policy,
            created_by, assigned_to, manager_comment, created_at, updated_at
        FROM decor_damages
    """)
    
    damages = oc_cur.fetchall()
    damages_count = 0
    
    for damage in damages:
        rh_cur.execute("""
            INSERT INTO damages (
                id, order_id, order_number, customer_id, customer_name,
                customer_phone, customer_email, event_name, return_date,
                case_status, severity, source, from_reaudit_item_id,
                finance_status, fulfillment_status, claimed_total, paid_total,
                withheld_total, deposit_available, notes, payment_policy,
                created_by, assigned_to, manager_comment, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                case_status = VALUES(case_status),
                updated_at = VALUES(updated_at)
        """, (
            damage['id'], damage['order_id'], damage['order_number'],
            damage['customer_id'], damage['customer_name'],
            damage['customer_phone'], damage['customer_email'],
            damage['event_name'], damage['return_date'],
            damage['case_status'], damage['severity'], damage['source'],
            damage['from_reaudit_item_id'], damage['finance_status'],
            damage['fulfillment_status'], damage['claimed_total'],
            damage['paid_total'], damage['withheld_total'],
            damage['deposit_available'], damage['notes'],
            damage['payment_policy'], damage['created_by'],
            damage['assigned_to'], damage['manager_comment'],
            damage['created_at'], damage['updated_at']
        ))
        damages_count += 1
    
    rh_conn.commit()
    
    # Fetch damage items
    oc_cur.execute("""
        SELECT 
            damage_id, product_id, barcode, name, image, category,
            item_ref, damage_type, qty, base_value, estimate_value,
            resolution, comment, photos, created_at
        FROM decor_damage_items
    """)
    
    items = oc_cur.fetchall()
    items_count = 0
    
    for item in items:
        rh_cur.execute("""
            INSERT INTO damage_items (
                damage_id, product_id, barcode, name, image, category,
                item_ref, damage_type, qty, base_value, estimate_value,
                resolution, comment, photos, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            item['damage_id'], item['product_id'], item['barcode'],
            item['name'], item['image'], item['category'],
            item['item_ref'], item['damage_type'], item['qty'],
            item['base_value'], item['estimate_value'],
            item['resolution'], item['comment'], item['photos'],
            item['created_at']
        ))
        items_count += 1
    
    rh_conn.commit()
    print(f"  ✅ Migrated {damages_count} damages and {items_count} damage items")
    
    oc_cur.close()
    rh_cur.close()
    oc_conn.close()
    rh_conn.close()
    
    return damages_count, items_count

def verify_migration():
    """Verify migrated data"""
    print("\n🔍 Verification:")
    
    rh_conn = mysql.connector.connect(**RH)
    cur = rh_conn.cursor()
    
    tables = [
        'inventory', 'audit_records', 'product_history', 'orders', 'order_items',
        'issue_cards', 'return_cards', 'tasks', 'damages', 'damage_items'
    ]
    
    for table in tables:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        count = cur.fetchone()[0]
        print(f"  - {table:20} : {count:5} records")
    
    cur.close()
    rh_conn.close()

def main():
    print("=" * 60)
    print("🔄 MIGRATING DECOR_* DATA (FULL MIGRATION)")
    print("=" * 60)
    
    try:
        # Migrate existing tables
        migrate_inventory()
        migrate_audit_records()
        migrate_product_history()
        migrate_orders()
        
        # Migrate new tables (issue_cards, return_cards, tasks, damages)
        migrate_issue_cards()
        migrate_return_cards()
        migrate_tasks()
        migrate_damages()
        
        # Verify
        verify_migration()
        
        print("\n" + "=" * 60)
        print("✅ FULL MIGRATION COMPLETED!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
