from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .settings import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    future=True,
    # SQLite 需要 check_same_thread=False (FastAPI 多线程)
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)


# SQLite WAL mode: 让多进程 / 多线程读写不互斥, uvicorn --workers N 友好
if settings.database_url.startswith("sqlite"):
    @event.listens_for(Engine, "connect")
    def _enable_sqlite_wal(dbapi_connection, _conn_record):
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")  # WAL 下 NORMAL 足够安全, 比 FULL 快很多
        cur.execute("PRAGMA busy_timeout=5000")  # 锁等待 5s 而不是立刻失败
        cur.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
