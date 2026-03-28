"""
One-time script to update colors and materials from OpenCart attributes
"""
import mysql.connector
from datetime import datetime

OC = {'host': 'farforre.mysql.tools', 'database': 'farforre_db',
      'user': 'farforre_db', 'password': 'gPpAHTvv', 'charset': 'utf8mb4'}
RH = {'host': 'farforre.mysql.tools', 'database': 'farforre_rentalhub',
      'user': 'farforre_rentalhub', 'password': '-nu+3Gp54L', 'charset': 'utf8mb4'}

print("=" * 60)
print("🎨 UPDATING COLORS AND MATERIALS")
print("=" * 60)
print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

try:
    oc = mysql.connector.connect(**OC)
    rh = mysql.connector.connect(**RH)
    
    oc_cur = oc.cursor(dictionary=True)
    rh_cur = rh.cursor()
    
    # Get all product IDs from RentalHub
    print("Loading product IDs from RentalHub...")
    rh_cur.execute("SELECT product_id FROM products")
    product_ids = [row[0] for row in rh_cur.fetchall()]
    print(f"Found {len(product_ids)} products\n")
    
    if not product_ids:
        print("No products found!")
        exit(0)
    
    # Process in batches of 100
    batch_size = 100
    total_updated = 0
    products_with_color = 0
    products_with_material = 0
    
    for i in range(0, len(product_ids), batch_size):
        batch = product_ids[i:i+batch_size]
        ids_str = ','.join(map(str, batch))
        
        # Get colors and materials from OpenCart attributes
        oc_cur.execute(f"""
            SELECT 
                p.product_id,
                MAX(CASE WHEN ad.name = 'Колір' THEN pa.text END) as color,
                MAX(CASE WHEN ad.name = 'Матеріал' THEN pa.text END) as material
            FROM oc_product p
            LEFT JOIN oc_product_attribute pa ON p.product_id = pa.product_id
            LEFT JOIN oc_attribute_description ad ON pa.attribute_id = ad.attribute_id AND ad.language_id = 4
            WHERE p.product_id IN ({ids_str})
            GROUP BY p.product_id
        """)
        
        attributes = oc_cur.fetchall()
        
        # Update in RentalHub
        for p in attributes:
            color = p['color']
            material = p['material']
            
            if color or material:
                rh_cur.execute("""
                    UPDATE products 
                    SET color = %s, material = %s
                    WHERE product_id = %s
                """, (color, material, p['product_id']))
                
                total_updated += 1
                if color:
                    products_with_color += 1
                if material:
                    products_with_material += 1
        
        rh.commit()
        print(f"  Processed {min(i+batch_size, len(product_ids))}/{len(product_ids)} products...")
    
    print(f"\n✅ Updated {total_updated} products")
    print(f"   - Products with color: {products_with_color}")
    print(f"   - Products with material: {products_with_material}")
    
    # Show sample
    rh_cur.execute("""
        SELECT product_id, name, color, material 
        FROM products 
        WHERE color IS NOT NULL OR material IS NOT NULL
        LIMIT 5
    """)
    
    print("\nSample products with attributes:")
    for row in rh_cur.fetchall():
        print(f"  ID: {row[0]}, Name: {row[1][:30]}, Color: {row[2]}, Material: {row[3]}")
    
    oc_cur.close()
    rh_cur.close()
    oc.close()
    rh.close()
    
    print("\n" + "=" * 60)
    print("✅ COMPLETED")
    print("=" * 60)
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
