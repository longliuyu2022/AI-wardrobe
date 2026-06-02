"""穿搭日历 — 记录每天穿了哪些衣物。"""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Garment, WearLog
from ..security import require_session

router = APIRouter(dependencies=[Depends(require_session)])


class RecordWearBody(BaseModel):
    garment_ids: list[str] = Field(..., min_length=1, max_length=50)
    date: str | None = None  # "2026-05-28", 默认今天


@router.post("")
def record_wear(
    body: RecordWearBody,
    db: Session = Depends(get_db),
    sid: str = Depends(require_session),
) -> dict:
    """记录今天（或指定日期）穿了哪些衣物。"""
    worn_date = body.date or datetime.utcnow().strftime("%Y-%m-%d")
    # 校验日期格式
    try:
        datetime.strptime(worn_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式应为 YYYY-MM-DD")

    added = 0
    for gid in body.garment_ids:
        g = db.get(Garment, gid)
        if not g or g.user_id != sid:
            continue
        # 防重复：同一天同一衣物只记一次
        exists = db.query(WearLog).filter(
            WearLog.user_id == sid,
            WearLog.garment_id == gid,
            WearLog.worn_date == worn_date,
        ).first()
        if exists:
            continue
        db.add(WearLog(user_id=sid, garment_id=gid, worn_date=worn_date))
        g.wear_count = (g.wear_count or 0) + 1
        added += 1

    db.commit()
    return {"ok": True, "added": added, "date": worn_date}


@router.get("")
def get_wear_log(
    month: str | None = None,
    db: Session = Depends(get_db),
    sid: str = Depends(require_session),
) -> dict:
    """获取当月每天的穿次记录。month=2026-05，默认当月。"""
    if month:
        try:
            datetime.strptime(month + "-01", "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="month 格式应为 YYYY-MM")
    else:
        month = datetime.utcnow().strftime("%Y-%m")

    logs = db.query(WearLog).filter(
        WearLog.user_id == sid,
        WearLog.worn_date.like(f"{month}-%"),
    ).all()

    days: dict[str, list[str]] = {}
    for log in logs:
        days.setdefault(log.worn_date, []).append(log.garment_id)

    return {"month": month, "days": days}


@router.get("/stats")
def wear_stats(
    db: Session = Depends(get_db),
    sid: str = Depends(require_session),
) -> dict:
    """穿搭统计：最常穿 top10、最近 7 天每天穿次。"""
    # 最常穿 top10
    top_rows = (
        db.query(Garment.id, Garment.sub_category, Garment.category, Garment.image_url, Garment.wear_count)
        .filter(Garment.user_id == sid, Garment.wear_count > 0)
        .order_by(Garment.wear_count.desc())
        .limit(10)
        .all()
    )
    top = [
        {"id": r.id, "sub_category": r.sub_category, "category": r.category, "image_url": r.image_url, "wear_count": r.wear_count}
        for r in top_rows
    ]

    # 最近 7 天
    today = datetime.utcnow().date()
    week_ago = (today - timedelta(days=6)).strftime("%Y-%m-%d")
    today_str = today.strftime("%Y-%m-%d")

    week_rows = (
        db.query(WearLog.worn_date, func.count(WearLog.id))
        .filter(WearLog.user_id == sid, WearLog.worn_date >= week_ago, WearLog.worn_date <= today_str)
        .group_by(WearLog.worn_date)
        .all()
    )
    week = {date: cnt for date, cnt in week_rows}

    # 总穿次
    total = db.query(func.count(WearLog.id)).filter(WearLog.user_id == sid).scalar() or 0

    return {"top": top, "week": week, "total_wears": total}
