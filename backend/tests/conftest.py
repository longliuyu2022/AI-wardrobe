"""共享测试 fixtures — SQLite 内存库 + TestClient + 认证 helper。"""
from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# 测试环境变量 — 必须在 import app 之前设置
os.environ["WARDROBE_DATABASE_URL"] = "sqlite://"  # 内存库
os.environ["WARDROBE_ACCESS_CODE"] = "test-invite-code"
os.environ["WARDROBE_ADMIN_CODE"] = "test-admin-code"
os.environ["WARDROBE_SESSION_SECRET"] = "test-session-secret-for-unit-tests"
os.environ["WARDROBE_AI_SERVICE_URL"] = "http://localhost:9999"

from wardrobe_api.db import Base, get_db  # noqa: E402
from wardrobe_api.main import app  # noqa: E402 -- 会 import models, 注册到 Base.metadata

# ---------- 测试引擎 (模块级, 每次 pytest 运行共享一个内存库) ----------

_test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,  # 所有连接共享同一个内存库
)
TestSession = sessionmaker(bind=_test_engine, autoflush=False, autocommit=False)

# 建表 — models 已通过 import app 注册到 Base.metadata
Base.metadata.create_all(_test_engine)


def _override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db

# admin.py 用 next(get_db()) 直接调用，不走依赖注入，需要 patch 模块级引用
import wardrobe_api.routers.admin as _admin_mod  # noqa: E402

_original_admin_get_db = _admin_mod.get_db


def _patch_admin_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


_admin_mod.get_db = _patch_admin_get_db


@pytest.fixture(autouse=True)
def _clean_tables():
    """每个测试前清空所有表数据（保留表结构）。"""
    with _test_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
    yield


class _AuthTestClient:
    """TestClient 包装器 — 自动携带 secure cookie（httpx 默认不发送 secure cookie over HTTP）。"""

    def __init__(self, app, **kwargs):
        from fastapi.testclient import TestClient

        self._client = TestClient(app, **kwargs)
        self._cookies: dict[str, str] = {}

    def __getattr__(self, name):
        return getattr(self._client, name)

    def request(self, method: str, url: str, **kwargs):
        cookies = {**self._cookies, **(kwargs.pop("cookies", None) or {})}
        resp = self._client.request(method, url, cookies=cookies, **kwargs)
        # 自动捕获 Set-Cookie
        for key, value in resp.cookies.items():
            if value:
                self._cookies[key] = value
        # 检测 delete_cookie（Max-Age=0 → 从 dict 移除）
        for header in resp.headers.get_list("set-cookie"):
            if "Max-Age=0" in header:
                name = header.split("=", 1)[0].strip()
                self._cookies.pop(name, None)
        return resp

    def get(self, url, **kwargs):
        return self.request("GET", url, **kwargs)

    def post(self, url, **kwargs):
        return self.request("POST", url, **kwargs)

    def patch(self, url, **kwargs):
        return self.request("PATCH", url, **kwargs)

    def delete(self, url, **kwargs):
        return self.request("DELETE", url, **kwargs)


@pytest.fixture()
def client():
    """无认证的 TestClient。"""
    return _AuthTestClient(app, raise_server_exceptions=False)


@pytest.fixture()
def auth_client(client):
    """已注册 + 登录的 TestClient，cookie 中带 session。"""
    client.post("/auth/register", json={
        "invite_code": "test-invite-code",
        "username": "testuser",
        "password": "testpass123",
    })
    return client


@pytest.fixture()
def admin_client(client):
    """已登录管理后台的 TestClient。"""
    from wardrobe_api.routers.admin import ADMIN_COOKIE
    from wardrobe_api.security import issue_admin_session

    # admin cookie 的 path="/api/backend/admin"，TestClient 走 /admin/... 路径不匹配
    # 直接注入签名 token 到 _cookies dict (与 admin_login 端点签发的一致)
    client._cookies[ADMIN_COOKIE] = issue_admin_session()
    return client


# ---------- AI service mock ----------

MOCK_IDENTIFY_RESPONSE = {
    "category": "top",
    "sub_category": "T恤",
    "colors": ["white"],
    "season": ["summer"],
    "material": "cotton",
    "style": "casual",
    "tags": ["圆领", "纯色"],
    "confidence": 0.95,
    "_source": "sensenova",
}

MOCK_SEGMENT_RESPONSE = {
    "items": [
        {
            "label": "衬衫",
            "category": "top",
            "colors": ["white"],
            "box": [0.2, 0.1, 0.8, 0.5],
            "confidence": 0.9,
        },
        {
            "label": "牛仔裤",
            "category": "bottom",
            "colors": ["blue"],
            "box": [0.25, 0.5, 0.75, 0.95],
            "confidence": 0.88,
        },
    ],
    "warnings": [],
}

MOCK_OUTFITS_RESPONSE = {
    "outfits": [
        {
            "name": "简约休闲",
            "reason": "白色 T 恤搭配牛仔裤，经典百搭",
            "garment_ids": [],  # 测试时会动态填入真实 id
        },
    ],
}


@pytest.fixture()
def mock_ai_service():
    """Mock 所有 AI service HTTP 调用。"""

    def _make_response(url: str, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        if "/api/identify" in url:
            resp.json.return_value = MOCK_IDENTIFY_RESPONSE.copy()
        elif "/api/segment-full-body" in url:
            resp.json.return_value = MOCK_SEGMENT_RESPONSE.copy()
        elif "/api/compose-outfits" in url:
            body = kwargs.get("json") or {}
            garment_ids = [g["id"] for g in body.get("garments", [])]
            outfit = MOCK_OUTFITS_RESPONSE["outfits"][0].copy()
            outfit["garment_ids"] = garment_ids[:2]
            resp.json.return_value = {"outfits": [outfit]}
        else:
            resp.status_code = 404
            resp.text = "not found"
        return resp

    async def _async_post(url: str, **kwargs):
        return _make_response(url, **kwargs)

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = _async_post

    with patch("httpx.AsyncClient", return_value=mock_client):
        yield mock_client
