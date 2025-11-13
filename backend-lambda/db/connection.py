import os
import pymysql

def get_db_connection():
    """Get a MySQL database connection"""
    return pymysql.connect(
        host=os.getenv('DB_HOST'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        port=int(os.getenv('DB_PORT', '3306')),
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False
    )

def release_db_connection(conn):
    """Close a database connection"""
    if conn:
        conn.close()
