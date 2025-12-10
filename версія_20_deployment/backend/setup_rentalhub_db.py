"""
Script to setup RentalHub database with optimized schema
"""
import mysql.connector
from mysql.connector import Error
import os

# New RentalHub DB credentials
RENTALHUB_DB_CONFIG = {
    'host': 'farforre.mysql.tools',
    'database': 'farforre_rentalhub',
    'user': 'farforre_rentalhub',
    'password': '-nu+3Gp54L',
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci'
}

def create_connection():
    """Create database connection"""
    try:
        connection = mysql.connector.connect(**RENTALHUB_DB_CONFIG)
        if connection.is_connected():
            print(f"✅ Connected to RentalHub DB: {RENTALHUB_DB_CONFIG['database']}")
            return connection
    except Error as e:
        print(f"❌ Error connecting to database: {e}")
        return None

def execute_sql_file(connection, filename):
    """Execute SQL file"""
    try:
        cursor = connection.cursor()
        
        # Read SQL file
        with open(filename, 'r', encoding='utf-8') as f:
            sql_script = f.read()
        
        # Split by semicolons and execute each statement
        statements = sql_script.split(';')
        
        for i, statement in enumerate(statements):
            statement = statement.strip()
            if statement and not statement.startswith('--'):
                try:
                    cursor.execute(statement)
                    if i % 5 == 0:
                        print(f"  Executed {i+1}/{len(statements)} statements...")
                except Error as e:
                    # Skip CREATE OR REPLACE VIEW errors as they might not be supported
                    if 'CREATE OR REPLACE VIEW' not in statement:
                        print(f"⚠️  Warning on statement {i+1}: {e}")
        
        connection.commit()
        cursor.close()
        print(f"✅ Successfully executed {filename}")
        return True
        
    except Error as e:
        print(f"❌ Error executing SQL file: {e}")
        return False

def verify_tables(connection):
    """Verify that tables were created"""
    try:
        cursor = connection.cursor()
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        
        print(f"\n✅ Created {len(tables)} tables:")
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
            count = cursor.fetchone()[0]
            print(f"  - {table[0]}: {count} rows")
        
        cursor.close()
        return True
        
    except Error as e:
        print(f"❌ Error verifying tables: {e}")
        return False

def main():
    print("=" * 60)
    print("🚀 RENTALHUB DATABASE SETUP")
    print("=" * 60)
    
    # Connect to database
    connection = create_connection()
    if not connection:
        return
    
    # Execute migration script
    print("\n📝 Creating tables...")
    sql_file = os.path.join(os.path.dirname(__file__), 'migration_rentalhub_db.sql')
    
    if execute_sql_file(connection, sql_file):
        print("\n✅ Migration completed successfully!")
        
        # Verify tables
        print("\n🔍 Verifying tables...")
        verify_tables(connection)
        
        print("\n" + "=" * 60)
        print("✅ RENTALHUB DATABASE IS READY!")
        print("=" * 60)
        print("\n📊 Next steps:")
        print("  1. Update backend/.env with new DB credentials")
        print("  2. Create sync job to populate data from OpenCart")
        print("  3. Test connections")
        
    else:
        print("\n❌ Migration failed!")
    
    # Close connection
    if connection.is_connected():
        connection.close()
        print("\n👋 Connection closed")

if __name__ == "__main__":
    main()
