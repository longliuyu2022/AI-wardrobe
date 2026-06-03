"""穿搭日历端点测试。"""
from __future__ import annotations

from fastapi.testclient import TestClient


def _make_test_image() -> tuple[str, bytes]:
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (100, 100), color="green").save(buf, format="JPEG")
    return "test.jpg", buf.getvalue()


def _create_garment(auth_client: TestClient, mock_ai_service) -> str:
    fname, img_bytes = _make_test_image()
    r = auth_client.post("/garments", files={"file": (fname, img_bytes, "image/jpeg")})
    return r.json()["id"]


class TestRecordWear:
    def test_record_wear_ok(self, auth_client: TestClient, mock_ai_service) -> None:
        gid = _create_garment(auth_client, mock_ai_service)
        r = auth_client.post("/wearlog", json={
            "garment_ids": [gid],
            "date": "2026-06-01",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["added"] == 1

    def test_record_wear_duplicate(self, auth_client: TestClient, mock_ai_service) -> None:
        gid = _create_garment(auth_client, mock_ai_service)
        auth_client.post("/wearlog", json={"garment_ids": [gid], "date": "2026-06-01"})
        r = auth_client.post("/wearlog", json={"garment_ids": [gid], "date": "2026-06-01"})
        assert r.status_code == 200
        assert r.json()["added"] == 0  # 重复不加

    def test_record_wear_bad_date(self, auth_client: TestClient) -> None:
        r = auth_client.post("/wearlog", json={
            "garment_ids": ["any-id"],
            "date": "not-a-date",
        })
        assert r.status_code == 400

    def test_record_wear_empty_ids(self, auth_client: TestClient) -> None:
        r = auth_client.post("/wearlog", json={"garment_ids": []})
        assert r.status_code == 422  # Pydantic min_length=1


class TestGetWearLog:
    def test_get_month_log(self, auth_client: TestClient, mock_ai_service) -> None:
        gid = _create_garment(auth_client, mock_ai_service)
        auth_client.post("/wearlog", json={"garment_ids": [gid], "date": "2026-06-01"})

        r = auth_client.get("/wearlog", params={"month": "2026-06"})
        assert r.status_code == 200
        data = r.json()
        assert data["month"] == "2026-06"
        assert "2026-06-01" in data["days"]
        assert gid in data["days"]["2026-06-01"]

    def test_get_empty_month(self, auth_client: TestClient) -> None:
        r = auth_client.get("/wearlog", params={"month": "2025-01"})
        assert r.status_code == 200
        assert r.json()["days"] == {}


class TestWearStats:
    def test_stats(self, auth_client: TestClient, mock_ai_service) -> None:
        gid = _create_garment(auth_client, mock_ai_service)
        auth_client.post("/wearlog", json={"garment_ids": [gid], "date": "2026-06-01"})
        auth_client.post("/wearlog", json={"garment_ids": [gid], "date": "2026-06-02"})

        r = auth_client.get("/wearlog/stats")
        assert r.status_code == 200
        data = r.json()
        assert data["total_wears"] == 2
        assert len(data["top"]) >= 1
        assert data["top"][0]["id"] == gid
