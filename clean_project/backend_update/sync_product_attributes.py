"""
Sync product attributes (color, material, size) from OpenCart to RentalHub
"""
import mysql.connector

OC = {'host': 'farforre.mysql.tools', 'database': 'farforre_db',
      'user': 'farforre_db', 'password': 'gPpAHTvv'}
RH = {'host': 'farforre.mysql.tools', 'database': 'farforre_rentalhub',
      'user': 'farforre_rentalhub', 'password': '-nu+3Gp54L'}

def sync_attributes():
    print("🎨 Syncing product attributes...")
    
    oc_conn = mysql.connector.connect(**OC)
    rh_conn = mysql.connector.connect(**RH)
    
    oc_cur = oc_conn.cursor(dictionary=True)
    rh_cur = rh_conn.cursor()
    
    # Get product IDs from RentalHub
    rh_cur.execute("SELECT product_id FROM products")
    product_ids = [row[0] for row in rh_cur.fetchall()]
    
    print(f"  Processing {len(product_ids)} products...")
    
    # Process in batches
    batch_size = 100
    updated = 0
    
    for i in range(0, len(product_ids), batch_size):
        batch = product_ids[i:i+batch_size]
        ids_str = ','.join(map(str, batch))
        
        # Get attributes from OpenCart
        # attribute_id 13 = Color, 16 = Material
        oc_cur.execute(f"""
            SELECT 
                pa.product_id,
                MAX(CASE WHEN pa.attribute_id = 13 THEN pa.text END) as color,
                MAX(CASE WHEN pa.attribute_id = 16 THEN pa.text END) as material
            FROM oc_product_attribute pa
            WHERE pa.product_id IN ({ids_str}) AND pa.language_id = 4
            GROUP BY pa.product_id
        """)
        
        attrs = oc_cur.fetchall()
        
        # Update RentalHub
        for attr in attrs:
            rh_cur.execute("""
                UPDATE products 
                SET color = %s, material = %s
                WHERE product_id = %s
            """, (attr['color'], attr['material'], attr['product_id']))
            updated += 1
        
        rh_conn.commit()
        
        if (i + batch_size) % 500 == 0:
            print(f"  Updated {updated}/{len(product_ids)}...")
    
    print(f"  ✅ Updated {updated} products")
    
    # Verify
    rh_cur.execute("SELECT COUNT(*) FROM products WHERE color IS NOT NULL")
    with_color = rh_cur.fetchone()[0]
    rh_cur.execute("SELECT COUNT(*) FROM products WHERE material IS NOT NULL")
    with_material = rh_cur.fetchone()[0]
    
    print(f"\n📊 Results:")
    print(f"  - Products with color: {with_color}")
    print(f"  - Products with material: {with_material}")
    
    oc_cur.close()
    rh_cur.close()
    oc_conn.close()
    rh_conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("🎨 SYNC PRODUCT ATTRIBUTES")
    print("=" * 60)
    sync_attributes()
    print("\n✅ Done!")
