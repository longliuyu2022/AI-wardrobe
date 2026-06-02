"""Cookie 签名 session + 密码哈希。

设计:
- 注册需邀请码 (settings.access_code), 每人一个 username/password
- cookie 内容: {"uid": user_id} 签名 30 天有效
- require_session 直接返回 user_id, 跨设备登录同一账号 → 同一 user_id → 同一衣柜
"""
from __future__ import annotations

from fastapi import HTTPException, Request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from passlib.context import CryptContext

from .settings import settings

SESSION_COOKIE = "wardrobe_session"
COOKIE_SALT = "wardrobe-session-v2"  # bump to invalidate old v1 cookies after schema change

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd_ctx.verify(plain, hashed)
    except Exception:
        return False


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret, salt=COOKIE_SALT)


def issue_session(user_id: str) -> str:
    return _serializer().dumps({"uid": user_id})


def verify_session(token: str) -> str | None:
    """返回 user_id (有效时) 或 None。"""
    try:
        data = _serializer().loads(token, max_age=settings.session_max_age)
    except (BadSignature, SignatureExpired):
        return None
    if isinstance(data, dict):
        return data.get("uid")
    return None


def require_session(request: Request) -> str:
    """所有受保护端点用 Depends(require_session) → 返回 user_id (str)。"""
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="未登录")
    uid = verify_session(token)
    if not uid:
        raise HTTPException(status_code=401, detail="session 失效, 请重新登录")
    return uid
