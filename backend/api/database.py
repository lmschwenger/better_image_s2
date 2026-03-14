from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Use a file-based SQLite database. On Render, this will persist as long as the disk does.
# For production scaling, swap this connection string for PostgreSQL.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./coastal_sentinel.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # Required for SQLite with FastAPI
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
