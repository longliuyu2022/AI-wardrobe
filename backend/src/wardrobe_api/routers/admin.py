"""管理员后台 API — 需要 admin_code 鉴权。"""
from __future__ import annotations

import hmac
from pathlib import Path

from fastapi import APIRouter, Cookie, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import func

from ..db import get_db
from ..models import Garment, User
from ..settings import settings

router = APIRouter()

ADMIN_COOKIE = "wardrobe_admin"
UPLOADS_DIR = Path("data/uploads").resolve()


def _check_admin(admin_token: str | None) -> None:
    if not settings.admin_code:
        raise HTTPException(status_code=403, detail="管理员密码未配置")
    if not admin_token or not hmac.compare_digest(admin_token, settings.admin_code):
        raise HTTPException(status_code=401, detail="管理员密码错误")


class AdminLoginBody(BaseModel):
    password: str


@router.post("/login")
def admin_login(body: AdminLoginBody, response: Response) -> dict:
    if not settings.admin_code:
        raise HTTPException(status_code=403, detail="管理员密码未配置")
    if not hmac.compare_digest(body.password.strip(), settings.admin_code.strip()):
        raise HTTPException(status_code=401, detail="管理员密码错误")
    response.set_cookie(
        key=ADMIN_COOKIE,
        value=settings.admin_code,
        max_age=60 * 60 * 24,  # 24h
        httponly=True,
        secure=True,
        samesite="strict",
        path="/api/backend/admin",
    )
    return {"ok": True}


@router.get("/users")
def list_users(admin_token: str | None = Cookie(None, alias=ADMIN_COOKIE)) -> dict:
    _check_admin(admin_token)
    db = next(get_db())
    try:
        users = db.query(User).order_by(User.created_at.desc()).all()
        result = []
        for u in users:
            garment_count = db.query(func.count(Garment.id)).filter(Garment.user_id == u.id).scalar() or 0
            result.append({
                "id": u.id,
                "username": u.username,
                "nickname": u.nickname,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
                "garment_count": garment_count,
            })
        return {"users": result}
    finally:
        db.close()


@router.get("/users/{username}")
def user_detail(username: str, admin_token: str | None = Cookie(None, alias=ADMIN_COOKIE)) -> dict:
    _check_admin(admin_token)
    db = next(get_db())
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        garments = db.query(Garment).filter(Garment.user_id == user.id).order_by(Garment.created_at.desc()).all()
        items = []
        total_size = 0
        for g in garments:
            # Calculate file size
            size = 0
            if g.image_url:
                fname = g.image_url.rsplit("/", 1)[-1]
                fpath = UPLOADS_DIR / fname
                if fpath.exists():
                    size = fpath.stat().st_size
            total_size += size
            items.append({
                "id": g.id,
                "category": g.category,
                "sub_category": g.sub_category,
                "colors": g.colors,
                "season": g.season,
                "material": g.material,
                "style": g.style,
                "image_url": g.image_url,
                "wear_count": g.wear_count,
                "purchase_price": float(g.purchase_price) if g.purchase_price else None,
                "created_at": g.created_at.isoformat() if g.created_at else None,
                "file_size_kb": round(size / 1024, 1),
            })
        return {
            "user": {
                "id": user.id,
                "username": user.username,
                "nickname": user.nickname,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            },
            "garments": items,
            "total_size_mb": round(total_size / 1024 / 1024, 2),
        }
    finally:
        db.close()


@router.get("/stats")
def stats(admin_token: str | None = Cookie(None, alias=ADMIN_COOKIE)) -> dict:
    _check_admin(admin_token)
    db = next(get_db())
    try:
        user_count = db.query(func.count(User.id)).scalar() or 0
        garment_count = db.query(func.count(Garment.id)).scalar() or 0
        # Category breakdown
        cat_rows = db.query(Garment.category, func.count(Garment.id)).group_by(Garment.category).all()
        categories = {cat: cnt for cat, cnt in cat_rows}
        # Disk usage
        total_size = 0
        file_count = 0
        if UPLOADS_DIR.exists():
            for f in UPLOADS_DIR.iterdir():
                if f.is_file():
                    total_size += f.stat().st_size
                    file_count += 1
        return {
            "user_count": user_count,
            "garment_count": garment_count,
            "categories": categories,
            "upload_files": file_count,
            "upload_size_mb": round(total_size / 1024 / 1024, 2),
        }
    finally:
        db.close()
