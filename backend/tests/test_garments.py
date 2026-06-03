"""衣物 CRUD 端点测试。"""
from __future__ import annotations

from fastapi.testclient import TestClient


def _make_test_image() -> tuple[str, bytes]:
    """生成一个最小的有效 JPEG 文件。"""
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (100, 100), color="red").save(buf, format="JPEG")
    return "test.jpg", buf.getvalue()


class TestListGarments:
    def test_list_empty(self, auth_client: TestClient) -> None:
        r = auth_client.get("/garments")
        assert r.status_code == 200
        assert r.json() == []

    def test_list_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/garments")
        assert r.status_code == 401


class TestCreateGarment:
    def test_create_single_item(self, auth_client: TestClient, mock_ai_service) -> None:
        fname, img_bytes = _make_test_image()
        r = auth_client.post(
            "/garments",
            files={"file": (fname, img_bytes, "image/jpeg")},
        )
        assert r.status_code == 201
        data = r.json()
        assert data["category"] == "top"
        assert data["sub_category"] == "T恤"
        assert data["image_url"].startswith("/api/backend/uploads/")

    def test_create_empty_file(self, auth_client: TestClient) -> None:
        r = auth_client.post(
            "/garments",
            files={"file": ("empty.jpg", b"", "image/jpeg")},
        )
        assert r.status_code == 400

    def test_create_with_category_override(self, auth_client: TestClient, mock_ai_service) -> None:
        fname, img_bytes = _make_test_image()
        r = auth_client.post(
            "/garments",
            files={"file": (fname, img_bytes, "image/jpeg")},
            data={"category": "outerwear"},
        )
        assert r.status_code == 201
        assert r.json()["category"] == "outerwear"


class TestGetGarment:
    def test_get_existing(self, auth_client: TestClient, mock_ai_service) -> None:
        fname, img_bytes = _make_test_image()
        create_r = auth_client.post(
            "/garments",
            files={"file": (fname, img_bytes, "image/jpeg")},
        )
        gid = create_r.json()["id"]

        r = auth_client.get(f"/garments/{gid}")
        assert r.status_code == 200
        assert r.json()["id"] == gid

    def test_get_not_found(self, auth_client: TestClient) -> None:
        r = auth_client.get("/garments/nonexistent-id")
        assert r.status_code == 404


class TestUpdateGarment:
    def test_update_category(self, auth_client: TestClient, mock_ai_service) -> None:
        fname, img_bytes = _make_test_image()
        create_r = auth_client.post(
            "/garments",
            files={"file": (fname, img_bytes, "image/jpeg")},
        )
        gid = create_r.json()["id"]

        r = auth_client.patch(f"/garments/{gid}", json={
            "category": "outerwear",
            "note": "改成外套",
        })
        assert r.status_code == 200
        assert r.json()["category"] == "outerwear"
        assert r.json()["note"] == "改成外套"

    def test_update_partial(self, auth_client: TestClient, mock_ai_service) -> None:
        fname, img_bytes = _make_test_image()
        create_r = auth_client.post(
            "/garments",
            files={"file": (fname, img_bytes, "image/jpeg")},
        )
        gid = create_r.json()["id"]

        r = auth_client.patch(f"/garments/{gid}", json={"note": "只改备注"})
        assert r.status_code == 200
        assert r.json()["note"] == "只改备注"
        # 其他字段不变
        assert r.json()["category"] == "top"


class TestDeleteGarment:
    def test_delete_existing(self, auth_client: TestClient, mock_ai_service) -> None:
        fname, img_bytes = _make_test_image()
        create_r = auth_client.post(
            "/garments",
            files={"file": (fname, img_bytes, "image/jpeg")},
        )
        gid = create_r.json()["id"]

        r = auth_client.delete(f"/garments/{gid}")
        assert r.status_code == 204

        # 确认已删除
        r2 = auth_client.get(f"/garments/{gid}")
        assert r2.status_code == 404

    def test_delete_not_found(self, auth_client: TestClient) -> None:
        r = auth_client.delete("/garments/nonexistent-id")
        assert r.status_code == 204  # 幂等删除不报错


class TestCategoryFilter:
    def test_filter_by_category(self, auth_client: TestClient, mock_ai_service) -> None:
        fname, img_bytes = _make_test_image()
        auth_client.post(
            "/garments",
            files={"file": (fname, img_bytes, "image/jpeg")},
        )

        r = auth_client.get("/garments", params={"category": "top"})
        assert r.status_code == 200
        assert len(r.json()) == 1

        r2 = auth_client.get("/garments", params={"category": "dress"})
        assert r2.status_code == 200
        assert len(r2.json()) == 0
