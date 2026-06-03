"""Alembic 环境配置 — 读取 app settings 的数据库 URL，自动发现 models。"""
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# 导入 app 的 Base 和 models（注册到 Base.metadata）
from wardrobe_api import models  # noqa: F401
from wardrobe_api.db import Base
from wardrobe_api.settings import settings

config = context.config

# 从 app settings 读取数据库 URL，覆盖 alembic.ini 里的占位值
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # SQLite 需要 batch mode 才能 ALTER TABLE
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
