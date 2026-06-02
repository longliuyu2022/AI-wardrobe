"""阿里云视觉智能开放平台（VIAPI）封装。

文档：https://help.aliyun.com/zh/viapi/developer-reference/api-overview
计费：https://help.aliyun.com/zh/viapi/product-overview/billing-is-introduced-14

当前是桩实现 — Phase 0 真实接入时填实 SDK 调用。
"""

from ..settings import settings


async def viapi_recognize_clothes(image_bytes: bytes) -> dict:
    """RecognizeClothes：类目 + 颜色 + 风格等属性。"""
    if settings.sensenova_api_key:
        # 优先走 SenseNova VLM (单一供应商, 免费 quota, 已实现)
        from .sensenova import sensenova_recognize_clothes
        return await sensenova_recognize_clothes(image_bytes)

    if not settings.viapi_access_key_id:
        # 桩
        return {
            "category": "top",
            "sub_category": "T恤",
            "colors": ["white"],
            "season": ["summer"],
            "material": "cotton",
            "style": "casual",
            "confidence": 0.92,
            "_stub": True,
        }
    # TODO: 使用 alibabacloud-imageseg / alibabacloud-imageenhan SDK
    raise NotImplementedError("接入阿里云 VIAPI")
