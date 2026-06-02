from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel, Field

from .clients.sensenova import sensenova_compose_outfits
from .pipelines.full_body import segment_full_body
from .pipelines.single_item import identify_single_item


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 真实接入时在这里加载 SCHP / RT-DETR / BiRefNet 到 GPU。
    # MVP 桩阶段无需加载，靠外部 API + 桩函数。
    yield


app = FastAPI(
    title="Wardrobe AI",
    version="0.1.0",
    description=(
        "AI 推理服务。\n\n"
        "- /api/identify: 流水线 A，单件衣物 → 属性\n"
        "- /api/segment-full-body: 流水线 B，全身照 → 多件服装单品（核心差异化）\n"
        "- /api/compose-outfits: 从衣物列表挑选搭配\n\n"
        "⚠️ 隐私：全身照原图只在内存中处理，不落盘。"
    ),
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "wardrobe-ai", "version": "0.1.0"}


@app.post("/api/identify")
async def identify(file: UploadFile = File(...)) -> dict:
    """单件衣物识别。"""
    image = await file.read()
    return await identify_single_item(image)


@app.post("/api/segment-full-body")
async def segment(file: UploadFile = File(...)) -> dict:
    """全身照分部位裁剪。返回每件单品的属性 + 临时 URL。"""
    image = await file.read()
    return await segment_full_body(image)


class ComposeOutfitsBody(BaseModel):
    garments: list[dict]
    count: int = Field(3, ge=1, le=6)


@app.post("/api/compose-outfits")
async def compose_outfits(body: ComposeOutfitsBody) -> dict:
    """从衣物列表 (含 id/category/colors/season/style 等) 挑 N 套搭配。"""
    if not body.garments:
        return {"outfits": []}
    outfits = await sensenova_compose_outfits(body.garments, count=body.count)
    return {"outfits": outfits}
