from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    if not DATABASE_URL:
        print("DATABASE_URL not found in .env")
        return

    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        print("Checking if 'logs' column exists in 'jobs' table...")
        # Postgres check
        check_query = text("SELECT column_name FROM information_schema.columns WHERE table_name='jobs' AND column_name='logs';")
        result = conn.execute(check_query).fetchone()
        
        if result:
            print("Column 'logs' already exists.")
        else:
            print("Adding 'logs' column to 'jobs' table...")
            conn.execute(text("ALTER TABLE jobs ADD COLUMN logs TEXT;"))
            conn.commit()
            print("Successfully added 'logs' column.")

if __name__ == "__main__":
    migrate()
