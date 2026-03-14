from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Use a file-based SQLite database. On Render, this will persist as long as the disk does.
# For production scaling, swap this connection string for PostgreSQL.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./coastal_sentinel.db")

# Extract the URL and conditionally apply connect_args
# SQLite needs check_same_thread=False, Postgres does not.
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
