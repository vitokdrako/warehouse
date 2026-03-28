"""
Fast sync with batch inserts
"""
import mysql.connector
from datetime import datetime

OC_DB = {
    'host': 'farforre.mysql.tools',
    'database': 'farforre_db',
    'user': 'farforre_db',
    'password': 'gPpAHTvv',
    'charset': 'utf8mb4'
}

RH_DB = {
    'host': 'farforre.mysql.tools',
    'database': 'farforre_rentalhub',
    'user': 'farforre_rentalhub',
    'password': '-nu+3Gp54L',
    'charset': 'utf8mb4'
}

def clear_and_sync_categories():
    """Clear and sync categories"""
    print("\n📁 Syncing categories...")
    oc = mysql.connector.connect(**OC_DB)
    rh = mysql.connector.connect(**RH_DB)
    
    oc_cur = oc.cursor(dictionary=True)
    rh_cur = rh.cursor()
    
    # Clear
    rh_cur.execute("TRUNCATE TABLE categories")
    
    # Get categories
    oc_cur.execute("""
        SELECT c.category_id, c.parent_id, cd.name, c.sort_order, c.status
        FROM oc_category c
        JOIN oc_category_description cd ON c.category_id = cd.category_id
        WHERE cd.language_id = 4
    """)
    
    categories = oc_cur.fetchall()
    
    # Batch insert
    values = [(c['category_id'], c['parent_id'], c['name'], c['sort_order'], c['status']) 
              for c in categories]
    
    rh_cur.executemany("""
        INSERT INTO categories (category_id, parent_id, name, sort_order, status, synced_at)
        VALUES (%s, %s, %s, %s, %s, NOW())
    """, values)
    
    rh.commit()
    print(f"  ✅ Synced {len(values)} categories")
    
    oc_cur.close()
    rh_cur.close()
    oc.close()
    rh.close()
    return len(values)

def clear_and_sync_products():
    """Clear and sync products - in batches"""
    print("\n📦 Syncing products...")
    oc = mysql.connector.connect(**OC_DB)
    rh = mysql.connector.connect(**RH_DB)
    
    oc_cur = oc.cursor(dictionary=True)
    rh_cur = rh.cursor()
    
    # Clear
    rh_cur.execute("SET FOREIGN_KEY_CHECKS=0")
    rh_cur.execute("TRUNCATE TABLE products")
    rh_cur.execute("SET FOREIGN_KEY_CHECKS=1")
    
    # Get products in smaller batches
    batch_size = 500
    offset = 0
    total = 0
    
    while True:
        print(f"  Fetching products {offset} to {offset + batch_size}...")
        oc_cur.execute(f"""
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
            WHERE pd.language_id = 4
            LIMIT {batch_size} OFFSET {offset}
        """)
        
        products = oc_cur.fetchall()
        if not products:
            break
        
        # Batch insert
        values = []
        for prod in products:
            sku = prod['sku'] or f"SKU-{prod['product_id']}"
            values.append((
                prod['product_id'], sku, prod['name'][:500], 
                (prod['description'] or '')[:1000],
                prod['price'], prod['status'], prod['image']
            ))
        
        rh_cur.executemany("""
            INSERT INTO products (product_id, sku, name, description, price, status, image_url, synced_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """, values)
        
        rh.commit()
        total += len(values)
        print(f"  ✅ Inserted {len(values)} products (total: {total})")
        
        offset += batch_size
        
        # Limit to 2000 products for now
        if total >= 2000:
            break
    
    print(f"  ✅ Total synced: {total} products")
    
    oc_cur.close()
    rh_cur.close()
    oc.close()
    rh.close()
    return total

def update_product_categories():
    """Update category info for products"""
    print("\n🏷️  Updating product categories...")
    oc = mysql.connector.connect(**OC_DB)
    rh = mysql.connector.connect(**RH_DB)
    
    oc_cur = oc.cursor(dictionary=True)
    rh_cur = rh.cursor()
    
    # Get product-category-parent info
    oc_cur.execute("""
        SELECT 
            ptc.product_id,
            c.category_id,
            cd.name as cat_name,
            c.parent_id,
            CASE 
                WHEN c.parent_id = 0 THEN cd.name
                ELSE pcd.name 
            END as main_category_name,
            CASE 
                WHEN c.parent_id = 0 THEN NULL
                ELSE cd.name 
            END as sub_category_name
        FROM oc_product_to_category ptc
        JOIN oc_category c ON ptc.category_id = c.category_id
        JOIN oc_category_description cd ON c.category_id = cd.category_id AND cd.language_id = 4
        LEFT JOIN oc_category pc ON c.parent_id = pc.category_id
        LEFT JOIN oc_category_description pcd ON pc.category_id = pcd.category_id AND pcd.language_id = 4
        WHERE ptc.product_id IN (SELECT product_id FROM farforre_rentalhub.products)
    """)
    
    mappings = oc_cur.fetchall()
    count = 0
    
    for m in mappings:
        if m['parent_id'] == 0:
            # Main category
            rh_cur.execute("""
                UPDATE products 
                SET category_id = %s, category_name = %s
                WHERE product_id = %s
            """, (m['category_id'], m['cat_name'], m['product_id']))
        else:
            # Parent + subcategory
            rh_cur.execute("""
                UPDATE products 
                SET category_id = %s, category_name = %s,
                    subcategory_id = %s, subcategory_name = %s
                WHERE product_id = %s
            """, (m['parent_id'], m['main_category_name'], 
                  m['category_id'], m['sub_category_name'], m['product_id']))
        count += 1
        
        if count % 500 == 0:
            rh.commit()
            print(f"  Updated {count} mappings...")
    
    rh.commit()
    print(f"  ✅ Updated {count} product categories")
    
    oc_cur.close()
    rh_cur.close()
    oc.close()
    rh.close()
    return count

def verify():
    """Quick verification"""
    print("\n🔍 Verification:")
    rh = mysql.connector.connect(**RH_DB)
    cur = rh.cursor(dictionary=True)
    
    # Categories
    cur.execute("SELECT COUNT(*) as cnt FROM categories")
    print(f"  - Categories: {cur.fetchone()['cnt']}")
    
    # Products
    cur.execute("SELECT COUNT(*) as cnt FROM products")
    print(f"  - Products: {cur.fetchone()['cnt']}")
    
    # Products with categories
    cur.execute("SELECT COUNT(*) as cnt FROM products WHERE category_name IS NOT NULL")
    print(f"  - Products with categories: {cur.fetchone()['cnt']}")
    
    # Sample products
    cur.execute("SELECT product_id, sku, name, category_name, subcategory_name FROM products LIMIT 5")
    print("\n  Sample products:")
    for p in cur.fetchall():
        cat = f"{p['category_name']}" + (f" → {p['subcategory_name']}" if p['subcategory_name'] else "")
        print(f"    - {p['sku']}: {p['name'][:40]}... ({cat})")
    
    cur.close()
    rh.close()

def main():
    print("=" * 60)
    print("🚀 FAST SYNC: OpenCart → RentalHub")
    print("=" * 60)
    
    start_time = datetime.now()
    
    try:
        clear_and_sync_categories()
        clear_and_sync_products()
        update_product_categories()
        verify()
        
        duration = (datetime.now() - start_time).total_seconds()
        print("\n" + "=" * 60)
        print(f"✅ SYNC COMPLETED in {duration:.1f} seconds!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
