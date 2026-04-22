from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from backend.config import ALLOWED_ORIGINS
from backend.db import engine
from backend.routers import auth, popular, results
from backend.seed import sync_from_env as seed_sync_from_env


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Acts on SEED_DEMO_DATA env var. No-op if unset.
    seed_sync_from_env()
    yield


app = FastAPI(title="RyanPP API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(results.router)
app.include_router(popular.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/health/db")
def health_db():
    with engine.connect() as conn:
        value = conn.execute(text("SELECT 1")).scalar_one()
    return {"status": "ok", "db": value}
