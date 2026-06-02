"""数据导出 — 把用户的衣柜数据 + 图片打包成 ZIP 下载。"""
from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Garment, User
from ..security import require_session

router = APIRouter(dependencies=[Depends(require_session)])

UPLOADS_DIR = Path("data/uploads").resolve()


@router.get("")
def export_data(db: Session = Depends(get_db), sid: str = Depends(require_session)):
    """导出当前用户所有衣物数据 + 图片为 ZIP。"""
    user = db.get(User, sid)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="账号不存在")

    garments = db.query(Garment).filter(Garment.user_id == sid).order_by(Garment.created_at).all()

    # 构建元数据
    meta = {
        "user": {
            "user_id": user.id,
            "username": user.username,
            "nickname": user.nickname,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "exported_at": datetime.utcnow().isoformat(),
        "garment_count": len(garments),
        "garments": [],
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for g in garments:
            # 元数据
            g_data = {
                "id": g.id,
                "category": g.category,
                "sub_category": g.sub_category,
                "colors": g.colors,
                "season": g.season,
                "material": g.material,
                "style": g.style,
                "wear_count": g.wear_count,
                "purchase_price": float(g.purchase_price) if g.purchase_price else None,
                "purchase_link": g.purchase_link,
                "note": g.note,
                "created_at": g.created_at.isoformat() if g.created_at else None,
            }
            meta["garments"].append(g_data)

            # 图片
            if g.image_url:
                fname = g.image_url.rsplit("/", 1)[-1]
                img_path = UPLOADS_DIR / fname
                if img_path.exists():
                    arc_name = f"images/{g.id}.jpg"
                    zf.write(img_path, arc_name)
                    g_data["image_file"] = arc_name

        # 写元数据 JSON
        zf.writestr("garments.json", json.dumps(meta, ensure_ascii=False, indent=2))

    buf.seek(0)
    filename = f"wardrobe-export-{user.username}-{datetime.utcnow().strftime('%Y%m%d')}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
