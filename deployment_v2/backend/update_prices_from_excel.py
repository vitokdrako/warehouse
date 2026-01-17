"""
Mass price update from Excel files
Updates both OpenCart and RentalHub databases
"""
import pandas as pd
import mysql.connector
import os
from datetime import datetime
from pathlib import Path

OC = {'host': 'farforre.mysql.tools', 'database': 'farforre_db',
      'user': 'farforre_db', 'password': 'gPpAHTvv', 'charset': 'utf8mb4'}
RH = {'host': 'farforre.mysql.tools', 'database': 'farforre_rentalhub',
      'user': 'farforre_rentalhub', 'password': '-nu+3Gp54L', 'charset': 'utf8mb4'}

def find_excel_files(base_path):
    """Find all Excel files recursively"""
    excel_files = []
    for root, dirs, files in os.walk(base_path):
        for file in files:
            if file.endswith(('.xlsx', '.xls')):
                excel_files.append(os.path.join(root, file))
    return excel_files

def read_price_data(file_path):
    """Read product_id, ean, price from Excel"""
    try:
        df = pd.read_excel(file_path)
        
        # Check required columns exist
        if not all(col in df.columns for col in ['product_id', 'ean', 'price']):
            missing = [col for col in ['product_id', 'ean', 'price'] if col not in df.columns]
            return {
                'success': False,
                'reason': f"missing columns: {', '.join(missing)}",
                'data': []
            }
        
        # Filter rows with data
        total_rows = len(df)
        df = df[df['product_id'].notna() & df['ean'].notna() & df['price'].notna()]
        valid_rows = len(df)
        
        if valid_rows == 0:
            return {
                'success': False,
                'reason': f"no valid data rows (total rows: {total_rows})",
                'data': []
            }
        
        # Convert to list of dicts
        data = []
        for _, row in df.iterrows():
            data.append({
                'product_id': int(row['product_id']),
                'ean': float(row['ean']),  # збиток/повна втрата
                'price': float(row['price'])  # ціна оренди
            })
        
        return {
            'success': True,
            'reason': None,
            'data': data,
            'skipped_rows': total_rows - valid_rows
        }
        
    except Exception as e:
        return {
            'success': False,
            'reason': f"error: {str(e)}",
            'data': []
        }

def update_opencart(products):
    """Update OpenCart database with change logging"""
    print("\n📝 Updating OpenCart database...")
    
    try:
        conn = mysql.connector.connect(**OC)
        cursor = conn.cursor(dictionary=True)
        
        changes = []
        count = 0
        
        for p in products:
            # Get old values
            cursor.execute("""
                SELECT product_id, ean, price 
                FROM oc_product 
                WHERE product_id = %s
            """, (p['product_id'],))
            
            old = cursor.fetchone()
            if not old:
                continue
            
            # Update
            cursor.execute("""
                UPDATE oc_product 
                SET ean = %s, price = %s
                WHERE product_id = %s
            """, (p['ean'], p['price'], p['product_id']))
            
            # Log change if values changed
            if old['ean'] != p['ean'] or old['price'] != p['price']:
                changes.append({
                    'product_id': p['product_id'],
                    'old_ean': old['ean'],
                    'new_ean': p['ean'],
                    'old_price': old['price'],
                    'new_price': p['price']
                })
            
            count += 1
        
        conn.commit()
        print(f"  ✅ Updated {count} products in OpenCart")
        print(f"  📊 {len(changes)} products had changes")
        
        cursor.close()
        conn.close()
        return count, changes
        
    except Exception as e:
        print(f"  ❌ Error updating OpenCart: {e}")
        return 0, []

def update_rentalhub(products):
    """Update RentalHub database"""
    print("\n📝 Updating RentalHub database...")
    
    try:
        conn = mysql.connector.connect(**RH)
        cursor = conn.cursor()
        
        count = 0
        for p in products:
            cursor.execute("""
                UPDATE products 
                SET price = %s
                WHERE product_id = %s
            """, (p['price'], p['product_id']))
            
            if cursor.rowcount > 0:
                count += 1
        
        conn.commit()
        print(f"  ✅ Updated {count} products in RentalHub")
        
        cursor.close()
        conn.close()
        return count
        
    except Exception as e:
        print(f"  ❌ Error updating RentalHub: {e}")
        return 0

def main():
    print("=" * 70)
    print("💰 MASS PRICE UPDATE FROM EXCEL FILES")
    print("=" * 70)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    base_path = '/tmp/price_update/ПІДНЯТТЯ ЦІН 17.11.2025'
    
    # Find all Excel files
    print("🔍 Searching for Excel files...")
    excel_files = find_excel_files(base_path)
    print(f"Found {len(excel_files)} Excel files\n")
    
    # Read all data
    print("📖 Reading price data from files...")
    all_products = {}
    skipped_files = []
    successful_files = 0
    total_skipped_rows = 0
    
    for file_path in excel_files:
        rel_path = file_path.replace(base_path, '')
        print(f"  Reading: ...{rel_path}")
        
        result = read_price_data(file_path)
        
        if not result['success']:
            print(f"    ⚠️  Skipped - {result['reason']}")
            skipped_files.append({
                'file': os.path.basename(file_path),
                'path': rel_path,
                'reason': result['reason']
            })
        else:
            # Merge data (later file overwrites earlier if duplicate product_id)
            for p in result['data']:
                all_products[p['product_id']] = p
            
            successful_files += 1
            total_skipped_rows += result.get('skipped_rows', 0)
            print(f"    ✅ {len(result['data'])} products")
            if result.get('skipped_rows', 0) > 0:
                print(f"       (skipped {result['skipped_rows']} rows with incomplete data)")
    
    products_list = list(all_products.values())
    
    # Statistics
    print("\n" + "=" * 70)
    print("📊 READING STATISTICS")
    print("=" * 70)
    print(f"Total files found: {len(excel_files)}")
    print(f"Successfully read: {successful_files}")
    print(f"Skipped files: {len(skipped_files)}")
    print(f"Unique products to update: {len(products_list)}")
    print(f"Rows with incomplete data: {total_skipped_rows}")
    
    # Show skipped files
    if skipped_files:
        print("\n📋 SKIPPED FILES REPORT:")
        for sf in skipped_files:
            print(f"  ❌ {sf['file']}")
            print(f"     Reason: {sf['reason']}")
            print(f"     Path: ...{sf['path']}")
    
    if not products_list:
        print("\n⚠️  No products found!")
        return
    
    # Show sample
    print("\n📦 Sample data (first 10):")
    for p in products_list[:10]:
        print(f"  ID {p['product_id']}: EAN={p['ean']}, Price={p['price']}")
    
    # Ask for confirmation
    print("\n" + "=" * 70)
    response = input("⚠️  Ready to update databases? Type 'yes' to continue: ")
    
    if response.lower() != 'yes':
        print("❌ Cancelled by user")
        return
    
    # Update databases
    oc_count, oc_changes = update_opencart(products_list)
    rh_count = update_rentalhub(products_list)
    
    # Save report
    report_file = f"/tmp/price_update_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("=" * 70 + "\n")
        f.write("PRICE UPDATE REPORT\n")
        f.write("=" * 70 + "\n")
        f.write(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        f.write("STATISTICS:\n")
        f.write(f"  Files processed: {successful_files}/{len(excel_files)}\n")
        f.write(f"  Unique products updated: {len(products_list)}\n")
        f.write(f"  OpenCart updates: {oc_count}\n")
        f.write(f"  RentalHub updates: {rh_count}\n")
        f.write(f"  Products with changes: {len(oc_changes)}\n\n")
        
        f.write("SKIPPED FILES:\n")
        for sf in skipped_files:
            f.write(f"  ❌ {sf['file']}\n")
            f.write(f"     Reason: {sf['reason']}\n\n")
        
        f.write("\nCHANGES DETAIL (first 100):\n")
        for i, change in enumerate(oc_changes[:100], 1):
            f.write(f"\n{i}. Product ID: {change['product_id']}\n")
            f.write(f"   EAN: {change['old_ean']} → {change['new_ean']}\n")
            f.write(f"   Price: {change['old_price']} → {change['new_price']}\n")
    
    print("\n" + "=" * 70)
    print("✅ UPDATE COMPLETED")
    print("=" * 70)
    print(f"OpenCart: {oc_count} products updated")
    print(f"RentalHub: {rh_count} products updated")
    print(f"Products with changes: {len(oc_changes)}")
    print(f"\n📄 Full report saved: {report_file}")
    print(f"Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
