import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "coastal_sentinel.db")
print(f"Connecting to {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE users DROP COLUMN hashed_password;")
    conn.commit()
    print("Successfully dropped 'hashed_password' column from users table.")
    conn.close()
except sqlite3.OperationalError as e:
    if "no such column: hashed_password" in str(e):
        print("Column already dropped or does not exist.")
    else:
        print(f"Operational error: {e}")
        # Could be an older version of sqlite3 that doesn't support DROP COLUMN.
        # Let's check sqlite3 version
        print(f"SQLite3 version: {sqlite3.sqlite_version}")
except Exception as e:
    print(f"Error dropping column: {e}")
