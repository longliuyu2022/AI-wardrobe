"""流水线 B：全身照 → 每件衣物的 bbox + 类目 + 主色。

MVP 实现：用 sensenova VLM 一次性识别所有衣物 + 输出归一化 xyxy bbox。
不在 ai service 做实际裁剪 — 后端拿 bbox 后用 Pillow 裁,落到自己的 data/uploads。
这样 ai service 保持无状态。

未来如果要做真正的像素级分割,可以替换为 SCHP / SegFormer / 阿里云 VIAPI。

⚠️ 隐私：image_bytes 只在内存里走一次 sensenova,函数结束 del 释放。原图不落盘。
"""
from __future__ import annotations

from ..clients.sensenova import sensenova_segment_clothes


async def segment_full_body(image_bytes: bytes) -> dict:
    """返回:
    {
      "items": [{"label", "category", "colors", "box": [x1,y1,x2,y2 归一化], "confidence"}],
      "warnings": [...]
    }
    """
    items = await sensenova_segment_clothes(image_bytes)
    warnings: list[str] = []
    if not items:
        warnings.append("AI 没识别出衣物。试试更清晰的全身照,或衣物轮廓更明显的角度。")
    del image_bytes
    return {"items": items, "warnings": warnings}
