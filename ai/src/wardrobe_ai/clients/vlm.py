"""豆包 vision 长尾标签兜底。

用途：当 VIAPI 类目识别置信度不足、或类目落到 "other"（汉服/JK/IP 联名等长尾），
用 VLM 用自然语言描述补充标签。

API 文档：https://www.volcengine.com/docs/82379
"""

from ..settings import settings


PROMPT = (
    "请用 5-8 个中文标签描述这件服装的关键视觉特征，包括："
    "风格（如汉服/JK/Lolita/通勤/休闲/运动/复古）、"
    "图案（如条纹/格子/印花/纯色/IP联名）、"
    "材质感（如针织/牛仔/真丝/雪纺）、"
    "其他显眼细节（如荷叶边/泡泡袖/破洞）。"
    "只输出标签，逗号分隔，不要解释。"
)


async def vlm_tag(image_bytes: bytes) -> list[str]:
    """返回 VLM 生成的标签列表。"""
    if settings.sensenova_api_key:
        # 优先走 SenseNova (已实现, 免费 quota)
        from .sensenova import sensenova_long_tail_tags
        return await sensenova_long_tail_tags(image_bytes)

    if not settings.doubao_api_key:
        return ["_stub_tag"]
    # TODO: 调用豆包 vision API
    #   - 图像走 base64 或先上传 OSS 拿 URL
    #   - 用 OpenAI 兼容协议
    raise NotImplementedError("接入豆包 VLM")
