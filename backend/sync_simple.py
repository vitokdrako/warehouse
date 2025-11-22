"""
Simplified sync script - step by step
"""
import mysql.connector
from datetime import datetime

# OpenCart DB
OC_DB = {
    'host': 'farforre.mysql.tools',
    'database': 'farforre_db',
    'user': 'farforre_db',
    'password': 'gPpAHTvv',
    'charset': 'utf8mb4'
}

# RentalHub DB
RH_DB = {
    'host': 'farforre.mysql.tools',
    'database': 'farforre_rentalhub',
    'user': 'farforre_rentalhub',
    'password': '-nu+3Gp54L',
    'charset': 'utf8mb4'
}

def sync_categories():
    """Sync categories"""
    print("\n📁 Syncing categories...")
    oc = mysql.connector.connect(**OC_DB)
    rh = mysql.connector.connect(**RH_DB)
    
    oc_cur = oc.cursor(dictionary=True)
    rh_cur = rh.cursor()
    
    # Get categories
    oc_cur.execute("""
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
    
    categories = oc_cur.fetchall()
    count = 0
    
    for cat in categories:
        rh_cur.execute("""
            INSERT INTO categories (category_id, parent_id, name, sort_order, status, synced_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON DUPLICATE KEY UPDATE
                parent_id = VALUES(parent_id),
                name = VALUES(name),
                synced_at = NOW()
        """, (cat['category_id'], cat['parent_id'], cat['name'], cat['sort_order'], cat['status']))
        count += 1
    
    rh.commit()
    oc_cur.close()
    rh_cur.close()
    oc.close()
    rh.close()
    
    print(f"  ✅ Synced {count} categories")
    return count

def sync_products():
    """Sync products with simplified query"""
    print("\n📦 Syncing products...")
    oc = mysql.connector.connect(**OC_DB)
    rh = mysql.connector.connect(**RH_DB)
    
    oc_cur = oc.cursor(dictionary=True)
    rh_cur = rh.cursor()
    
    # Simple products query
    oc_cur.execute("""
        SELECT 
            p.product_id,
            p.model as sku,
            pd.name,
            pd.description,
            p.price,
            p.status,
            p.image
        FROM oc_product p
        JOIN oc_product_description pd ON p.product_id = pd.product_id
        WHERE pd.language_id = 4 AND p.status = 1
        LIMIT 100
    """)
    
    products = oc_cur.fetchall()
    count = 0
    
    for prod in products:
        sku = prod['sku'] or f"SKU-{prod['product_id']}"
        
        rh_cur.execute("""
            INSERT INTO products (
                product_id, sku, name, description, price, status, image_url, synced_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                price = VALUES(price),
                synced_at = NOW()
        """, (
            prod['product_id'], sku, prod['name'], prod['description'],
            prod['price'], prod['status'], prod['image']
        ))
        count += 1
    
    rh.commit()
    oc_cur.close()
    rh_cur.close()
    oc.close()
    rh.close()
    
    print(f"  ✅ Synced {count} products")
    return count

def sync_product_categories():
    """Add category info to products"""
    print("\n🏷️  Adding categories to products...")
    oc = mysql.connector.connect(**OC_DB)
    rh = mysql.connector.connect(**RH_DB)
    
    oc_cur = oc.cursor(dictionary=True)
    rh_cur = rh.cursor()
    
    # Get product-category mappings
    oc_cur.execute("""
        SELECT 
            ptc.product_id,
            ptc.category_id,
            cd.name as category_name,
            c.parent_id
        FROM oc_product_to_category ptc
        JOIN oc_category c ON ptc.category_id = c.category_id
        JOIN oc_category_description cd ON c.category_id = cd.category_id
        WHERE cd.language_id = 4
    """)
    
    mappings = oc_cur.fetchall()
    count = 0
    
    for mapping in mappings:
        if mapping['parent_id'] == 0:
            # Main category
            rh_cur.execute("""
                UPDATE products 
                SET category_id = %s, category_name = %s
                WHERE product_id = %s
            """, (mapping['category_id'], mapping['category_name'], mapping['product_id']))
        else:
            # Subcategory
            rh_cur.execute("""
                UPDATE products 
                SET subcategory_id = %s, subcategory_name = %s
                WHERE product_id = %s
            """, (mapping['category_id'], mapping['category_name'], mapping['product_id']))
        count += 1
    
    rh.commit()
    oc_cur.close()
    rh_cur.close()
    oc.close()
    rh.close()
    
    print(f"  ✅ Updated {count} product-category mappings")
    return count

def sync_decor_orders():
    """Sync orders from decor_orders table"""
    print("\n📋 Syncing decor_orders...")
    oc = mysql.connector.connect(**OC_DB)
    rh = mysql.connector.connect(**RH_DB)
    
    oc_cur = oc.cursor(dictionary=True)
    rh_cur = rh.cursor()
    
    # Check if decor_orders exists
    try:
        oc_cur.execute("""
            SELECT 
                id,
                order_number,
                client_name,
                client_phone,
                client_email,
                rent_date,
                rent_return_date,
                rental_days,
                total,
                deposit,
                status,
                created_at
            FROM decor_orders
            LIMIT 1000
        """)
        
        orders = oc_cur.fetchall()
        count = 0
        
        for order in orders:
            rh_cur.execute("""
                INSERT INTO orders (
                    order_id, order_number, customer_name, customer_phone, customer_email,
                    rental_start_date, rental_end_date, rental_days,
                    total_amount, deposit_amount, status, created_at, synced_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE
                    status = VALUES(status),
                    synced_at = NOW()
            """, (
                order['id'], order['order_number'], order['client_name'],
                order['client_phone'], order['client_email'],
                order['rent_date'], order['rent_return_date'], order['rental_days'],
                order['total'], order['deposit'], order['status'], order['created_at']
            ))
            count += 1
        
        rh.commit()
        print(f"  ✅ Synced {count} orders")
        
    except Exception as e:
        print(f"  ⚠️  decor_orders not found or error: {e}")
    
    oc_cur.close()
    rh_cur.close()
    oc.close()
    rh.close()

def verify_data():
    """Verify synced data"""
    print("\n🔍 Verifying data...")
    rh = mysql.connector.connect(**RH_DB)
    cur = rh.cursor()
    
    tables = ['categories', 'products', 'orders']
    for table in tables:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        count = cur.fetchone()[0]
        print(f"  - {table}: {count} records")
    
    cur.close()
    rh.close()

def main():
    print("=" * 60)
    print("🔄 SIMPLIFIED SYNC: OpenCart → RentalHub")
    print("=" * 60)
    print(f"Started: {datetime.now().strftime('%H:%M:%S')}\n")
    
    try:
        sync_categories()
        sync_products()
        sync_product_categories()
        sync_decor_orders()
        verify_data()
        
        print("\n" + "=" * 60)
        print("✅ SYNC COMPLETED!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
