from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.config import DATABASE_URL

# SQLAlchemy needs the driver in the URL; psycopg v3 uses "postgresql+psycopg://".
_url = DATABASE_URL
if _url.startswith("postgresql://"):
    _url = "postgresql+psycopg://" + _url[len("postgresql://"):]

# Neon's pooler handles real connection pooling; keep the app-side pool small.
engine = create_engine(
    _url,
    pool_pre_ping=True,
    pool_size=2,
    max_overflow=3,
    pool_recycle=300,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
