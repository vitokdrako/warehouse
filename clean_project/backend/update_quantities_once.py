"""
One-time script to update product quantities from OpenCart
"""
import mysql.connector
from datetime import datetime

OC = {'host': 'farforre.mysql.tools', 'database': 'farforre_db',
      'user': 'farforre_db', 'password': 'gPpAHTvv', 'charset': 'utf8mb4'}
RH = {'host': 'farforre.mysql.tools', 'database': 'farforre_rentalhub',
      'user': 'farforre_rentalhub', 'password': '-nu+3Gp54L', 'charset': 'utf8mb4'}

print("=" * 60)
print("📊 UPDATING PRODUCT QUANTITIES")
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
    print(f"Found {len(product_ids)} products")
    
    if not product_ids:
        print("No products found!")
        exit(0)
    
    # Process in batches of 100
    batch_size = 100
    total_updated = 0
    
    for i in range(0, len(product_ids), batch_size):
        batch = product_ids[i:i+batch_size]
        ids_str = ','.join(map(str, batch))
        
        # Get quantities from OpenCart
        oc_cur.execute(f"""
            SELECT product_id, quantity
            FROM oc_product
            WHERE product_id IN ({ids_str})
        """)
        
        quantities = oc_cur.fetchall()
        
        # Update in RentalHub
        for p in quantities:
            rh_cur.execute("""
                UPDATE products SET quantity = %s WHERE product_id = %s
            """, (p['quantity'] or 0, p['product_id']))
            total_updated += 1
        
        rh.commit()
        print(f"  Processed {total_updated}/{len(product_ids)} products...")
    
    print(f"\n✅ Updated {total_updated} product quantities")
    
    # Show sample
    rh_cur.execute("SELECT product_id, name, quantity FROM products WHERE quantity > 0 LIMIT 5")
    print("\nSample products with quantity:")
    for row in rh_cur.fetchall():
        print(f"  ID: {row[0]}, Name: {row[1][:40]}, Qty: {row[2]}")
    
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
