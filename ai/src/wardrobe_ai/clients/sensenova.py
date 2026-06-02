"""SenseNova VLM 客户端 — 多模态图像理解。

endpoint: https://token.sensenova.cn/v1/chat/completions (OpenAI 兼容)
model:    sensenova-6.7-flash-lite (多模态, 用户 plan 内免费)
"""
from __future__ import annotations

import base64
import json
import re
from io import BytesIO

import httpx
from PIL import Image

from ..settings import settings

# 图片传输上限 - 太大会 write timeout. 768px 长边对服装识别足够
MAX_IMAGE_DIM = 768
JPEG_QUALITY = 85
# 6.7-flash-lite 是 reasoning 模型, 多目标 prompt 会在 reasoning 里反复纠结,
# 需要 3000+ tokens 留给思考 + JSON 输出
DEFAULT_MAX_TOKENS = 3500
DEFAULT_TIMEOUT = 180.0


def _shrink_image(image_bytes: bytes) -> bytes:
    """重压到 <= MAX_IMAGE_DIM, JPEG, 防上传超时。"""
    im = Image.open(BytesIO(image_bytes))
    if im.mode in ("P", "RGBA", "LA"):
        im = im.convert("RGB")
    im.thumbnail((MAX_IMAGE_DIM, MAX_IMAGE_DIM))
    buf = BytesIO()
    im.save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True)
    return buf.getvalue()


def _extract_json(text: str) -> dict | None:
    """从 LLM 输出里挖第一个 JSON 对象 (容忍 markdown 代码块包裹)。"""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
    return None


async def sensenova_chat_with_image(
    prompt: str, image_bytes: bytes,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    json_mode: bool = False,
) -> dict:
    """对图发问。返回 {'text': raw, 'parsed': dict|None, 'usage': {...}}。

    json_mode=True 时启用 response_format=json_object,减少 reasoning 模型纠结。
    """
    if not settings.sensenova_api_key:
        raise RuntimeError("SENSENOVA_API_KEY 未配置")

    img = _shrink_image(image_bytes)
    b64 = base64.b64encode(img).decode()

    body: dict = {
        "model": settings.sensenova_model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            ],
        }],
        "max_tokens": max_tokens,
        "temperature": 0.1,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    headers = {"Authorization": f"Bearer {settings.sensenova_api_key}"}
    url = f"{settings.sensenova_base_url}/v1/chat/completions"

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        r = await client.post(url, json=body, headers=headers)
    r.raise_for_status()
    d = r.json()
    msg = d["choices"][0]["message"]
    # reasoning 模型: 优先 content, 没有就用 reasoning 末尾 (兜底)
    raw = msg.get("content") or msg.get("reasoning") or ""
    return {
        "text": raw,
        "parsed": _extract_json(raw),
        "usage": d.get("usage", {}),
        "finish_reason": d["choices"][0].get("finish_reason"),
    }


CLOTHES_PROMPT = (
    "图里如果有多件服装, 只选**画面占比最大的那一件**, 不要纠结其他件。\n"
    "用 JSON 描述选中的那件:\n"
    "- category: 单值之一: top / outerwear / bottom / dress / shoes / bag / accessory\n"
    "- sub_category: 中文子类 (例: T 恤/连衣裙/牛仔裤/运动鞋)\n"
    "- colors: 主色数组, 英文小写, 1-3 个 (例: white/black/blue)\n"
    "- season: 适合季节数组 (spring/summer/autumn/winter)\n"
    "- material: 材质 (cotton/denim/wool/leather/polyester 等)\n"
    "- style: 风格 (casual/formal/sporty/vintage/streetwear/business 等)\n"
    "- tags: 5-8 个中文特征标签 (花色/版型/细节)\n"
    "- confidence: 0-1 自评\n\n"
    "立即输出 JSON, 不要多想, 不要 markdown 包裹。"
)


async def sensenova_recognize_clothes(image_bytes: bytes) -> dict:
    """对接 single_item 流水线 — 返回 viapi 格式的结构化属性。"""
    result = await sensenova_chat_with_image(CLOTHES_PROMPT, image_bytes, json_mode=True)
    parsed = result["parsed"] or {}
    return {
        "category": parsed.get("category", "other"),
        "sub_category": parsed.get("sub_category", ""),
        "colors": parsed.get("colors", []),
        "season": parsed.get("season", []),
        "material": parsed.get("material", ""),
        "style": parsed.get("style", ""),
        "tags": parsed.get("tags", []),
        "confidence": float(parsed.get("confidence", 0.85)),
        "_source": "sensenova",
        "_raw": None if result["parsed"] else result["text"][:500],
    }


LONG_TAIL_PROMPT = (
    "用 5-8 个中文标签描述这件服装的关键视觉特征: "
    "风格 (汉服/JK/Lolita/通勤/休闲/运动/复古)、"
    "图案 (条纹/格子/印花/纯色/IP 联名)、"
    "材质感 (针织/牛仔/真丝/雪纺)、"
    "其他显眼细节 (荷叶边/泡泡袖/破洞)。"
    "只输出逗号分隔的标签, 不要解释, 不要 JSON, 不要 markdown。"
)


async def sensenova_long_tail_tags(image_bytes: bytes) -> list[str]:
    result = await sensenova_chat_with_image(LONG_TAIL_PROMPT, image_bytes, max_tokens=200)
    raw = result["text"].strip().strip(".,。, \n")
    parts = re.split(r"[,、,\n]+", raw)
    return [p.strip() for p in parts if p.strip()][:8]


SEGMENT_PROMPT = (
    "识别图里每一件**衣物 / 鞋 / 包** (跳过项链/手表/眼镜等配饰)。\n"
    "**鞋只算一项**, 不要分左右; 如果有两只一模一样的, 合并到一个 box 框住两只。\n\n"
    "每项 JSON 字段:\n"
    "- label: 中文名 (衬衫 / T 恤 / 牛仔裤 / 西装裤 / 运动鞋 / 单肩包 / 双肩包 / 连衣裙 ...)\n"
    "- category: top / outerwear / bottom / dress / shoes / bag (不要 accessory)\n"
    "- colors: 主色数组, 英文小写 1-3 个 (例: white/black/blue/beige)\n"
    "- box: [x_min, y_min, x_max, y_max], 4 个 0-1 之间的小数, 表示该物体相对位置 "
    "(左上 0,0 右下 1,1)。必须满足 x_min < x_max, y_min < y_max。\n"
    "- confidence: 0-1\n\n"
    "示例:\n"
    "  衬衫位于图中央偏上 → box: [0.30, 0.20, 0.75, 0.55]\n"
    "  双脚的鞋一起框  → box: [0.35, 0.90, 0.65, 0.99]\n\n"
    "如果是连衣裙 (dress), 不要再单独输出 top/bottom, 只输出 dress 一项。\n"
    "如果图里没人或没衣物, 返回 {\"items\": []}。\n"
    "格式 {\"items\": [...]}。立即输出 JSON, 不要 markdown, 不要思考过程。"
)


async def sensenova_segment_clothes(image_bytes: bytes) -> list[dict]:
    """流水线 B: 全身照 → 每件衣物的 bbox + 类目 + 主色。

    返回: [{"label", "category", "colors", "box", "confidence"}, ...]
    box 是归一化 xyxy: [x_min, y_min, x_max, y_max] (0-1)。
    """
    result = await sensenova_chat_with_image(
        SEGMENT_PROMPT, image_bytes, max_tokens=3000, json_mode=True,
    )
    parsed = result["parsed"] or {}
    items = parsed.get("items") or []
    # 校验 + 过滤
    cleaned = []
    valid_cats = {"top", "outerwear", "bottom", "dress", "shoes", "bag"}
    for it in items:
        box = it.get("box") or it.get("bbox")
        cat = (it.get("category") or "").lower()
        if not isinstance(box, list) or len(box) != 4:
            continue
        if cat not in valid_cats:
            continue
        try:
            x1, y1, x2, y2 = [float(v) for v in box]
        except (TypeError, ValueError):
            continue
        # clamp 到 [0, 1] + 校验顺序
        x1 = max(0.0, min(1.0, x1)); y1 = max(0.0, min(1.0, y1))
        x2 = max(0.0, min(1.0, x2)); y2 = max(0.0, min(1.0, y2))
        if x2 <= x1 or y2 <= y1:
            continue
        cleaned.append({
            "label": str(it.get("label", ""))[:32],
            "category": cat,
            "colors": list(it.get("colors") or [])[:3],
            "box": [x1, y1, x2, y2],
            "confidence": float(it.get("confidence", 0.85)),
        })
    # 兜底: 同一类目多项时, 鞋只保留最大面积那一只 (防模型仍输出左右两只)
    SINGLETON = {"shoes"}
    by_cat: dict[str, list[dict]] = {}
    for c in cleaned:
        by_cat.setdefault(c["category"], []).append(c)
    deduped = []
    for cat, group in by_cat.items():
        if cat in SINGLETON and len(group) > 1:
            best = max(group, key=lambda c: (c["box"][2] - c["box"][0]) * (c["box"][3] - c["box"][1]))
            deduped.append(best)
        else:
            deduped.extend(group)

    # IoU 去重: 两个框重叠面积超过 50% 时, 只保留置信度高的那个
    # (防止 VLM 对同一件衣服同时返回 top+outerwear 等重叠检测)
    def _iou(a: list[float], b: list[float]) -> float:
        x1 = max(a[0], b[0]); y1 = max(a[1], b[1])
        x2 = min(a[2], b[2]); y2 = min(a[3], b[3])
        inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        area_a = (a[2] - a[0]) * (a[3] - a[1])
        area_b = (b[2] - b[0]) * (b[3] - b[1])
        union = area_a + area_b - inter
        return inter / union if union > 0 else 0.0

    IOU_THRESH = 0.5
    # 按置信度降序排列, 依次与已保留的框比较
    deduped.sort(key=lambda c: c["confidence"], reverse=True)
    final: list[dict] = []
    for item in deduped:
        if not any(_iou(item["box"], kept["box"]) > IOU_THRESH for kept in final):
            final.append(item)

    return final


async def sensenova_chat_text(prompt: str, max_tokens: int = DEFAULT_MAX_TOKENS, json_mode: bool = True) -> dict:
    """纯文本对话 (无图)。"""
    if not settings.sensenova_api_key:
        raise RuntimeError("SENSENOVA_API_KEY 未配置")
    body: dict = {
        "model": settings.sensenova_model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    headers = {"Authorization": f"Bearer {settings.sensenova_api_key}"}
    url = f"{settings.sensenova_base_url}/v1/chat/completions"
    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        r = await client.post(url, json=body, headers=headers)
    r.raise_for_status()
    d = r.json()
    msg = d["choices"][0]["message"]
    raw = msg.get("content") or msg.get("reasoning") or ""
    return {"text": raw, "parsed": _extract_json(raw), "usage": d.get("usage", {})}


OUTFIT_PROMPT_TEMPLATE = """从下面衣柜挑 {count} 套搭配。立即按 JSON 格式给答案,严禁犹豫纠结。

衣柜 (只有这些, 没有其它):
{garments_json}

灵活规则 (重要 - 严格执行):
- 衣柜里**有什么就用什么**, 完全不要假设衣柜外还有别的衣物
- 一套搭配可以只有 1-3 件 (如只有上衣 → 那就只推荐"今日上衣")
- 如果衣柜全是同类 (例: 全是 T 恤), 仍要凑出 {count} 套, 每套换不同 id
- 季节/风格/颜色尽量协调, 但**不要因为不完美就拒绝输出**

输出格式 (严格遵守, 不要 markdown, 不要任何额外文字):
{{"outfits":[
  {{"name":"中文短名","reason":"1 句中文亮点说明","garment_ids":["<id>","<id>"]}}
]}}

garment_ids 里只能用衣柜里的真实 id。立刻输出 JSON。"""


async def sensenova_compose_outfits(garments: list[dict], count: int = 3) -> list[dict]:
    """让 VLM 从衣物列表挑出 N 套搭配。返回 [{name, reason, garment_ids}]。"""
    # 只给模型必要字段 (省 tokens)
    lite = [
        {
            "id": g["id"],
            "category": g.get("category"),
            "sub_category": g.get("sub_category"),
            "colors": g.get("colors"),
            "season": g.get("season"),
            "style": g.get("style"),
        }
        for g in garments
    ]
    import json as _json
    prompt = OUTFIT_PROMPT_TEMPLATE.format(
        count=count,
        garments_json=_json.dumps(lite, ensure_ascii=False, indent=2),
    )
    result = await sensenova_chat_text(prompt, max_tokens=4000, json_mode=True)
    parsed = result["parsed"] or {}
    outfits = parsed.get("outfits") or []
    # 过滤无效 id
    valid_ids = {g["id"] for g in garments}
    cleaned = []
    for o in outfits[:count]:
        ids = [i for i in (o.get("garment_ids") or []) if i in valid_ids]
        if not ids:
            continue
        cleaned.append({
            "name": str(o.get("name", "")),
            "reason": str(o.get("reason", "")),
            "garment_ids": ids,
        })
    return cleaned
