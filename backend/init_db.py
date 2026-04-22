"""Create all tables on the configured DATABASE_URL.

Run from the repo root:
    python -m backend.init_db
"""
from sqlalchemy import text

from backend.db import engine
from backend.models import Base


def main() -> None:
    with engine.connect() as conn:
        version = conn.execute(text("SELECT version()")).scalar_one()
        print(f"Connected: {version}")

    Base.metadata.create_all(engine)
    print("All tables created (or already existed).")


if __name__ == "__main__":
    main()
