# Wardrobe 项目背景

这是一个**国内市场**的电子衣柜 APP，Android + Web **双端并行开发**。

## 核心差异化

**一张全身照 → 自动分割出 5 件服装单品并入库**。

经调研，国内外 20+ 款衣柜 APP 都没有把这做成核心卖点（最接近的是阿里云开放的"服饰分割 API"，但没人产品化）。

## 技术栈

| 层 | 选型 |
|----|------|
| 业务后端 | Python 3.11 + FastAPI + SQLAlchemy 2 + SQLite (WAL) |
| AI 推理服务 | Python 3.11 + FastAPI + SenseNova VLM (sensenova-6.7-flash-lite) |
| Web | Next.js 14 (App Router) + TypeScript + Tailwind |
| Android | Kotlin + Jetpack Compose + Retrofit（**未完成**） |
| 对象存储 | 本地磁盘 `backend/data/uploads/`（MVP，≥100 人量级再切 OSS） |
| 反代/HTTPS | Caddy（自动 cert） |
| API 契约 | OpenAPI 3.0，跨端共享（`openapi/wardrobe.openapi.yaml`） |
| 依赖管理 | Python: `uv`；Web: `pnpm`；Android: Gradle Kotlin DSL |

## 关键约束（**严格遵守**）

1. **不要引入 YOLOv8/v9/v10/v11**。它们是 AGPL-3.0，闭源商用不兼容。需要实例分割用 **RT-DETR-seg** 或 **Mask R-CNN**（Apache 2.0）。
2. **全身照原图不落盘**。AI 服务推理完只保存分割出的服装单品 crop。中间态（含人体）只在内存里走完一遍 pipeline 就释放。
3. **数据闭环在境内**。VLM 用 SenseNova（阿里云子产品，token.sensenova.cn），**不调用境外大模型**（合规 + 出海风险）。
4. **照片处理优先在服务端**，端侧只做轻量压缩（1024px / JPEG 0.8）后上传。
5. **免费 tier 必须覆盖刚需录入和查看**。免费用户的数据可一键导出 ZIP — 这是建立信任的底线。

## 共享目录写操作 — 防误删

`backend/data/uploads/` 是**所有用户共享**的上传文件目录, SQLite 用 user_id 区分归属。原图删除不可逆（JPG 无法恢复, 只能让用户重传）, 任何批量删除都极其危险, 务必遵守下列铁律。

**铁律**:

1. **任何 `rm` / `unlink` / `os.remove` 操作 uploads/ 都必须先按 user_id 过滤**:
   ```python
   # 错: 删全部
   for f in glob('uploads/*.jpg'): os.remove(f)
   # 对: 先查 image_url 再删
   for url, in c.execute("SELECT image_url FROM garments WHERE user_id=?", (target_uid,)):
       os.remove(uploads_dir / Path(url).name)
   ```

2. **任何"清测试数据"操作开始前先全量备份**:
   ```bash
   cp -a backend/data /tmp/wardrobe-data.bak.$(date +%Y%m%d-%H%M%S)
   ```

3. **清 DB 表的时候也只 DELETE WHERE user_id**, 别 DROP TABLE 或 wipe-all。

4. **删除前 echo 出将要删的文件清单, 等 user 确认或自己 review 一遍再 commit**。

5. **数据库 ALTER 不兼容时**, 不要直接 `rm wardrobe.db` 重建 — 先 dump 现有 garment 行的 image_url 列表, 移除孤儿 jpg, 再重建表 + INSERT 回去。MVP 阶段可以选择"清干净", 但要 (a) 跟用户确认 (b) 备份 db 文件。

## 调研产出

完整产品/技术/用户调研在 `research/` 目录：
- `00_summary.md` — 汇总报告，必读
- `01_competitors.md` — 竞品深度对比
- `02_tagging_tech.md` — 识别+打标签技术
- `03_segmentation_tech.md` — 分割裁剪技术
- `04_users.md` — 用户画像与痛点

## 当前阶段

**MVP 已上线**（Caddy + systemd 部署）

已完成：注册登录、单件上传（VLM 识别属性）、全身照分部位裁剪（VLM bbox + Pillow 裁切，精度 ~85%）、衣柜浏览筛选、单件编辑、批量删除、AI 搭配推荐、网络抖动恢复、Android 端（登录/衣柜/上传/编辑/AI搭配）、数据导出 ZIP。

待做：GPU 真分割替代 bbox 裁切、真正 OSS 上云、多账号管理。

## 常用命令

```bash
cd backend && uv run uvicorn wardrobe_api.main:app --reload --port 8000
cd ai && uv run uvicorn wardrobe_ai.main:app --reload --port 8003
cd web && pnpm dev                                # http://localhost:3000
cd android && ANDROID_HOME=/opt/android-sdk ./gradlew assembleDebug  # APK 在 app/build/outputs/apk/debug/
```

## APK 版本管理（**严格遵守**）

每次生成新 APK **必须递增版本号**，不要覆盖旧文件。

1. 在 `android/app/build.gradle.kts` 递增 `versionCode` 和 `versionName`（如 0.2.0 → 0.3.0）
2. 再执行 `assembleDebug`，APK 文件名自动变为 `wardrobe-{version}-debug.apk`
3. 旧版本 APK 保留在目录里，方便回退和对比
