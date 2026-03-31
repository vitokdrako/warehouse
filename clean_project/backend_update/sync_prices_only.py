"""
Quick sync script - syncs only PRICE, EAN, QUANTITY from OpenCart to RentalHub
Use this after bulk price updates
"""
import mysql.connector
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

def log(msg):
    """Log with timestamp"""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def sync_prices_and_quantities():
    """Sync ONLY price, ean, quantity - very fast"""
    log("💰 Syncing prices, EAN and quantities...")
    
    try:
        # Connect to OpenCart
        oc = mysql.connector.connect(
            host=os.getenv('OC_DB_HOST'),
            port=int(os.getenv('OC_DB_PORT', 3306)),
            database=os.getenv('OC_DB_DATABASE'),
            user=os.getenv('OC_DB_USERNAME'),
            password=os.getenv('OC_DB_PASSWORD'),
            charset='utf8mb4'
        )
        
        # Connect to RentalHub
        rh = mysql.connector.connect(
            host=os.getenv('RH_DB_HOST'),
            port=int(os.getenv('RH_DB_PORT', 3306)),
            database=os.getenv('RH_DB_DATABASE'),
            user=os.getenv('RH_DB_USERNAME'),
            password=os.getenv('RH_DB_PASSWORD'),
            charset='utf8mb4'
        )
        
        oc_cur = oc.cursor(dictionary=True)
        rh_cur = rh.cursor()
        
        # Get all products with their prices from OpenCart
        log("  Отримую дані з OpenCart...")
        oc_cur.execute("""
            SELECT 
                product_id,
                price,
                ean,
                quantity
            FROM oc_product
        """)
        
        products = oc_cur.fetchall()
        log(f"  Знайдено {len(products)} товарів")
        
        # Update RentalHub in batches
        log("  Оновлюю RentalHub DB...")
        log("  ВАЖЛИВО: OpenCart.price → RentalHub.rental_price (ціна оренди)")
        log("  ВАЖЛИВО: OpenCart.ean → RentalHub.price (вартість збитків)")
        updated = 0
        batch_size = 1000
        
        for i in range(0, len(products), batch_size):
            batch = products[i:i + batch_size]
            
            for prod in batch:
                # ПРАВИЛЬНА ЛОГІКА:
                # OpenCart.price (ціна оренди) → RentalHub.rental_price
                # OpenCart.ean (вартість збитків) → RentalHub.price
                rh_cur.execute("""
                    UPDATE products 
                    SET 
                        rental_price = %s,
                        price = %s,
                        quantity = %s
                    WHERE product_id = %s
                """, (
                    prod['price'],              # OpenCart price → rental_price
                    prod['ean'] if prod['ean'] else 0,  # OpenCart ean → price
                    prod['quantity'],
                    prod['product_id']
                ))
                
                if rh_cur.rowcount > 0:
                    updated += 1
            
            rh.commit()
            log(f"  Прогрес: {min(i + batch_size, len(products))}/{len(products)}")
        
        log(f"  ✅ Оновлено {updated} товарів")
        
        oc_cur.close()
        rh_cur.close()
        oc.close()
        rh.close()
        
        return updated
        
    except Exception as e:
        log(f"  ❌ Помилка: {e}")
        import traceback
        traceback.print_exc()
        return 0

if __name__ == "__main__":
    print("=" * 80)
    print("🔄 ШВИДКА СИНХРОНІЗАЦІЯ ЦІН ТА КІЛЬКОСТЕЙ")
    print("=" * 80)
    print(f"Початок: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    updated = sync_prices_and_quantities()
    
    print()
    print("=" * 80)
    print(f"✅ СИНХРОНІЗАЦІЯ ЗАВЕРШЕНА!")
    print(f"Оновлено товарів: {updated}")
    print(f"Завершено: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
