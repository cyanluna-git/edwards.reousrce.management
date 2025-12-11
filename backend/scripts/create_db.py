"""
Initialize database - creates edwards database if not exists
Run from backend container: python -m scripts.create_db
"""

import time
import pyodbc


def create_database():
    # Connect to master database to create edwards db
    conn_str = (
        "DRIVER={ODBC Driver 18 for SQL Server};"
        "SERVER=db,1433;"  # 'db' is the service name in docker-compose
        "DATABASE=master;"
        "UID=sa;"
        "PWD=Edwards2024;"
        "TrustServerCertificate=yes;"
        "Connection Timeout=30;"
    )

    max_retries = 10
    for attempt in range(max_retries):
        try:
            print(f"Connecting to SQL Server (attempt {attempt + 1}/{max_retries})...")
            conn = pyodbc.connect(conn_str, autocommit=True)
            cursor = conn.cursor()

            # Check if database exists
            cursor.execute("SELECT name FROM sys.databases WHERE name = 'edwards'")
            if cursor.fetchone():
                print("✓ Database 'edwards' already exists.")
            else:
                print("Creating database 'edwards'...")
                cursor.execute("CREATE DATABASE edwards")
                print("✓ Database 'edwards' created successfully!")

            cursor.close()
            conn.close()
            return True

        except Exception as e:
            print(f"Connection failed: {e}")
            if attempt < max_retries - 1:
                print(f"Retrying in 5 seconds...")
                time.sleep(5)
            else:
                print("Max retries reached.")
                return False


if __name__ == "__main__":
    create_database()
