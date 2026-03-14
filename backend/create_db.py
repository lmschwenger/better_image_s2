import os
import sys

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from api.database import engine, Base
from api import models

print("Creating database tables in Neon PostgreSQL...")
Base.metadata.create_all(bind=engine)
print("Tables created successfully!")
