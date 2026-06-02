"""AI 搭配建议端点 — 按 session 隔离每个用户的衣柜。"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Garment
from ..security import require_session
from ..settings import settings

router = APIRouter(dependencies=[Depends(require_session)])


@router.post("/suggest")
async def suggest_outfits(
    count: int = Query(3, ge=1, le=6),
    db: Session = Depends(get_db),
    sid: str = Depends(require_session),
) -> list[dict]:
    """让 AI 从当前 session 的衣柜里组 N 套搭配。"""
    rows = db.query(Garment).filter(Garment.user_id == sid).all()
    if len(rows) < 2:
        return []

    payload = {
        "count": count,
        "garments": [
            {
                "id": g.id,
                "category": g.category,
                "sub_category": g.sub_category or "",
                "colors": g.colors or [],
                "season": g.season or [],
                "style": g.style or "",
            }
            for g in rows
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{settings.ai_service_url}/api/compose-outfits",
                json=payload,
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"AI service error: {resp.text[:200]}")
        d = resp.json()
        return d.get("outfits", [])
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"AI service unreachable: {e!r}") from e
