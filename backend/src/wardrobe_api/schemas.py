from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class GarmentCategory(str, Enum):
    TOP = "top"
    OUTERWEAR = "outerwear"
    BOTTOM = "bottom"
    DRESS = "dress"
    SHOES = "shoes"
    BAG = "bag"
    ACCESSORY = "accessory"
    OTHER = "other"


class GarmentOut(BaseModel):
    id: str
    category: GarmentCategory
    sub_category: str | None = None
    colors: list[str] | None = None
    season: list[str] | None = None
    material: str | None = None
    style: str | None = None
    image_url: str
    thumbnail_url: str | None = None
    wear_count: int = 0
    purchase_price: float | None = None
    purchase_link: str | None = None
    note: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class GarmentUpdate(BaseModel):
    """单件衣物编辑 — 所有字段可选, 只传想改的。"""
    category: GarmentCategory | None = None
    sub_category: str | None = None
    colors: list[str] | None = None
    season: list[str] | None = None
    material: str | None = None
    style: str | None = None
    wear_count: int | None = None
    purchase_price: float | None = None
    purchase_link: str | None = None
    note: str | None = None


class FullBodyResult(BaseModel):
    items: list[GarmentOut]
    warnings: list[str] = Field(default_factory=list)


class PhoneLoginRequest(BaseModel):
    phone: str = Field(pattern=r"^1[3-9]\d{9}$")
    code: str


class AuthToken(BaseModel):
    access_token: str
    expires_in: int
