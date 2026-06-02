from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import models  # noqa: F401 — 让 Base 看到 models
from .db import Base, engine
from .routers import admin, auth, export, garments, health, outfits, wearlog
from .settings import settings


UPLOADS_DIR = Path("data/uploads").resolve()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # MVP 模式: SQLite 直接 create_all 建表 (生产环境应用 Alembic)
    Base.metadata.create_all(engine)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="Wardrobe API",
    version="0.2.0",
    description="电子衣柜业务后端。详细契约见 openapi/wardrobe.openapi.yaml。",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(garments.router, prefix="/garments", tags=["garments"])
app.include_router(outfits.router, prefix="/outfits", tags=["outfits"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(export.router, prefix="/export", tags=["export"])
app.include_router(wearlog.router, prefix="/wearlog", tags=["wearlog"])

# 简易模式: 上传图直接存本地, /uploads/<file> 提供静态文件 (没用 OSS)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
