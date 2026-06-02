"""流水线 A 主端点 — MVP 简易模式。"""
from __future__ import annotations

import asyncio
import imghdr
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image, ImageOps
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Garment, User
from ..schemas import FullBodyResult, GarmentCategory, GarmentOut, GarmentUpdate
from ..security import require_session
from ..settings import settings

router = APIRouter(dependencies=[Depends(require_session)])

UPLOADS_DIR = Path("data/uploads").resolve()


def _save_upload(image_bytes: bytes, content_type: str | None) -> tuple[str, str]:
    """存图到 data/uploads/<id>.<ext>, 返回 (image_id, image_url)."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    # 用 magic bytes 推 ext, 不信任 client 给的 content_type
    sniffed = imghdr.what(None, h=image_bytes[:32]) or "bin"
    ext_map = {"jpeg": "jpg", "png": "png", "webp": "webp", "gif": "gif"}
    ext = ext_map.get(sniffed, "jpg")
    image_id = uuid.uuid4().hex
    target = UPLOADS_DIR / f"{image_id}.{ext}"
    target.write_bytes(image_bytes)
    # 通过 Next.js rewrite, 用户访问的 URL 是 /api/backend/uploads/<file>
    image_url = f"/api/backend/uploads/{image_id}.{ext}"
    return image_id, image_url


@router.get("", response_model=list[GarmentOut])
def list_garments(
    category: GarmentCategory | None = None,
    season: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    sid: str = Depends(require_session),
) -> list[GarmentOut]:
    q = db.query(Garment).filter(Garment.user_id == sid)
    if category:
        q = q.filter(Garment.category == category.value)
    rows = q.order_by(Garment.created_at.desc()).limit(limit).all()
    if season:
        rows = [g for g in rows if g.season and season in (g.season or [])]
    return [GarmentOut.model_validate(g) for g in rows]


@router.post("", response_model=GarmentOut, status_code=201)
async def create_from_single_item(
    file: UploadFile = File(...),
    category: GarmentCategory | None = Form(None),
    db: Session = Depends(get_db),
    sid: str = Depends(require_session),
) -> GarmentOut:
    """流水线 A：单件衣物。上传 → 本地落盘 → AI /identify → 落库。"""
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="empty file")
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="file too large (>20MB)")

    image_id, image_url = _save_upload(image_bytes, file.content_type)

    # 调 AI service 识别
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{settings.ai_service_url}/api/identify",
                files={"file": (file.filename or "upload.jpg", image_bytes, file.content_type or "image/jpeg")},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"AI service error: {resp.text[:200]}")
        attrs = resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"AI service unreachable: {e!r}") from e

    final_category = (category.value if category else attrs.get("category", "other"))

    g = Garment(
        id=image_id,
        user_id=sid,
        category=final_category,
        sub_category=attrs.get("sub_category"),
        colors=attrs.get("colors") or None,
        season=attrs.get("season") or None,
        material=attrs.get("material"),
        style=attrs.get("style"),
        image_url=image_url,
        thumbnail_url=None,
        wear_count=0,
        created_at=datetime.utcnow(),
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return GarmentOut.model_validate(g)


@router.post("/from-full-body", response_model=FullBodyResult, status_code=201)
async def create_from_full_body(
    file: UploadFile = File(...),
    auto_confirm: bool = Form(False),
    db: Session = Depends(get_db),
    sid: str = Depends(require_session),
) -> FullBodyResult:
    """流水线 B：全身照 → AI 拿 bbox → 后端裁出每件 → 落库。"""
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="empty file")
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="file too large (>20MB)")


    # 调 ai service segment
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(
                f"{settings.ai_service_url}/api/segment-full-body",
                files={"file": (file.filename or "upload.jpg", image_bytes, file.content_type or "image/jpeg")},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"AI service error: {resp.text[:200]}")
        seg = resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"AI service unreachable: {e!r}") from e

    items_meta = seg.get("items") or []
    warnings = list(seg.get("warnings") or [])

    if not items_meta:
        return FullBodyResult(items=[], warnings=warnings or ["AI 没识别出衣物"])

    # 用 Pillow 裁切每个 bbox
    try:
        im = Image.open(BytesIO(image_bytes))
        im = ImageOps.exif_transpose(im).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无法读取图片: {e!r}") from e
    W, H = im.size
    PAD = 0.03
    px = int(W * PAD); py = int(H * PAD)

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    # 第一遍: 裁出所有 crops 到内存 (bytes), 同时准备 meta
    prepared: list[tuple[dict, bytes, str]] = []  # (meta, crop_bytes, crop_id)
    for meta in items_meta:
        box = meta.get("box")
        if not box or len(box) != 4:
            warnings.append(f"忽略 {meta.get('label')}: bbox 无效")
            continue
        x1n, y1n, x2n, y2n = [float(v) for v in box]
        x1 = max(0, int(x1n * W) - px)
        y1 = max(0, int(y1n * H) - py)
        x2 = min(W, int(x2n * W) + px)
        y2 = min(H, int(y2n * H) + py)
        if x2 - x1 < 20 or y2 - y1 < 20:
            warnings.append(f"忽略 {meta.get('label')}: 裁切区域过小")
            continue
        try:
            crop = im.crop((x1, y1, x2, y2))
            buf = BytesIO()
            crop.save(buf, "JPEG", quality=88)
            crop_bytes = buf.getvalue()
            crop_id = uuid.uuid4().hex
            (UPLOADS_DIR / f"{crop_id}.jpg").write_bytes(crop_bytes)
            prepared.append((meta, crop_bytes, crop_id))
        except Exception as e:
            warnings.append(f"忽略 {meta.get('label')}: 裁切失败 {e!r}")
            continue

    # 第二遍: 并行 (asyncio.gather) 调 /api/identify 给每个 crop 拿完整属性
    # (season / material / style / tags), 比 segmentation 单跑提供更精细的描述
    async def _enrich(client: httpx.AsyncClient, crop_bytes: bytes, meta: dict) -> dict:
        try:
            resp = await client.post(
                f"{settings.ai_service_url}/api/identify",
                files={"file": ("crop.jpg", crop_bytes, "image/jpeg")},
            )
            if resp.status_code == 200:
                attrs = resp.json() or {}
                seg_cat = meta.get("category")
                id_cat = attrs.get("category")
                # identify 跑出的类目跟 segment 不一致 → 大概率是 crop 太小 / 上下文不
                # 全, identify 看错了 (例: 鞋 crop 带了点裤腿被识别为"裤"). 信任 segment
                # 的类目 + label, 丢弃 identify 的脏数据。
                if seg_cat and id_cat and seg_cat != id_cat:
                    return meta
                # 同类目: 合并 (identify 提供 season/material/style/sub_category 更细)
                merged = {**meta, **attrs, "category": seg_cat or id_cat}
                # segment 的 label 比 identify 的 sub_category 通常更精确 (有位置提示)
                if meta.get("label") and not attrs.get("sub_category"):
                    merged["sub_category"] = meta["label"]
                return merged
        except Exception:
            pass
        return meta

    async with httpx.AsyncClient(timeout=120) as client:
        enriched = await asyncio.gather(*[
            _enrich(client, cb, m) for (m, cb, _) in prepared
        ])

    # 第三遍: 写库
    saved: list[Garment] = []
    for (_, _, crop_id), attrs in zip(prepared, enriched):
        # 子类: 优先用 identify 的 sub_category, 否则 segment 的 label
        sub_cat = attrs.get("sub_category") or attrs.get("label")
        g = Garment(
            id=crop_id,
            user_id=sid,
            category=attrs.get("category", "other"),
            sub_category=sub_cat or None,
            colors=list(attrs.get("colors") or []) or None,
            season=list(attrs.get("season") or []) or None,
            material=attrs.get("material") or None,
            style=attrs.get("style") or None,
            image_url=f"/api/backend/uploads/{crop_id}.jpg",
            thumbnail_url=None,
            wear_count=0,
            created_at=datetime.utcnow(),
        )
        db.add(g)
        saved.append(g)

    db.commit()
    # 隐私: 原图 image_bytes 函数结束自动 GC, 不入 uploads, 不入 OSS
    del image_bytes

    return FullBodyResult(
        items=[GarmentOut.model_validate(g) for g in saved],
        warnings=warnings,
    )


@router.get("/{garment_id}", response_model=GarmentOut)
def get_garment(garment_id: str, db: Session = Depends(get_db), sid: str = Depends(require_session)) -> GarmentOut:
    g = db.get(Garment, garment_id)
    if not g or g.user_id != sid:
        raise HTTPException(status_code=404, detail="not found")
    return GarmentOut.model_validate(g)


@router.patch("/{garment_id}", response_model=GarmentOut)
def update_garment(
    garment_id: str,
    body: GarmentUpdate,
    db: Session = Depends(get_db),
    sid: str = Depends(require_session),
) -> GarmentOut:
    g = db.get(Garment, garment_id)
    if not g or g.user_id != sid:
        raise HTTPException(status_code=404, detail="not found")
    data = body.model_dump(exclude_unset=True)
    if "category" in data and data["category"] is not None:
        data["category"] = data["category"].value if hasattr(data["category"], "value") else str(data["category"])
    # 空字符串当成 null (UI 清空时友好)
    for k in ("sub_category", "material", "style", "purchase_link", "note"):
        if k in data and data[k] == "":
            data[k] = None
    for k, v in data.items():
        setattr(g, k, v)
    db.commit()
    db.refresh(g)
    return GarmentOut.model_validate(g)


@router.delete("/{garment_id}", status_code=204)
def delete_garment(garment_id: str, db: Session = Depends(get_db), sid: str = Depends(require_session)) -> None:
    g = db.get(Garment, garment_id)
    if g and g.user_id == sid:
        # 同步删本地图片文件
        if g.image_url and g.image_url.startswith("/api/backend/uploads/"):
            fname = g.image_url.rsplit("/", 1)[-1]
            f = UPLOADS_DIR / fname
            try:
                f.unlink(missing_ok=True)
            except OSError:
                pass
        db.delete(g)
        db.commit()
    return None
