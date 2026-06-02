"""人体解析 + 服装实例分割。

主流水线（Phase 0 待实现）：
1. SCHP-ATR (MIT) 做 18 类人体+服装语义分割
2. RT-DETR-seg + DeepFashion2 做实例分离
3. BiRefNet 做二次细化抠图

⚠️ 协议红线：不要引入 YOLOv8/v9/v10/v11（AGPL-3.0）。需要实例分割用
   RT-DETR-seg 或 Mask R-CNN（Apache 2.0）。

当前是桩实现 — 真实模型需要 GPU + 权重文件。
"""

from io import BytesIO

from PIL import Image


# 我们的产品类目体系（对齐 schemas.GarmentCategory）
SUPPORTED_CATEGORIES = [
    "top",
    "outerwear",
    "bottom",
    "dress",
    "shoes",
    "bag",
    "accessory",
]

# SCHP-ATR 18 类标签 → 我们的类目
ATR_TO_OUR_CATEGORY = {
    "upper-clothes": "top",
    "coat": "outerwear",
    "pants": "bottom",
    "skirt": "bottom",
    "dress": "dress",
    "left-shoe": "shoes",
    "right-shoe": "shoes",
    "bag": "bag",
    "hat": "accessory",
    "scarf": "accessory",
    "belt": "accessory",
    "sunglasses": "accessory",
}


async def segment_clothes_by_category(image_bytes: bytes) -> dict[str, bytes]:
    """返回 {our_category: rgba_png_bytes}。找不到的类别不在 dict 里。

    桩实现：把整张图按 top + bottom 复制两份返回，让前后端联调能跑通。
    """
    img = Image.open(BytesIO(image_bytes)).convert("RGBA")
    buf = BytesIO()
    img.save(buf, format="PNG")
    placeholder = buf.getvalue()
    return {
        "top": placeholder,
        "bottom": placeholder,
    }
