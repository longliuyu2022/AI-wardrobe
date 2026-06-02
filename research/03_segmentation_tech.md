# 03. 服装单品识别与分割技术调研

> 目标：用户上传一张全身照 → APP 自动切出"上衣 / 外套 / 裤子 / 裙子 / 鞋 / 包 / 配饰"等多张单品图（可选去背景），Android + Web 双端。
>
> 说明：本报告基于截至 2026/01 的公开技术资料整理。环境中 WebSearch/WebFetch 不可用，因此对版本号、价格、QPS 等动态数据建议上线前用官方文档复核（文中已标 ⚠️）。

---

## 0. TL;DR

- **主干**：用 **SCHP (ATR 18 类)** 做人体细粒度部位语义分割（覆盖上衣/外套/裤/裙/鞋/帽/包/连衣裙）。
- **补强**：用 **YOLOv8-seg / RT-DETR + DeepFashion2** 做服装实例检测（解决"两只鞋""一上衣一外套"的实例分离问题）。
- **去背景**：单品裁出后再过一遍 **BiRefNet / rembg(isnet-general-use)**，电商风 PNG。
- **可选**：用 **Grounded-SAM 2** 做开放词汇兜底（"丝巾""手表""墨镜" 这种 SCHP 没有的类别）。
- **国内云 API**：阿里云视觉智能开放平台 / 百度 EasyDL / 腾讯 TI 都有"通用人像分割"，但**没有现成的细粒度服装单品 API**，只能用于"整体去背景"步骤。
- **端侧**：Android 用 MNN/NCNN 跑 SCHP-lite + MODNet；Web 用 onnxruntime-web + WebGPU，首屏延迟 2–5s 可接受，建议**走服务端**。

---

## 1. 人体解析（Human Parsing）模型

人体解析 = 把人像按"身体部位+衣物部位"做**像素级语义分割**，每个像素分一个类别。这是本场景最契合的技术路线。

### 1.1 常用数据集与类别覆盖

| 数据集 | 类别数 | 服装相关类别 | 适用性 |
|---|---|---|---|
| **LIP** (Look Into Person) | 20 | hat, hair, sunglasses, **upper-clothes, dress, coat, socks, pants, jumpsuits, scarf, skirt**, face, **left/right-arm, left/right-leg, left/right-shoe** | ⭐⭐⭐⭐ 类别全面，但单图人少，姿态偏正 |
| **ATR** | 18 | hat, hair, sunglass, **upper-clothes, skirt, pants, dress, belt, left/right-shoe**, face, **left/right-leg, left/right-arm, bag, scarf** | ⭐⭐⭐⭐⭐ 包/腰带/围巾都有，最贴合电商衣柜 |
| **CIHP** | 20 | 同 LIP 但带实例分割，可分多人 | ⭐⭐⭐ 多人场景才需要 |
| **Pascal-Person-Part** | 7 | 仅 head/torso/arms/legs | ✗ 太粗 |
| **DeepFashion2** | 13 服装类别 | short/long sleeve top, short/long sleeve outwear, vest, sling, shorts, trousers, skirt, short/long sleeve dress, vest dress, sling dress | ⭐⭐⭐⭐ 服装细分最细但**没有鞋/包/配饰** |

**结论**：**ATR 是衣柜场景命中率最高的标签体系**（带 bag/belt/scarf），LIP 次之，DeepFashion2 用来补"长短袖区分"。

### 1.2 SCHP（Self-Correction for Human Parsing, TPAMI 2020/2022）

- 仓库：`GoGoDuck912/Self-Correction-Human-Parsing`，**MIT License**。
- 提供 3 个权重：`atr.pth` / `lip.pth` / `pascal.pth`，各对应不同标签体系。
- 主干：ResNet-101 + CE2P，输入 473×473 或 512×512。
- **mIoU**：LIP 59.36，ATR 82.29（论文数据），属于该任务长期 SOTA 基线。
- 推理速度：单图 RTX 3060 大约 80–120ms；CPU x86 约 1.5–2.5s。
- **优点**：开箱即用，权重稳定，预测掩膜边界相对干净。
- **缺点**：(1) 单人模型，多人场景需要先 crop；(2) ResNet-101 体积约 250MB，端侧偏大；(3) 长款外套 vs 连衣裙、上衣 vs 外套 容易混淆。

> 实战提示：**用 ATR 权重 + 自定义合并表**（如 hat/sunglass/scarf/bag/belt → "配饰"；upper-clothes → "上衣"；coat 通过 DeepFashion2 二次判别归到"外套"）。

### 1.3 Graphonomy（CVPR 2019 / TPAMI 2021）

- 跨数据集图卷积人体解析，可同时输出 LIP+ATR+Pascal 三套标签的迁移结果。
- 工程上**精度并不显著优于 SCHP**，且代码维护活跃度低，不推荐作为线上主力。

### 1.4 2023–2025 较新方向

- **Sapiens (Meta, 2024)** ⚠️：基于 ViT-Huge 在 3 亿张人像上预训练，提供 part segmentation / depth / normal / pose 多任务权重，part seg 类别也是 28 类（含服装细分）。**精度显著高于 SCHP**，但模型 0.3B–2B 参数，**只能放服务端**。
- **OneFormer / Mask2Former + 人像 fine-tune**：可在 LIP/ATR 上微调，mIoU 普遍 +2–3 vs SCHP，工程上需要自训。
- **SegFormer-B5 + LIP**：HuggingFace `mattmdjaga/segformer_b2_clothes` 这种社区微调权重，**18 类服装解析**，是目前 HF 上最易部署的人体解析模型，推理快（B2 约 30ms@GPU）。**强烈推荐作为基线**。
- **HumanSD / HumanParser-Diffusion** ⚠️：扩散模型路线，论文阶段，未量产。

---

## 2. 通用分割模型（SAM 系）

### 2.1 SAM / SAM 2 (Meta)

- **SAM 1** (2023)：ViT-H/L/B 三档，prompt = 点 / 框 / mask。**不带类别**，需要外部 prompt 来源。
- **SAM 2** (2024)：增加视频时序，图像质量也更好，Hiera 主干，速度比 SAM1-H 快 6×。
- 衣柜场景**单独用 SAM 没意义**，必须配文本检测器。

### 2.2 Grounded-SAM / Grounding-DINO

- **Grounded-SAM**：Grounding-DINO（开放词汇检测）输出框 → SAM 出 mask。
- **优势**：可以用自然语言 `"shirt . jacket . pants . skirt . shoes . handbag . hat"`（注意句号分隔）一次性出全部目标。
- **类别灵活度**：对"丝巾、手表、墨镜、皮带、领带"这种 SCHP 没有的长尾配饰特别有效。
- **代价**：Grounding-DINO Swin-T 大约 170MB，SAM-H 约 2.4GB；端到端 GPU 推理 0.5–1.2s/张，**显存 6GB+**。
- **Grounded-SAM 2 (2024)**：用 Grounding-DINO 1.5 / Florence-2 + SAM2，速度和精度都更好。
- **LangSAM**：上面流程的 PyPI 包装，API 极简，适合原型期。

### 2.3 国内类似方案

- 百度文心 ERNIE-SAM、阿里 EVF-SAM、智源 SegGPT 等。
- **GLEE (CVPR 2024)**：南大+商汤的通用对象检测分割大模型，开放词汇能力对中文标签兼容性一般，需要英文提示。
- 实际工程里，**Grounded-SAM 仍是开源首选**，没有特别强的国内替代。

---

## 3. 服装目标检测/实例分割

### 3.1 DeepFashion2 是关键资产

- 80 万训练样本，13 类细分服装，**带实例 mask + 关键点 + 颜色 + 风格**。
- 直接训练 YOLO/Mask R-CNN 是行业标准做法。

### 3.2 候选模型

| 模型 | 优势 | 劣势 |
|---|---|---|
| **YOLOv8-seg** | Ultralytics 生态，导出 ONNX/TFLite/CoreML 一键，端侧友好 | 小目标（鞋、包）召回稍弱 |
| **YOLOv9 / v10 / v11-seg** | 速度精度边界更优，v10 无 NMS | 部分版本依赖较新 |
| **RT-DETR-seg** | Transformer 路线，对遮挡好 | 比 YOLO 慢 1.5–2× |
| **Mask R-CNN (R50/R101)** | 经典稳定，社区 DeepFashion2 权重多 | 慢，端侧不友好 |
| **Co-DETR / DINO + DeepFashion2** | 论文级 SOTA | 工程复杂 |

### 3.3 现成权重

- HuggingFace / GitHub 有多个社区版 `yolov8-deepfashion2` / `mmfashion` 权重，**质量参差**，建议选 stars 高且有 mAP 报告的，必要时自己用 DeepFashion2 + iMaterialist Fashion 2019 重训一版。
- **mmfashion (OpenMMLab)**：包含 Mask R-CNN-DeepFashion2 预训练权重。
- **Fashionpedia (FaceBook, 27 类 + 19 属性)** ⚠️：可以补"配饰属性"标签。

---

## 4. 背景移除

### 4.1 开源（端侧可用）

| 方案 | 模型大小 | 速度（1024px, RTX3060） | 边缘质量 | 备注 |
|---|---|---|---|---|
| **rembg (u2net)** | 176MB | ~90ms | 中 | 老牌，对头发/毛边一般 |
| **rembg (isnet-general-use)** | 175MB | ~110ms | **较好** | 通用首选 |
| **BiRefNet (2024)** | 220MB / 885MB | 150–400ms | **优秀**，发丝级 | 当前开源 SOTA matting |
| **MODNet** | 25MB | ~30ms | 中（人像专用） | 移动端友好 |
| **BackgroundMattingV2** | 27MB | ~25ms | 好（需 trimap/背景图） | 单图模式弱 |
| **RMBG-1.4 / 2.0 (BRIA)** | 88MB | ~50ms | 优 | **商用需许可证** |
| **InSPyReNet (2022)** | 90MB | ~80ms | 优 | dichotomous segmentation |

**推荐**：
- 服务端：BiRefNet（高质量）或 rembg+isnet（性价比）。
- Android：MNN/NCNN 移植 MODNet 或 RMBG-1.4-INT8。

### 4.2 商业 API

| API | 单价（参考）⚠️ | 优势 | 备注 |
|---|---|---|---|
| **remove.bg** | 约 $0.20/张 | 质量稳定 | 海外 API，国内访问慢 |
| **阿里云 视觉智能开放平台 - 通用分割/人像抠图** | 约 ¥0.01–0.05/张 | 国内低延迟 | `SegmentBody` / `SegmentCommonImage` |
| **腾讯云 智能抠图 (图像处理 IAI)** | 约 ¥0.005–0.02/张 | 国内低延迟 | `SegmentPortrait` 等 |
| **百度智能云 人像分割 / 通用物体分割** | 约 ¥0.005–0.02/张 | 国内低延迟 | EasyDL 可自训 |
| **火山引擎 视觉智能** | 约 ¥0.005/张 | 字节系，价格低 | 抖音同源算法 |

> ⚠️ 价格在 2024–2026 间多次调整，**上线前以控制台为准**。

### 4.3 关键发现：国内云**没有现成的"按服装单品输出"API**

- 阿里/腾讯/百度都只提供**整体人像分割**或**通用语义分割**，没有 "shirt / pants / shoes" 这种细粒度类别。
- 因此**主分割步骤必须自建模型**（SCHP / SegFormer / Grounded-SAM），云 API 只能用在最后的"单品图去背景"环节。

---

## 5. 方案对比矩阵

| 方案 | 服装类别覆盖 | 区分上衣/外套 | 鞋/包召回 | 多人 | 精度 (主观) | GPU 推理 | CPU 推理 | 端侧可行 | 部署难度 | 成本 |
|---|---|---|---|---|---|---|---|---|---|---|
| **SCHP-ATR** | 18 类（含 bag, belt, scarf, shoe） | 一般 | 中 | 单人 | ★★★★ | 100ms | 2s | 改造可行 | 低 | 自托管 0 |
| **SegFormer-B2-clothes (HF)** | 18 类（LIP-like） | 一般 | 中 | 单人 | ★★★★ | 30ms | 0.6s | **好** | 极低 | 0 |
| **Sapiens-Parts** | 28 类 | 好 | 好 | 单人 | ★★★★★ | 200–800ms | 不现实 | ✗ | 中 | 服务器 GPU 成本 |
| **Grounded-SAM 2** | 任意（文本驱动） | 好 | 好 | 多人 | ★★★★ | 600ms | 5s+ | ✗ | 中 | GPU 成本高 |
| **YOLOv8-seg + DeepFashion2** | 13 类服装 | **好**（长短袖、外套独立类） | 鞋/包**不在数据集** | 多人 | ★★★★ | 15ms | 200ms | **好** | 低 | 0 |
| **Mask R-CNN-DeepFashion2** | 13 类 | 好 | 同上 | 多人 | ★★★★ | 80ms | 1.5s | 一般 | 中 | 0 |
| **阿里/腾讯人像抠图 API** | 仅整体 | ✗ | ✗ | 是 | ★★★★ | 网络 | — | ✗ | 极低 | ¥0.005-0.05/张 |
| **rembg / BiRefNet 去背景** | 不分类 | ✗ | ✗ | — | ★★★★（边缘） | 100–400ms | 1–3s | MODNet 可移动 | 低 | 0 |

---

## 6. 推荐端到端流水线

```
        ┌─────────────────────────────────────────────────────────────┐
        │  输入：用户全身照（JPEG, 任意尺寸, 含背景）                  │
        └─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  Step 1. 预处理                                              │
        │    - EXIF 旋转矫正                                           │
        │    - 短边缩放到 1024，长边按比例（保留原图供裁剪）          │
        │    - 人脸/姿态检测 (YOLOv8-pose 或 MediaPipe Pose)           │
        │      用于 (a) 多人时挑主体；(b) 后续按部位裁剪的关键点定位  │
        └─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  Step 2. 人体解析（主分割）                                  │
        │    Plan A（推荐起步）: SegFormer-B2-clothes (HF)            │
        │    Plan B（高精度）  : SCHP-ATR + Sapiens-Parts ensemble     │
        │    输出：每像素 18 类标签                                    │
        └─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  Step 3. 服装实例检测（辅助 + 上衣/外套消歧）                │
        │    YOLOv8-seg @ DeepFashion2 (13 类服装)                    │
        │    用途：                                                    │
        │      (a) 把人体解析的 "upper-clothes" 与检测到的            │
        │          "long-sleeve-outwear" IoU 匹配 → 区分上衣/外套     │
        │      (b) 多件同类（两只鞋）的实例分离                       │
        │      (c) 长短袖、连衣裙长短的属性补充                       │
        └─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  Step 4. 类别合并 & 兜底                                     │
        │    - 把 SCHP 的 18 类 + DF2 的 13 类映射到产品分类法：       │
        │        {上衣, 外套, 裤子, 裙子, 连衣裙, 鞋, 包, 帽子, 配饰} │
        │    - 兜底：用户在前端可圈选漏检区域 → 触发 Grounded-SAM 2   │
        │      文本提示 "scarf / watch / sunglasses / belt" 等         │
        └─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  Step 5. 单品 mask 后处理                                    │
        │    - 形态学开闭 (3×3 kernel) 去碎洞                          │
        │    - GuidedFilter / matting refinement 修边缘 (alpha)        │
        │    - bbox + padding 5–8%（避免衣物贴边）                     │
        │    - 按 mask 紧致裁剪 → RGBA PNG                            │
        └─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  Step 6. 二次去背景（可选，提升商品图质感）                  │
        │    对每张单品图再过 BiRefNet / rembg-isnet                  │
        │    （因为 mask 边缘可能仍带肤色像素，需细化）               │
        └─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  Step 7. 输出 + 元数据                                       │
        │    每张图附 JSON: {类别, 置信度, 主色, 占比, bbox, 关键点}  │
        │    入库到衣柜 → 后续推荐/穿搭引擎使用                       │
        └─────────────────────────────────────────────────────────────┘
```

### 6.1 双端部署策略

| 端 | 推荐架构 | 延迟目标 | 备注 |
|---|---|---|---|
| **Web** | 全部走服务端 GPU（FastAPI + Triton），WebSocket 推进度 | 端到端 3–6s | 浏览器不适合跑 SCHP-101 |
| **Android** | **混合模式**：(1) 默认上传到服务端；(2) 网络差或离线时回退到本地 MNN/NCNN：MODNet + YOLOv8n-seg-DF2 + SegFormer-B0-clothes-INT8 | 端侧 2–4s，服务端 3–6s | 包大小增 ~80MB |
| **iOS** （未来）| CoreML 转换 SegFormer-B0 + YOLOv8n + MODNet | 同上 | A14+ 神经引擎够 |

### 6.2 服务端最小成本估算

- 单卡 T4 / A10 可并发处理 4–8 路请求；
- 假设日活 1 万人，人均上传 2 张，QPS 峰值 ≈ 5，单卡可扛；
- 月成本 ≈ 1 张云 GPU (¥1500–3000)+ 对象存储。

---

## 7. 风险与已知问题

### 7.1 算法层

1. **上衣 vs 外套混淆**：SCHP 把开衫毛衣/西装当 upper-clothes 的情况常见。**对策**：DeepFashion2 检测的 outwear 类别做 IoU 仲裁；置信度低时让用户二次确认。
2. **鞋/包小目标漏检**：远景、侧拍时面积 <2% 极易漏。**对策**：(a) Pose 关键点定位脚踝/手腕 → 局部 crop 再过一遍小目标专用网络；(b) 增加 DeepFashion2-augmented + iMaterialist 训练。
3. **同色衣物边界粘连**：白衬衣 + 米色外套；黑裤 + 黑鞋。**对策**：(a) BiRefNet 边缘细化；(b) DeepFashion2 关键点约束；(c) 实例分割代替纯语义分割。
4. **连衣裙 vs 上衣+裙子**：SCHP 有 dress 类，但训练样本里短裙+短上衣组合容易误判为 dress。**对策**：YOLOv8-DF2 的 short-sleeve-dress / sling-dress 检测做仲裁。
5. **侧身/坐姿/局部遮挡**：LIP/ATR 训练集大多正面立姿。**对策**：用 pose 关键点判断姿态，置信度低时降级到"只切上身可见部分"+ 提示用户重拍。
6. **多人合影**：先用 pose 选主体（最大 bbox 或最居中），副人物 mask 全部抹掉再做解析。
7. **低光 / 过曝**：上传端做亮度 EV 检测，过暗时前置做一次 Zero-DCE / Retinex 增强。
8. **配饰长尾**：手表、耳环、丝巾、皮带 SCHP 覆盖不全。**对策**：Grounded-SAM 兜底，前端提供"添加自定义部位"入口。

### 7.2 工程层

1. **输出图纵横比不统一**：mask bbox 紧致裁剪后比例千奇百怪，影响衣柜瀑布流。**对策**：
   - 选项 A：固定 3:4 / 1:1 中心 padding（推荐，UI 整齐）；
   - 选项 B：保持原 bbox + 前端容器自适应。
2. **PNG 文件体积**：高分辨率 RGBA 平均 1–3MB。**对策**：服务端做 WebP 转码或限制最长边 1024px。
3. **多次推理串行延迟**：SCHP + YOLO + BiRefNet 串起来 1.5s+。**对策**：(a) Triton 上并行同图多模型；(b) 第一帧返回 SCHP 粗 mask，BiRefNet 异步细化。
4. **模型权重许可证**：
   - SCHP / SegFormer / YOLOv8 (AGPL-3.0!) / SAM2 / BiRefNet — 注意 **YOLOv8 是 AGPL**，闭源商用须购买 Ultralytics Enterprise；可改用 YOLOv5-u 或 RT-DETR。
   - RMBG-1.4 商业许可需付费。
   - **建议优先 Apache-2.0 / MIT 路线**：SCHP + SegFormer + RT-DETR + BiRefNet (MIT)。
5. **冷启动**：首次进入"识别"功能时拉模型权重 80MB+，需要预下载策略。
6. **隐私合规**：人体照片是个人敏感信息，按《个人信息保护法》必须：(a) 上传前显式同意；(b) 服务端处理后立即删除原图，仅保留单品 crop；(c) 不出境（国内 API 而非 remove.bg）。
7. **审核**：用户可能上传不雅图。前端 + 服务端均接入内容安全 API（阿里绿网/腾讯天御）。

### 7.3 评测建议

- 自建 500 张评测集（覆盖正/侧/坐/多件叠穿/不同光线），按类别打人工 mask。
- 指标：每类别 mIoU、单品召回率（漏检率）、用户感知 NPS。
- A/B：SegFormer-only vs SegFormer+YOLO-DF2 融合。

---

## 8. 立即可行的最小验证路径（2 周）

1. **Day 1–2**：HuggingFace 拉 `mattmdjaga/segformer_b2_clothes`，本地跑 50 张样图，看类别命中。
2. **Day 3–4**：接 `yolov8s-seg` + DeepFashion2 社区权重（或 fine-tune 4 个 epoch），对比互补性。
3. **Day 5–7**：写融合脚本（语义+实例 IoU 仲裁），输出每件单品 crop。
4. **Day 8–10**：rembg-isnet 二次去背景，BiRefNet 备选。
5. **Day 11–12**：FastAPI 包装，前端 demo 联调。
6. **Day 13–14**：评测集打分，决定是否上 Sapiens / Grounded-SAM。

---

## 附录 A：候选权重与仓库速查

| 用途 | 仓库 / 权重 | License |
|---|---|---|
| 人体解析（HF 一键） | `mattmdjaga/segformer_b2_clothes` | MIT |
| 人体解析（论文系） | `GoGoDuck912/Self-Correction-Human-Parsing` | MIT |
| 人体解析大模型 | `facebookresearch/sapiens` | Sapiens License (商用问研发) |
| 服装实例 | `ultralytics/yolov8` + DeepFashion2 自训 | AGPL-3.0 |
| 服装实例（替代） | `lyuwenyu/RT-DETR` | Apache-2.0 |
| 开放词汇 | `IDEA-Research/Grounded-Segment-Anything` / Grounded-SAM-2 | Apache-2.0 (DINO 部分) |
| 去背景 SOTA | `ZhengPeng7/BiRefNet` | MIT |
| 去背景实用 | `danielgatis/rembg` | MIT |
| 端侧人像 matting | `ZHKKKe/MODNet` | Apache-2.0 |
| 姿态 | `ultralytics/yolov8-pose` / MediaPipe Pose | AGPL-3.0 / Apache-2.0 |

## 附录 B：国内云 API 速查（⚠️ 价格需复核官方）

| 厂商 | 接口名 | 能力 |
|---|---|---|
| 阿里云 视觉智能开放平台 | `SegmentBody` | 人像整体抠图 |
| 阿里云 | `SegmentCommonImage` | 通用主体分割 |
| 阿里云 通义万相 | 图像编辑 (背景擦除) | 生成式去背景 |
| 腾讯云 数智人/图像处理 | `SegmentPortrait` | 人像抠图 |
| 百度智能云 | `body_seg` | 人像分割 |
| 百度 EasyDL 图像分割 | 自训上传 | 可训服装细分类 |
| 火山引擎 视觉智能 | 人像分割 / 商品分割 | 抖音商品图同源 |

— END —
