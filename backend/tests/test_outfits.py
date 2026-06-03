"""搭配建议端点测试。"""
from __future__ import annotations

from fastapi.testclient import TestClient

from conftest import MOCK_IDENTIFY_RESPONSE


def _make_test_image() -> tuple[str, bytes]:
    from io import BytesIO
    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (100, 100), color="blue").save(buf, format="JPEG")
    return "test.jpg", buf.getvalue()


class TestSuggestOutfits:
    def test_suggest_with_enough_garments(self, auth_client: TestClient, mock_ai_service) -> None:
        # 需要至少 2 件衣物
        fname, img_bytes = _make_test_image()
        auth_client.post("/garments", files={"file": (fname, img_bytes, "image/jpeg")})
        auth_client.post("/garments", files={"file": (fname, img_bytes, "image/jpeg")})

        r = auth_client.post("/outfits/suggest", params={"count": 3})
        assert r.status_code == 200
        outfits = r.json()
        assert isinstance(outfits, list)
        # mock 返回 1 套
        assert len(outfits) >= 1
        assert "name" in outfits[0]
        assert "garment_ids" in outfits[0]

    def test_suggest_with_few_garments(self, auth_client: TestClient, mock_ai_service) -> None:
        # 只有 1 件 — 不够
        fname, img_bytes = _make_test_image()
        auth_client.post("/garments", files={"file": (fname, img_bytes, "image/jpeg")})

        r = auth_client.post("/outfits/suggest", params={"count": 3})
        assert r.status_code == 200
        assert r.json() == []

    def test_suggest_unauthenticated(self, client: TestClient) -> None:
        r = client.post("/outfits/suggest", params={"count": 3})
        assert r.status_code == 401
