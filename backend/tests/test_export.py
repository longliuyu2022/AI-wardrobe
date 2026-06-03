"""数据导出端点测试。"""
from __future__ import annotations

import io
import json
import zipfile

from fastapi.testclient import TestClient


def _make_test_image() -> tuple[str, bytes]:
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (100, 100), color="yellow").save(buf, format="JPEG")
    return "test.jpg", buf.getvalue()


class TestExport:
    def test_export_empty(self, auth_client: TestClient) -> None:
        r = auth_client.get("/export")
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/zip"

        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            names = zf.namelist()
            assert "garments.json" in names
            meta = json.loads(zf.read("garments.json"))
            assert meta["garment_count"] == 0

    def test_export_with_garments(self, auth_client: TestClient, mock_ai_service) -> None:
        fname, img_bytes = _make_test_image()
        auth_client.post("/garments", files={"file": (fname, img_bytes, "image/jpeg")})

        r = auth_client.get("/export")
        assert r.status_code == 200

        with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
            meta = json.loads(zf.read("garments.json"))
            assert meta["garment_count"] == 1
            # 应该有图片
            img_files = [n for n in zf.namelist() if n.startswith("images/")]
            assert len(img_files) == 1

    def test_export_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/export")
        assert r.status_code == 401
