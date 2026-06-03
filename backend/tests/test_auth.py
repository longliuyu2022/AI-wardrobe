"""认证端点测试 — 注册 / 登录 / 登出 / me。"""
from fastapi.testclient import TestClient


class TestRegister:
    def test_register_ok(self, client: TestClient) -> None:
        r = client.post("/auth/register", json={
            "invite_code": "test-invite-code",
            "username": "newuser",
            "password": "pass123456",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["username"] == "newuser"
        assert "user_id" in data

    def test_register_wrong_invite_code(self, client: TestClient) -> None:
        r = client.post("/auth/register", json={
            "invite_code": "wrong-code",
            "username": "newuser",
            "password": "pass123456",
        })
        assert r.status_code == 403

    def test_register_duplicate_username(self, client: TestClient) -> None:
        payload = {
            "invite_code": "test-invite-code",
            "username": "dupuser",
            "password": "pass123456",
        }
        client.post("/auth/register", json=payload)
        r = client.post("/auth/register", json=payload)
        assert r.status_code == 409

    def test_register_bad_username(self, client: TestClient) -> None:
        r = client.post("/auth/register", json={
            "invite_code": "test-invite-code",
            "username": "ab",  # 太短
            "password": "pass123456",
        })
        assert r.status_code == 422  # Pydantic validation

    def test_register_short_password(self, client: TestClient) -> None:
        r = client.post("/auth/register", json={
            "invite_code": "test-invite-code",
            "username": "validuser",
            "password": "12345",  # < 6 位
        })
        assert r.status_code == 422


class TestLogin:
    def test_login_ok(self, client: TestClient) -> None:
        client.post("/auth/register", json={
            "invite_code": "test-invite-code",
            "username": "loginuser",
            "password": "pass123456",
        })
        r = client.post("/auth/login", json={
            "username": "loginuser",
            "password": "pass123456",
        })
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # cookie 应该设置
        assert "wardrobe_session" in r.cookies

    def test_login_wrong_password(self, client: TestClient) -> None:
        client.post("/auth/register", json={
            "invite_code": "test-invite-code",
            "username": "loginuser2",
            "password": "pass123456",
        })
        r = client.post("/auth/login", json={
            "username": "loginuser2",
            "password": "wrongpassword",
        })
        assert r.status_code == 401

    def test_login_nonexistent_user(self, client: TestClient) -> None:
        r = client.post("/auth/login", json={
            "username": "nobody",
            "password": "pass123456",
        })
        assert r.status_code == 401


class TestMe:
    def test_me_authenticated(self, auth_client: TestClient) -> None:
        r = auth_client.get("/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["username"] == "testuser"

    def test_me_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/auth/me")
        assert r.status_code == 401


class TestLogout:
    def test_logout(self, auth_client: TestClient) -> None:
        r = auth_client.post("/auth/logout")
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # 登出后 me 应 401
        r2 = auth_client.get("/auth/me")
        assert r2.status_code == 401
