"""注册 + 登录 — 邀请码作为注册门票, 用户名+密码鉴权, 跨设备同步。"""
from __future__ import annotations

import hmac
import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..security import (
    SESSION_COOKIE,
    hash_password,
    issue_session,
    require_session,
    verify_password,
)
from ..settings import settings

router = APIRouter()

USERNAME_RE = re.compile(r"^[A-Za-z0-9_一-龥]{3,32}$")


class RegisterBody(BaseModel):
    invite_code: str = Field(..., min_length=1, max_length=64)
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=6, max_length=128)


class LoginBody(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


def _set_cookie(response: Response, user_id: str) -> None:
    token = issue_session(user_id)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=settings.session_max_age,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/",
    )


@router.post("/register")
def register(body: RegisterBody, response: Response, db: Session = Depends(get_db)) -> dict:
    """凭邀请码注册新账号。"""
    if not settings.access_code:
        raise HTTPException(status_code=403, detail="服务器未配置邀请码, 联系管理员")
    if not hmac.compare_digest(body.invite_code.strip(), settings.access_code.strip()):
        raise HTTPException(status_code=403, detail="邀请码不对")

    uname = body.username.strip()
    if not USERNAME_RE.match(uname):
        raise HTTPException(status_code=400, detail="用户名只能含字母/数字/下划线/中文, 3-32 位")

    existing = db.query(User).filter(User.username == uname).first()
    if existing:
        raise HTTPException(status_code=409, detail="用户名已被占用")

    user = User(
        id=uuid.uuid4().hex,
        username=uname,
        password_hash=hash_password(body.password),
        nickname=uname,
        created_at=datetime.utcnow(),
        last_login_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    _set_cookie(response, user.id)
    return {"ok": True, "user_id": user.id, "username": user.username}


@router.post("/login")
def login(body: LoginBody, response: Response, db: Session = Depends(get_db)) -> dict:
    """用户名 + 密码登录, 跨设备公用同一账号。"""
    user = db.query(User).filter(User.username == body.username.strip()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    user.last_login_at = datetime.utcnow()
    db.commit()
    _set_cookie(response, user.id)
    return {"ok": True, "user_id": user.id, "username": user.username}


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(user_id: str = Depends(require_session), db: Session = Depends(get_db)) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="账号不存在")
    return {
        "ok": True,
        "user_id": user.id,
        "username": user.username,
        "nickname": user.nickname,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
