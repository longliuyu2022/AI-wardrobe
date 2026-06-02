"""流水线 A：单件衣物识别。

输入：一件衣物的图（已抠图或带背景）。
输出：类目、子类、颜色、季节、材质、风格等属性。

策略：
1. 阿里云 VIAPI RecognizeClothes 拿主属性
2. 若置信度低或类目落到 "other"，调豆包 VLM 兜底长尾标签
3. 合并去重
"""

from ..clients.viapi import viapi_recognize_clothes
from ..clients.vlm import vlm_tag


async def identify_single_item(image_bytes: bytes) -> dict:
    primary = await viapi_recognize_clothes(image_bytes)

    confidence = primary.get("confidence", 1.0)
    if confidence < 0.6 or primary.get("category") == "other":
        long_tail = await vlm_tag(image_bytes)
        tags = primary.setdefault("tags", [])
        for t in long_tail:
            if t not in tags:
                tags.append(t)

    return primary
