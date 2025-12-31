"""
RentalHub DB Monitoring Dashboard
Shows sync status, data statistics, and health checks
"""
import mysql.connector
from datetime import datetime, timedelta
from tabulate import tabulate

OC = {'host': 'farforre.mysql.tools', 'database': 'farforre_db',
      'user': 'farforre_db', 'password': 'gPpAHTvv'}
RH = {'host': 'farforre.mysql.tools', 'database': 'farforre_rentalhub',
      'user': 'farforre_rentalhub', 'password': '-nu+3Gp54L'}

def check_db_connection(config, name):
    """Check if database is accessible"""
    try:
        conn = mysql.connector.connect(**config)
        conn.close()
        return f"✅ {name}"
    except Exception as e:
        return f"❌ {name}: {e}"

def get_sync_status():
    """Get recent sync log entries"""
    try:
        rh = mysql.connector.connect(**RH)
        cur = rh.cursor(dictionary=True)
        
        cur.execute("""
            SELECT sync_type, status, records_synced, duration_seconds,
                   started_at, completed_at
            FROM sync_log
            ORDER BY started_at DESC
            LIMIT 5
        """)
        
        logs = cur.fetchall()
        cur.close()
        rh.close()
        return logs
    except:
        return []

def get_table_stats():
    """Get record counts for all tables"""
    try:
        rh = mysql.connector.connect(**RH)
        cur = rh.cursor()
        
        tables = [
            'products', 'categories', 'orders', 'order_items',
            'inventory', 'audit_records', 'damages',
            'product_history', 'product_lifecycle'
        ]
        
        stats = []
        for table in tables:
            try:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                count = cur.fetchone()[0]
                
                # Get last update
                try:
                    if table in ['products', 'categories']:
                        cur.execute(f"SELECT MAX(synced_at) FROM {table}")
                    elif table == 'inventory':
                        cur.execute(f"SELECT MAX(updated_at) FROM {table}")
                    else:
                        cur.execute(f"SELECT MAX(created_at) FROM {table}")
                    last_update = cur.fetchone()[0]
                    if last_update:
                        last_update = last_update.strftime('%Y-%m-%d %H:%M')
                    else:
                        last_update = 'Never'
                except:
                    last_update = 'N/A'
                
                stats.append({
                    'table': table,
                    'count': count,
                    'last_update': last_update
                })
            except Exception as e:
                stats.append({
                    'table': table,
                    'count': f'Error: {e}',
                    'last_update': 'N/A'
                })
        
        cur.close()
        rh.close()
        return stats
    except Exception as e:
        return [{'table': 'Error', 'count': str(e), 'last_update': 'N/A'}]

def get_product_stats():
    """Get detailed product statistics"""
    try:
        rh = mysql.connector.connect(**RH)
        cur = rh.cursor()
        
        # Total products
        cur.execute("SELECT COUNT(*) FROM products")
        total = cur.fetchone()[0]
        
        # With categories
        cur.execute("SELECT COUNT(*) FROM products WHERE category_name IS NOT NULL")
        with_cat = cur.fetchone()[0]
        
        # With attributes
        cur.execute("SELECT COUNT(*) FROM products WHERE color IS NOT NULL")
        with_color = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM products WHERE material IS NOT NULL")
        with_material = cur.fetchone()[0]
        
        # Last sync
        cur.execute("SELECT MAX(synced_at) FROM products")
        last_sync = cur.fetchone()[0]
        
        cur.close()
        rh.close()
        
        return {
            'total': total,
            'with_categories': with_cat,
            'with_color': with_color,
            'with_material': with_material,
            'last_sync': last_sync.strftime('%Y-%m-%d %H:%M:%S') if last_sync else 'Never',
            'category_pct': round(with_cat * 100 / total, 1) if total else 0,
            'color_pct': round(with_color * 100 / total, 1) if total else 0,
            'material_pct': round(with_material * 100 / total, 1) if total else 0
        }
    except Exception as e:
        return {'error': str(e)}

def get_audit_stats():
    """Get audit statistics"""
    try:
        rh = mysql.connector.connect(**RH)
        cur = rh.cursor()
        
        # Total inventory
        cur.execute("SELECT COUNT(*) FROM inventory")
        total = cur.fetchone()[0]
        
        # Audited
        cur.execute("SELECT COUNT(*) FROM inventory WHERE last_audit_date IS NOT NULL")
        audited = cur.fetchone()[0]
        
        # Overdue (>180 days)
        cur.execute("""
            SELECT COUNT(*) FROM inventory 
            WHERE last_audit_date IS NOT NULL 
            AND DATEDIFF(CURDATE(), last_audit_date) > 180
        """)
        overdue = cur.fetchone()[0]
        
        # Recent audits (last 7 days)
        cur.execute("""
            SELECT COUNT(*) FROM audit_records 
            WHERE audit_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        """)
        recent = cur.fetchone()[0]
        
        cur.close()
        rh.close()
        
        return {
            'total_inventory': total,
            'audited': audited,
            'overdue': overdue,
            'recent_7days': recent,
            'audit_pct': round(audited * 100 / total, 1) if total else 0
        }
    except Exception as e:
        return {'error': str(e)}

def main():
    print("=" * 70)
    print("📊 RENTALHUB DATABASE MONITORING")
    print("=" * 70)
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Connection Status
    print("🔌 DATABASE CONNECTIONS:")
    print(f"  {check_db_connection(OC, 'OpenCart DB')}")
    print(f"  {check_db_connection(RH, 'RentalHub DB')}")
    print()
    
    # Table Statistics
    print("📊 TABLE STATISTICS:")
    stats = get_table_stats()
    if stats:
        table_data = [[s['table'], s['count'], s['last_update']] for s in stats]
        print(tabulate(table_data, headers=['Table', 'Records', 'Last Update'], tablefmt='simple'))
    print()
    
    # Product Statistics
    print("📦 PRODUCT DATA QUALITY:")
    prod_stats = get_product_stats()
    if 'error' not in prod_stats:
        print(f"  Total Products: {prod_stats['total']}")
        print(f"  With Categories: {prod_stats['with_categories']} ({prod_stats['category_pct']}%)")
        print(f"  With Color: {prod_stats['with_color']} ({prod_stats['color_pct']}%)")
        print(f"  With Material: {prod_stats['with_material']} ({prod_stats['material_pct']}%)")
        print(f"  Last Sync: {prod_stats['last_sync']}")
    else:
        print(f"  Error: {prod_stats['error']}")
    print()
    
    # Audit Statistics
    print("🔍 AUDIT STATUS:")
    audit_stats = get_audit_stats()
    if 'error' not in audit_stats:
        print(f"  Total Inventory Items: {audit_stats['total_inventory']}")
        print(f"  Audited: {audit_stats['audited']} ({audit_stats['audit_pct']}%)")
        print(f"  Overdue (>180 days): {audit_stats['overdue']}")
        print(f"  Recent Audits (7 days): {audit_stats['recent_7days']}")
    else:
        print(f"  Error: {audit_stats['error']}")
    print()
    
    # Recent Sync Logs
    print("🔄 RECENT SYNC ACTIVITY:")
    logs = get_sync_status()
    if logs:
        log_data = []
        for log in logs:
            log_data.append([
                log['sync_type'],
                log['status'],
                log['records_synced'],
                f"{log['duration_seconds']}s" if log['duration_seconds'] else 'N/A',
                log['started_at'].strftime('%m-%d %H:%M') if log['started_at'] else 'N/A'
            ])
        print(tabulate(log_data, headers=['Type', 'Status', 'Records', 'Duration', 'Time'], tablefmt='simple'))
    else:
        print("  No sync logs found")
    
    print("\n" + "=" * 70)
    print("✅ Monitoring complete")
    print("=" * 70)

if __name__ == "__main__":
    main()
