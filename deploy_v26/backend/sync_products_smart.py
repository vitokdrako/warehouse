"""
Smart products sync - small batches with progress
"""
import mysql.connector
import time

OC = {'host': 'farforre.mysql.tools', 'database': 'farforre_db',
      'user': 'farforre_db', 'password': 'gPpAHTvv', 'charset': 'utf8mb4'}
RH = {'host': 'farforre.mysql.tools', 'database': 'farforre_rentalhub',
      'user': 'farforre_rentalhub', 'password': '-nu+3Gp54L', 'charset': 'utf8mb4'}

def sync_products_batch(batch_size=50, max_products=2000):
    """Sync products in small batches"""
    print(f"\n📦 Starting products sync (batch={batch_size}, max={max_products})...")
    
    oc_conn = mysql.connector.connect(**OC)
    rh_conn = mysql.connector.connect(**RH)
    
    oc_cur = oc_conn.cursor(dictionary=True)
    rh_cur = rh_conn.cursor()
    
    offset = 0
    total_synced = 0
    start_time = time.time()
    
    # Clear test data
    rh_cur.execute("DELETE FROM products WHERE product_id = 1")
    rh_conn.commit()
    
    while total_synced < max_products:
        batch_start = time.time()
        print(f"\n  Batch {offset//batch_size + 1}: Fetching products {offset} - {offset + batch_size}...")
        
        # Fetch batch from OpenCart
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
            WHERE pd.language_id = 4 AND p.status = 1
            ORDER BY p.product_id
            LIMIT {batch_size} OFFSET {offset}
        """)
        
        products = oc_cur.fetchall()
        
        if not products:
            print(f"  ✅ No more products. Stopping.")
            break
        
        print(f"  📥 Fetched {len(products)} products in {time.time() - batch_start:.2f}s")
        
        # Prepare values
        values = []
        for p in products:
            sku = p['sku'] or f"SKU-{p['product_id']}"
            # Truncate description to avoid issues
            desc = (p['description'] or '')[:2000] if p['description'] else None
            values.append((
                p['product_id'], 
                sku[:100],  # Truncate sku
                p['name'][:500],  # Truncate name
                desc,
                p['price'],
                p['status'],
                p['image'][:500] if p['image'] else None
            ))
        
        # Batch insert
        insert_start = time.time()
        print(f"  💾 Inserting {len(values)} products...")
        
        rh_cur.executemany("""
            INSERT INTO products (product_id, sku, name, description, price, status, image_url, synced_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """, values)
        
        rh_conn.commit()
        
        total_synced += len(values)
        batch_time = time.time() - batch_start
        print(f"  ✅ Inserted in {time.time() - insert_start:.2f}s (batch total: {batch_time:.2f}s)")
        print(f"  📊 Progress: {total_synced}/{max_products} products ({total_synced*100/max_products:.1f}%)")
        
        offset += batch_size
        
        # Small delay to not overload DB
        time.sleep(0.5)
    
    oc_cur.close()
    rh_cur.close()
    oc_conn.close()
    rh_conn.close()
    
    total_time = time.time() - start_time
    print(f"\n✅ Sync completed!")
    print(f"   Total products: {total_synced}")
    print(f"   Total time: {total_time:.1f}s")
    print(f"   Speed: {total_synced/total_time:.1f} products/sec")
    
    return total_synced

def update_categories():
    """Add category info to synced products"""
    print(f"\n🏷️  Updating product categories...")
    
    oc_conn = mysql.connector.connect(**OC)
    rh_conn = mysql.connector.connect(**RH)
    
    oc_cur = oc_conn.cursor(dictionary=True)
    rh_cur = rh_conn.cursor()
    
    # Get mappings
    oc_cur.execute("""
        SELECT 
            ptc.product_id,
            c.category_id,
            cd.name as cat_name,
            c.parent_id,
            parent_cd.name as parent_name
        FROM oc_product_to_category ptc
        JOIN oc_category c ON ptc.category_id = c.category_id
        JOIN oc_category_description cd ON c.category_id = cd.category_id AND cd.language_id = 4
        LEFT JOIN oc_category parent ON c.parent_id = parent.category_id
        LEFT JOIN oc_category_description parent_cd ON parent.category_id = parent_cd.category_id AND parent_cd.language_id = 4
        WHERE ptc.product_id IN (SELECT product_id FROM farforre_rentalhub.products)
    """)
    
    mappings = oc_cur.fetchall()
    print(f"  Found {len(mappings)} category mappings")
    
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
            # Subcategory
            rh_cur.execute("""
                UPDATE products 
                SET category_id = %s, category_name = %s,
                    subcategory_id = %s, subcategory_name = %s
                WHERE product_id = %s
            """, (m['parent_id'], m['parent_name'], 
                  m['category_id'], m['cat_name'], m['product_id']))
        
        count += 1
        if count % 200 == 0:
            rh_conn.commit()
            print(f"  Updated {count} mappings...")
    
    rh_conn.commit()
    print(f"  ✅ Updated {count} product categories")
    
    oc_cur.close()
    rh_cur.close()
    oc_conn.close()
    rh_conn.close()

def verify():
    """Verify synced data"""
    print(f"\n🔍 Verification:")
    
    rh_conn = mysql.connector.connect(**RH)
    cur = rh_conn.cursor(dictionary=True)
    
    cur.execute("SELECT COUNT(*) as cnt FROM products")
    total = cur.fetchone()['cnt']
    print(f"  - Total products: {total}")
    
    cur.execute("SELECT COUNT(*) as cnt FROM products WHERE category_name IS NOT NULL")
    with_cat = cur.fetchone()['cnt']
    print(f"  - Products with category: {with_cat}")
    
    cur.execute("SELECT COUNT(*) as cnt FROM products WHERE subcategory_name IS NOT NULL")
    with_subcat = cur.fetchone()['cnt']
    print(f"  - Products with subcategory: {with_subcat}")
    
    print(f"\n  Sample products:")
    cur.execute("""
        SELECT product_id, sku, name, category_name, subcategory_name, price
        FROM products 
        WHERE category_name IS NOT NULL
        LIMIT 5
    """)
    for p in cur.fetchall():
        cat = p['category_name'] or 'No category'
        if p['subcategory_name']:
            cat += f" → {p['subcategory_name']}"
        print(f"    - [{p['sku']}] {p['name'][:40]}... | {cat} | {p['price']} UAH")
    
    cur.close()
    rh_conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 SMART PRODUCTS SYNC")
    print("=" * 60)
    
    try:
        # Sync products (2000 max for now)
        sync_products_batch(batch_size=50, max_products=2000)
        
        # Update categories
        update_categories()
        
        # Verify
        verify()
        
        print("\n" + "=" * 60)
        print("✅ PRODUCTS SYNC COMPLETED!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
