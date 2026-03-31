"""
Sync script to populate RentalHub DB from OpenCart
Run this periodically (e.g., every 30 minutes via cron)
"""
import mysql.connector
from mysql.connector import Error
from datetime import datetime
import uuid

# OpenCart DB (from .env)
OPENCART_CONFIG = {
    'host': 'farforre.mysql.tools',
    'database': 'farforre_db',
    'user': 'farforre_db',
    'password': 'gPpAHTvv',
    'charset': 'utf8mb4'
}

# RentalHub DB (new separate DB)
RENTALHUB_CONFIG = {
    'host': 'farforre.mysql.tools',
    'database': 'farforre_rentalhub',
    'user': 'farforre_rentalhub',
    'password': '-nu+3Gp54L',
    'charset': 'utf8mb4'
}

class SyncManager:
    def __init__(self):
        self.oc_conn = None
        self.rh_conn = None
        self.sync_log_id = None
        
    def connect(self):
        """Connect to both databases"""
        try:
            self.oc_conn = mysql.connector.connect(**OPENCART_CONFIG)
            self.rh_conn = mysql.connector.connect(**RENTALHUB_CONFIG)
            print("✅ Connected to both databases")
            return True
        except Error as e:
            print(f"❌ Connection error: {e}")
            return False
    
    def start_sync_log(self, sync_type):
        """Log sync start"""
        try:
            cursor = self.rh_conn.cursor()
            cursor.execute("""
                INSERT INTO sync_log (sync_type, status, started_at)
                VALUES (%s, 'started', NOW())
            """, (sync_type,))
            self.rh_conn.commit()
            self.sync_log_id = cursor.lastrowid
            cursor.close()
        except Error as e:
            print(f"Error starting sync log: {e}")
    
    def end_sync_log(self, status, records_synced=0, error_msg=None):
        """Log sync end"""
        if not self.sync_log_id:
            return
        try:
            cursor = self.rh_conn.cursor()
            cursor.execute("""
                UPDATE sync_log 
                SET status = %s, 
                    records_synced = %s,
                    error_message = %s,
                    completed_at = NOW(),
                    duration_seconds = TIMESTAMPDIFF(SECOND, started_at, NOW())
                WHERE id = %s
            """, (status, records_synced, error_msg, self.sync_log_id))
            self.rh_conn.commit()
            cursor.close()
        except Error as e:
            print(f"Error ending sync log: {e}")
    
    def sync_categories(self):
        """Sync categories from OpenCart"""
        print("\n📁 Syncing categories...")
        self.start_sync_log('categories')
        
        try:
            oc_cursor = self.oc_conn.cursor(dictionary=True)
            rh_cursor = self.rh_conn.cursor()
            
            # Get categories from OpenCart
            oc_cursor.execute("""
                SELECT 
                    c.category_id,
                    c.parent_id,
                    cd.name,
                    c.sort_order,
                    c.status
                FROM oc_category c
                JOIN oc_category_description cd ON c.category_id = cd.category_id
                WHERE cd.language_id = 4
            """)
            
            categories = oc_cursor.fetchall()
            count = 0
            
            for cat in categories:
                rh_cursor.execute("""
                    INSERT INTO categories (category_id, parent_id, name, sort_order, status, synced_at)
                    VALUES (%s, %s, %s, %s, %s, NOW())
                    ON DUPLICATE KEY UPDATE
                        parent_id = VALUES(parent_id),
                        name = VALUES(name),
                        sort_order = VALUES(sort_order),
                        status = VALUES(status),
                        synced_at = NOW()
                """, (cat['category_id'], cat['parent_id'], cat['name'], 
                      cat['sort_order'], cat['status']))
                count += 1
            
            self.rh_conn.commit()
            oc_cursor.close()
            rh_cursor.close()
            
            print(f"  ✅ Synced {count} categories")
            self.end_sync_log('completed', count)
            return count
            
        except Error as e:
            print(f"  ❌ Error syncing categories: {e}")
            self.end_sync_log('failed', 0, str(e))
            return 0
    
    def sync_products(self):
        """Sync products from OpenCart"""
        print("\n📦 Syncing products...")
        self.start_sync_log('products')
        
        try:
            oc_cursor = self.oc_conn.cursor(dictionary=True)
            rh_cursor = self.rh_conn.cursor()
            
            # Get products with category info
            oc_cursor.execute("""
                SELECT 
                    p.product_id,
                    p.sku,
                    p.model as sku2,
                    pd.name,
                    pd.description,
                    p.price,
                    p.status,
                    p.image,
                    ptc.category_id,
                    cd.name as category_name,
                    pc.parent_id,
                    pcd.name as parent_category_name
                FROM oc_product p
                JOIN oc_product_description pd ON p.product_id = pd.product_id AND pd.language_id = 4
                LEFT JOIN oc_product_to_category ptc ON p.product_id = ptc.product_id
                LEFT JOIN oc_category c AS pc ON ptc.category_id = pc.category_id
                LEFT JOIN oc_category_description cd ON pc.category_id = cd.category_id AND cd.language_id = 4
                LEFT JOIN oc_category parent ON pc.parent_id = parent.category_id
                LEFT JOIN oc_category_description pcd ON parent.category_id = pcd.category_id AND pcd.language_id = 4
                WHERE p.status = 1
                GROUP BY p.product_id
            """)
            
            products = oc_cursor.fetchall()
            count = 0
            
            for prod in products:
                # Determine main category and subcategory
                if prod['parent_id'] == 0:
                    # This is main category
                    category_id = prod['category_id']
                    category_name = prod['category_name']
                    subcategory_id = None
                    subcategory_name = None
                else:
                    # This is subcategory
                    category_id = prod['parent_id']
                    category_name = prod['parent_category_name']
                    subcategory_id = prod['category_id']
                    subcategory_name = prod['category_name']
                
                sku = prod['sku'] or prod['sku2'] or f"SKU-{prod['product_id']}"
                
                rh_cursor.execute("""
                    INSERT INTO products (
                        product_id, sku, name, category_id, category_name,
                        subcategory_id, subcategory_name, description, price,
                        status, image_url, synced_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON DUPLICATE KEY UPDATE
                        sku = VALUES(sku),
                        name = VALUES(name),
                        category_id = VALUES(category_id),
                        category_name = VALUES(category_name),
                        subcategory_id = VALUES(subcategory_id),
                        subcategory_name = VALUES(subcategory_name),
                        description = VALUES(description),
                        price = VALUES(price),
                        status = VALUES(status),
                        image_url = VALUES(image_url),
                        synced_at = NOW()
                """, (
                    prod['product_id'], sku, prod['name'], category_id, category_name,
                    subcategory_id, subcategory_name, prod['description'], prod['price'],
                    prod['status'], prod['image']
                ))
                count += 1
            
            self.rh_conn.commit()
            oc_cursor.close()
            rh_cursor.close()
            
            print(f"  ✅ Synced {count} products")
            self.end_sync_log('completed', count)
            return count
            
        except Error as e:
            print(f"  ❌ Error syncing products: {e}")
            self.end_sync_log('failed', 0, str(e))
            return 0
    
    def sync_orders(self):
        """Sync orders from decor_orders"""
        print("\n📋 Syncing orders...")
        self.start_sync_log('orders')
        
        try:
            oc_cursor = self.oc_conn.cursor(dictionary=True)
            rh_cursor = self.rh_conn.cursor()
            
            # Get orders
            oc_cursor.execute("""
                SELECT 
                    id as order_id,
                    order_number,
                    client_name as customer_name,
                    client_phone as customer_phone,
                    client_email as customer_email,
                    event_date,
                    rent_date as rental_start_date,
                    rent_return_date as rental_end_date,
                    rental_days,
                    total,
                    deposit,
                    status,
                    created_at
                FROM decor_orders
            """)
            
            orders = oc_cursor.fetchall()
            count = 0
            
            for order in orders:
                rh_cursor.execute("""
                    INSERT INTO orders (
                        order_id, order_number, customer_name, customer_phone, customer_email,
                        event_date, rental_start_date, rental_end_date, rental_days,
                        total_price, deposit_amount, status, created_at, synced_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON DUPLICATE KEY UPDATE
                        status = VALUES(status),
                        synced_at = NOW()
                """, (
                    order['order_id'], order['order_number'], order['customer_name'],
                    order['customer_phone'], order['customer_email'], order['event_date'],
                    order['rental_start_date'], order['rental_end_date'], order['rental_days'],
                    order['total'], order['deposit'], order['status'], order['created_at']
                ))
                count += 1
            
            # Sync order items
            oc_cursor.execute("SELECT * FROM decor_order_items")
            items = oc_cursor.fetchall()
            
            for item in items:
                rh_cursor.execute("""
                    INSERT INTO order_items (
                        id, order_id, product_id, product_name, quantity, price, total_rental
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        quantity = VALUES(quantity),
                        price = VALUES(price)
                """, (
                    item['id'], item['order_id'], item['product_id'],
                    item['product_name'], item['quantity'], item['price'], item['total_rental']
                ))
            
            self.rh_conn.commit()
            oc_cursor.close()
            rh_cursor.close()
            
            print(f"  ✅ Synced {count} orders and {len(items)} items")
            self.end_sync_log('completed', count)
            return count
            
        except Error as e:
            print(f"  ❌ Error syncing orders: {e}")
            self.end_sync_log('failed', 0, str(e))
            return 0
    
    def migrate_inventory_data(self):
        """Migrate existing inventory data"""
        print("\n📊 Migrating inventory data...")
        self.start_sync_log('full')
        
        try:
            oc_cursor = self.oc_conn.cursor(dictionary=True)
            rh_cursor = self.rh_conn.cursor()
            
            # Migrate from decor_product_catalog
            oc_cursor.execute("""
                SELECT 
                    product_id,
                    location_zone as zone,
                    location_aisle as aisle,
                    location_shelf as shelf,
                    location_bin as bin,
                    cleaning_status,
                    product_state,
                    last_audit_date,
                    last_audit_by,
                    next_audit_date
                FROM decor_product_catalog
                WHERE product_id IS NOT NULL
            """)
            
            inventory_records = oc_cursor.fetchall()
            count = 0
            
            for inv in inventory_records:
                inv_id = str(uuid.uuid4())
                rh_cursor.execute("""
                    INSERT INTO inventory (
                        id, product_id, zone, aisle, shelf, bin,
                        cleaning_status, product_state, last_audit_date,
                        last_audit_by, next_audit_date
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        zone = VALUES(zone),
                        last_audit_date = VALUES(last_audit_date)
                """, (
                    inv_id, inv['product_id'], inv['zone'], inv['aisle'],
                    inv['shelf'], inv['bin'], inv['cleaning_status'],
                    inv['product_state'], inv['last_audit_date'],
                    inv['last_audit_by'], inv['next_audit_date']
                ))
                count += 1
            
            self.rh_conn.commit()
            oc_cursor.close()
            rh_cursor.close()
            
            print(f"  ✅ Migrated {count} inventory records")
            self.end_sync_log('completed', count)
            return count
            
        except Error as e:
            print(f"  ❌ Error migrating inventory: {e}")
            self.end_sync_log('failed', 0, str(e))
            return 0
    
    def close(self):
        """Close connections"""
        if self.oc_conn and self.oc_conn.is_connected():
            self.oc_conn.close()
        if self.rh_conn and self.rh_conn.is_connected():
            self.rh_conn.close()
        print("\n👋 Connections closed")

def main():
    print("=" * 60)
    print("🔄 OPENCART → RENTALHUB SYNC")
    print("=" * 60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    sync = SyncManager()
    
    if not sync.connect():
        return
    
    # Run sync operations
    sync.sync_categories()
    sync.sync_products()
    sync.sync_orders()
    sync.migrate_inventory_data()
    
    sync.close()
    
    print("\n" + "=" * 60)
    print("✅ SYNC COMPLETED!")
    print("=" * 60)

if __name__ == "__main__":
    main()
