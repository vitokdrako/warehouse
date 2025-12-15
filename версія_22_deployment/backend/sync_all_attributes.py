"""
Fast sync script to update colors, materials and dimensions for all products
"""
import mysql.connector
from datetime import datetime

OC = {'host': 'farforre.mysql.tools', 'database': 'farforre_db',
      'user': 'farforre_db', 'password': 'gPpAHTvv', 'charset': 'utf8mb4'}
RH = {'host': 'farforre.mysql.tools', 'database': 'farforre_rentalhub',
      'user': 'farforre_rentalhub', 'password': '-nu+3Gp54L', 'charset': 'utf8mb4'}

print("=" * 70)
print("🎨 SYNCING ALL PRODUCT ATTRIBUTES (Color, Material, Dimensions)")
print("=" * 70)
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
    
    # Process in batches of 500 (faster!)
    batch_size = 500
    total_updated = 0
    with_color = 0
    with_material = 0
    with_size = 0
    
    print("Processing batches...")
    for i in range(0, len(product_ids), batch_size):
        batch = product_ids[i:i+batch_size]
        ids_str = ','.join(map(str, batch))
        
        # Get all data in one query (attributes + dimensions)
        # IMPORTANT: Filter by pa.language_id = 4 for Ukrainian text!
        oc_cur.execute(f"""
            SELECT 
                p.product_id,
                p.width,
                p.length,
                p.height,
                MAX(CASE WHEN ad.name = 'Колір' AND pa.language_id = 4 THEN pa.text END) as color,
                MAX(CASE WHEN ad.name = 'Матеріал' AND pa.language_id = 4 THEN pa.text END) as material
            FROM oc_product p
            LEFT JOIN oc_product_attribute pa ON p.product_id = pa.product_id
            LEFT JOIN oc_attribute_description ad ON pa.attribute_id = ad.attribute_id AND ad.language_id = 4
            WHERE p.product_id IN ({ids_str})
            GROUP BY p.product_id
        """)
        
        products = oc_cur.fetchall()
        
        # Update in RentalHub
        for p in products:
            color = p['color']
            material = p['material']
            
            # Format size as "Width×Length×Height cm"
            size = None
            dims = []
            if p['width'] and float(p['width']) > 0:
                dims.append(f"{float(p['width']):.0f}")
            if p['length'] and float(p['length']) > 0:
                dims.append(f"{float(p['length']):.0f}")
            if p['height'] and float(p['height']) > 0:
                dims.append(f"{float(p['height']):.0f}")
            
            if dims:
                if len(dims) == 3:
                    size = f"{dims[0]}×{dims[1]}×{dims[2]} см"
                elif len(dims) == 2:
                    size = f"{dims[0]}×{dims[1]} см"
                elif len(dims) == 1:
                    size = f"{dims[0]} см"
            
            rh_cur.execute("""
                UPDATE products 
                SET color = %s, material = %s, size = %s
                WHERE product_id = %s
            """, (color, material, size, p['product_id']))
            
            total_updated += 1
            if color:
                with_color += 1
            if material:
                with_material += 1
            if size:
                with_size += 1
        
        rh.commit()
        progress = min(i + batch_size, len(product_ids))
        print(f"  [{progress}/{len(product_ids)}] Processed batch {i//batch_size + 1}")
    
    print(f"\n✅ COMPLETED: Updated {total_updated} products")
    print(f"   - With color: {with_color}")
    print(f"   - With material: {with_material}")
    print(f"   - With size: {with_size}")
    
    # Show samples
    print("\nSample products with full attributes:")
    rh_cur.execute("""
        SELECT product_id, name, color, material, size 
        FROM products 
        WHERE (color IS NOT NULL OR material IS NOT NULL OR size IS NOT NULL)
        ORDER BY RAND()
        LIMIT 5
    """)
    
    for row in rh_cur.fetchall():
        print(f"\n  Product ID: {row[0]}")
        print(f"  Name: {row[1][:50]}")
        print(f"  Color: {row[2] or '-'}")
        print(f"  Material: {row[3] or '-'}")
        print(f"  Size: {row[4] or '-'}")
    
    oc_cur.close()
    rh_cur.close()
    oc.close()
    rh.close()
    
    print("\n" + "=" * 70)
    print("✅ SYNC COMPLETED")
    print("=" * 70)
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
