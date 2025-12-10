"""
Initial database setup script
Creates the edwards database if it doesn't exist
"""

import pyodbc
import time


def create_database():
    # Connection string for master database
    conn_str = (
        "DRIVER={ODBC Driver 18 for SQL Server};"
        "SERVER=localhost,1433;"
        "DATABASE=master;"
        "UID=sa;"
        "PWD=Edwards@2024!;"
        "TrustServerCertificate=yes;"
    )

    max_retries = 5
    for attempt in range(max_retries):
        try:
            print(f"Attempting to connect... (attempt {attempt + 1}/{max_retries})")
            conn = pyodbc.connect(conn_str, autocommit=True)
            cursor = conn.cursor()

            # Check if database exists
            cursor.execute("SELECT name FROM sys.databases WHERE name = 'edwards'")
            if cursor.fetchone():
                print("Database 'edwards' already exists.")
            else:
                print("Creating database 'edwards'...")
                cursor.execute("CREATE DATABASE edwards")
                print("Database 'edwards' created successfully!")

            cursor.close()
            conn.close()
            return True

        except pyodbc.Error as e:
            print(f"Connection failed: {e}")
            if attempt < max_retries - 1:
                print(f"Retrying in 5 seconds...")
                time.sleep(5)
            else:
                print("Max retries reached. Please check if SQL Server is running.")
                return False


if __name__ == "__main__":
    create_database()
