from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    nickname: Mapped[str | None] = mapped_column(String(64))
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime)

    garments: Mapped[list["Garment"]] = relationship(back_populates="user")


class Garment(Base):
    __tablename__ = "garments"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    sub_category: Mapped[str | None] = mapped_column(String(64))
    colors: Mapped[Any | None] = mapped_column(JSON)
    season: Mapped[Any | None] = mapped_column(JSON)
    material: Mapped[str | None] = mapped_column(String(64))
    style: Mapped[str | None] = mapped_column(String(64))
    image_url: Mapped[str] = mapped_column(String(512))
    thumbnail_url: Mapped[str | None] = mapped_column(String(512))
    wear_count: Mapped[int] = mapped_column(Integer, default=0)
    purchase_price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    purchase_link: Mapped[str | None] = mapped_column(String(512))
    note: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="garments")
    wear_logs: Mapped[list["WearLog"]] = relationship(back_populates="garment")


class WearLog(Base):
    __tablename__ = "wear_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    garment_id: Mapped[str] = mapped_column(ForeignKey("garments.id"), index=True)
    worn_date: Mapped[str] = mapped_column(String(10))  # "2026-05-28"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    garment: Mapped[Garment] = relationship(back_populates="wear_logs")
