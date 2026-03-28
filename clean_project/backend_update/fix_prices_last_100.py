"""
Fix prices for last 100 products
Перевіряє і виправляє ціни з OpenCart для останніх 100 товарів
"""
import mysql.connector
from datetime import datetime

# OpenCart
OC = {'host': 'farforre.mysql.tools', 'database': 'farforre_db',
      'user': 'farforre_db', 'password': 'gPpAHTvv', 'charset': 'utf8mb4'}

# RentalHub
RH = {'host': 'farforre.mysql.tools', 'database': 'farforre_rentalhub',
      'user': 'farforre_rentalhub', 'password': '-nu+3Gp54L', 'charset': 'utf8mb4'}

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def fix_prices():
    """Fix prices for last 100 products"""
    log("🔧 Fixing prices for last 100 products...")
    
    try:
        oc = mysql.connector.connect(**OC)
        rh = mysql.connector.connect(**RH)
        
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor(dictionary=True)
        
        # Get last 100 products from RentalHub
        rh_cur.execute("""
            SELECT product_id, sku, name, price, rental_price
            FROM products
            ORDER BY product_id DESC
            LIMIT 100
        """)
        
        rh_products = rh_cur.fetchall()
        log(f"📦 Found {len(rh_products)} products in RentalHub")
        
        fixed_count = 0
        errors = []
        
        for rh_prod in rh_products:
            product_id = rh_prod['product_id']
            
            # Get prices from OpenCart
            oc_cur.execute("""
                SELECT 
                    product_id, 
                    model as sku,
                    price as rental_price,  -- OpenCart price = наша rental_price
                    ean as price           -- OpenCart ean = наша роздрібна price
                FROM oc_product
                WHERE product_id = %s
            """, (product_id,))
            
            oc_prod = oc_cur.fetchone()
            
            if not oc_prod:
                errors.append(f"Product {product_id} not found in OpenCart")
                continue
            
            # Check if prices match
            oc_rental = float(oc_prod['rental_price']) if oc_prod['rental_price'] else 0
            oc_price = float(oc_prod['price']) if oc_prod['price'] else 0
            rh_rental = float(rh_prod['rental_price']) if rh_prod['rental_price'] else 0
            rh_price = float(rh_prod['price']) if rh_prod['price'] else 0
            
            if oc_rental != rh_rental or oc_price != rh_price:
                log(f"  ⚠️ {rh_prod['sku']} - {rh_prod['name'][:40]}")
                log(f"     OpenCart: rental={oc_rental}, price={oc_price}")
                log(f"     RentalHub: rental={rh_rental}, price={rh_price}")
                
                # Fix prices
                rh_cur.execute("""
                    UPDATE products
                    SET rental_price = %s, price = %s, synced_at = NOW()
                    WHERE product_id = %s
                """, (oc_rental, oc_price, product_id))
                
                fixed_count += 1
                log(f"     ✅ Fixed!")
        
        rh.commit()
        
        log(f"\n📊 Summary:")
        log(f"  Checked: {len(rh_products)} products")
        log(f"  Fixed: {fixed_count} products")
        log(f"  Errors: {len(errors)}")
        
        if errors:
            log(f"\n❌ Errors:")
            for err in errors[:10]:
                log(f"  {err}")
        
        # Show sample of fixed data
        log(f"\n📋 Sample of data after fix:")
        rh_cur.execute("""
            SELECT sku, name, rental_price, price
            FROM products
            ORDER BY product_id DESC
            LIMIT 5
        """)
        
        for row in rh_cur.fetchall():
            log(f"  {row['sku']}: rental={row['rental_price']}, price={row['price']} - {row['name'][:40]}")
        
        oc_cur.close()
        rh_cur.close()
        oc.close()
        rh.close()
        
        return fixed_count
        
    except Exception as e:
        log(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 0

if __name__ == "__main__":
    log("🚀 Starting price fix...")
    fixed = fix_prices()
    log(f"✅ Done! Fixed {fixed} products")
