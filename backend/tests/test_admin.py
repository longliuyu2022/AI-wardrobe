"""管理后台端点测试。"""
from __future__ import annotations

from fastapi.testclient import TestClient


class TestAdminLogin:
    def test_login_ok(self, client: TestClient) -> None:
        r = client.post("/admin/login", json={"password": "test-admin-code"})
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_login_wrong_password(self, client: TestClient) -> None:
        r = client.post("/admin/login", json={"password": "wrong"})
        assert r.status_code == 401


class TestAdminStats:
    def test_stats_authenticated(self, admin_client: TestClient) -> None:
        r = admin_client.get("/admin/stats")
        assert r.status_code == 200
        data = r.json()
        assert "user_count" in data
        assert "garment_count" in data
        assert "categories" in data
        assert "upload_files" in data
        assert "upload_size_mb" in data

    def test_stats_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/admin/stats")
        assert r.status_code == 401


class TestAdminUsers:
    def test_list_users(self, admin_client: TestClient) -> None:
        r = admin_client.get("/admin/users")
        assert r.status_code == 200
        assert "users" in r.json()
        assert isinstance(r.json()["users"], list)

    def test_user_detail_not_found(self, admin_client: TestClient) -> None:
        r = admin_client.get("/admin/users/nonexistent")
        assert r.status_code == 404

    def test_user_detail_with_data(self, admin_client: TestClient, auth_client: TestClient, mock_ai_service) -> None:
        # auth_client 已创建 testuser
        from io import BytesIO
        from PIL import Image

        buf = BytesIO()
        Image.new("RGB", (100, 100), color="red").save(buf, format="JPEG")
        auth_client.post("/garments", files={"file": ("test.jpg", buf.getvalue(), "image/jpeg")})

        r = admin_client.get("/admin/users/testuser")
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["username"] == "testuser"
        assert len(data["garments"]) == 1
        assert "total_size_mb" in data
