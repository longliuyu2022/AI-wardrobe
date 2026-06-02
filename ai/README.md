# Wardrobe AI Service

独立于业务后端的 AI 推理服务。

## 职责

- **流水线 A**：单件衣物识别（属性 + 标签）
- **流水线 B**：全身照分部位裁剪（**核心差异化**）

## 技术选型

| 步骤 | 模型 | 协议 |
|------|------|------|
| 主分割（人体+服装语义） | SCHP-ATR / SegFormer-B2-clothes | MIT |
| 实例分离 | **RT-DETR-seg** + DeepFashion2 | Apache 2.0 |
| 抠图细化 | BiRefNet / rembg-isnet | MIT |
| 属性识别（主） | 阿里云 VIAPI RecognizeClothes | 商业 API |
| 长尾标签（兜底） | 豆包 vision-lite | 商业 API |

### ⚠️ 不要引入 YOLOv8/v9/v10/v11

它们是 **AGPL-3.0**，闭源商用不兼容。需要实例分割用 RT-DETR-seg 或 Mask R-CNN。

## 隐私

`segment-full-body` 收到全身照原图后，整张图只在内存里走一遍 pipeline，函数返回前显式 `del`。**原图不写 OSS、不写本地磁盘**。

## 开发

```bash
uv sync                     # MVP 桩实现，不需要 GPU
# 真正接模型：uv sync --extra gpu
cp .env.example .env
uv run uvicorn wardrobe_ai.main:app --reload --port 8001
```

打开 http://localhost:8001/docs。

## 项目布局

```
ai/
├── pyproject.toml
└── src/wardrobe_ai/
    ├── main.py
    ├── settings.py
    ├── pipelines/
    │   ├── single_item.py     流水线 A
    │   └── full_body.py       流水线 B（核心差异化）
    └── clients/
        ├── viapi.py           阿里云属性识别
        ├── vlm.py             豆包 VLM
        └── segmentation.py    SCHP / RT-DETR / BiRefNet
```

## 当前进度

骨架阶段，全部 clients 是桩实现，返回示意数据。Phase 0 需要：

1. SCHP-ATR 权重下载 + 服务端 GPU 部署
2. RT-DETR-seg + DeepFashion2 训练或下载预训练权重
3. 真实接入阿里云 VIAPI（access key 已留环境变量位）
4. 在 30-50 张真实全身照样本上跑通流水线 B，验证准确率 ≥85%
