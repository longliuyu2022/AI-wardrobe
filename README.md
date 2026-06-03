<div align="center">

<img src="assets/banner.svg" alt="Wardrobe · 智能电子衣柜 — 一张全身照，自动入柜 5 件衣服" width="840">

面向国内用户的 AI 电子衣柜 · **Web + Android 双端**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
&nbsp;![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
&nbsp;![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
&nbsp;![Next.js](https://img.shields.io/badge/Next.js%2014-000000?logo=nextdotjs&logoColor=white)
&nbsp;![Kotlin](https://img.shields.io/badge/Android-Kotlin%20Compose-7F52FF?logo=kotlin&logoColor=white)
&nbsp;[![Stars](https://img.shields.io/github/stars/longliuyu2022/AI-wardrobe?style=social)](https://github.com/longliuyu2022/AI-wardrobe/stargazers)

**中文** · [English](README.en.md)

</div>

> **核心差异化**：市面 20+ 款衣柜 App 都要你一件一件拍照录入。Wardrobe 让你拍**一张全身照**，AI 自动分割出上衣、外套、裤子、鞋等单品，一次入柜。

---

## ✨ 为什么是 Wardrobe？

- 🪄 **全身照一键分割** — VLM 输出归一化 bbox + Pillow 裁切，一张照片拆成多件单品自动入库（鞋只算一项，配饰智能跳过）
- 🏷️ **AI 自动打标签** — SenseNova VLM 识别 类目 / 子类 / 颜色 / 季节 / 材质 / 风格，录入零负担
- 👗 **AI 搭配推荐** — 从你的衣柜里挑 3 套日常搭配
- 📅 **穿搭日历** — 月历记录每天穿了什么，最常穿 Top 10 + 近 7 天统计
- 📦 **数据随时带走** — 一键导出 ZIP（衣物数据 + 图片），免费用户也绝不锁数据
- 🔒 **数据闭环在境内** — VLM 用 SenseNova，全身照原图不落盘，只存裁好的单品

## 🧩 功能一览

| 能力 | 状态 | 说明 |
|------|:----:|------|
| 👤 注册登录 | ✅ | 邀请码注册，30 天 cookie，跨设备同步 |
| 📸 **全身照分割入库** | ✅ | 核心卖点，VLM bbox + Pillow 裁切，精度 ~85% |
| 🖼️ 单件上传 + 识别 | ✅ | 浏览器压缩 1024px，后端 VLM 自动打标签 |
| 🗂️ 衣柜浏览筛选 | ✅ | 骨架屏 + 缩略图网格 + 中文标签 + emoji 分类 |
| ✏️ 单件编辑 / 批量删除 | ✅ | 9 个属性可改 + 编辑模式多选删除 |
| 🤖 AI 搭配推荐 | ✅ | VLM 从衣柜挑 3 套日常搭配 |
| 📅 穿搭日历 | ✅ | Web + Android 双端 |
| 📦 数据导出 ZIP | ✅ | Web + Android 双端 |
| 🛠️ 管理后台 | ✅ | 独立密码鉴权，用户/衣物统计 |
| 🔄 网络抖动恢复 | ✅ | 上传失败自动重试 + 90s 轮询找回 |
| 🎨 莫兰迪暖咖色 UI | ✅ | 毛玻璃 + 骨架屏 + 移动端底部导航 |
| 🔪 GPU 真分割 | 🚧 | 替代 bbox 裁切，规划中 |

## 🏗️ 系统架构

```
浏览器 / Android (压缩 + 重试恢复)
       │
       ▼
Caddy (HTTPS, 自动 cert)
       │
       ├── /                → Next.js 14 production (静态壳 + client fetch)
       └── /api/backend/*   → FastAPI :8000 (绕过 Next proxy)
              │
              ├── SQLite WAL + 4 workers
              ├── data/uploads/ (按 user_id 归属)
              └── HTTP → wardrobe-ai :8003
                          │
                          ▼
                       SenseNova VLM (sensenova-6.7-flash-lite)
```

## 🚀 快速开始

**前置**：Python 3.11 + [uv](https://github.com/astral-sh/uv) · Node 18+ + pnpm · SenseNova API Key（[token.sensenova.cn](https://token.sensenova.cn)）

<details open>
<summary><b>🌐 Web</b></summary>

```bash
cd web && pnpm install && pnpm dev    # http://localhost:3000
```
</details>

<details>
<summary><b>⚙️ Backend</b></summary>

```bash
cd backend && uv sync
cp .env.example .env   # 改 ACCESS_CODE / SESSION_SECRET / SENSENOVA_API_KEY
uv run uvicorn wardrobe_api.main:app --reload --port 8000
```
</details>

<details>
<summary><b>🧠 AI 服务</b></summary>

```bash
cd ai && uv sync
cp .env.example .env   # 填 SENSENOVA_API_KEY
uv run uvicorn wardrobe_ai.main:app --reload --port 8003
```
</details>

<details>
<summary><b>📱 Android</b></summary>

```bash
cd android && ./gradlew installDebug
```
> ⚠️ 构建前把 `android/app/src/main/kotlin/com/wardrobe/data/ApiClient.kt` 里的 `BASE_URL` 改成你自己的后端地址。APK 也可在 GitHub Releases 下载。
</details>

## 🐳 一键部署（Docker）

> 需要一台 Linux 服务器 + Docker 24+（含 compose plugin）+ 一个域名。Caddy 自动申请 HTTPS 证书。

```bash
git clone https://github.com/longliuyu2022/AI-wardrobe.git && cd AI-wardrobe
cp .env.docker .env
# 编辑 .env：填域名、SenseNova API Key、session_secret（openssl rand -hex 32）
make deploy          # 构建 + 启动 (首次约 3-5 分钟)
```

三个容器 + Caddy 反代自动跑起来。`data/` 挂载在 Docker volume 里，重启不丢数据。

```bash
make deploy-down     # 停止并删除容器
docker compose -f docker-compose.prod.yml logs -f   # 查看日志
```

## 📡 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/auth/register` | 邀请码注册 |
| `POST` | `/auth/login` | 用户名密码登录 |
| `GET` | `/auth/me` | 当前用户信息 |
| `GET` | `/garments` | 衣物列表（按 user 隔离）|
| `POST` | `/garments` | 单件上传 + AI 识别 |
| `POST` | `/garments/from-full-body` | 全身照分割入库 |
| `PATCH` | `/garments/{id}` | 编辑衣物属性 |
| `DELETE` | `/garments/{id}` | 删除衣物 |
| `POST` | `/outfits/suggest` | AI 搭配推荐 |
| `POST` | `/wearlog` | 记录穿搭 |
| `GET` | `/wearlog?month=YYYY-MM` | 月历数据 |
| `GET` | `/wearlog/stats` | 穿搭统计 |
| `GET` | `/export` | 导出 ZIP |
| `POST` | `/admin/login` | 管理员登录 |
| `GET` | `/admin/stats` `·` `/admin/users` | 管理统计 / 用户列表 |

完整契约见 [`openapi/wardrobe.openapi.yaml`](openapi/wardrobe.openapi.yaml)。

## 🗂️ 项目结构

```
wardrobe/
├── backend/    业务后端 (FastAPI + SQLAlchemy + SQLite)
│   └── src/wardrobe_api/
│       ├── routers/   auth / garments / outfits / wearlog / admin / export
│       ├── models.py  User + Garment + WearLog
│       └── security.py  session cookie + bcrypt
├── ai/         AI 推理 (FastAPI + SenseNova VLM)
├── web/        Web 端 (Next.js 14 + Tailwind)
│   ├── app/         首页 / 衣柜 / 上传 / 详情 / 日历 / 管理
│   └── components/  nav / bottom-nav / badge / skeleton / toast / empty-state
├── android/    Android (Kotlin Compose)
├── openapi/    跨端 API 契约
└── research/   产品 / 技术 / 用户调研
```

## 🔒 设计原则

- ❗ **不引入 YOLOv8/v9/v10/v11**（AGPL-3.0 不兼容闭源商用），实例分割用 RT-DETR-seg / Mask R-CNN（Apache 2.0）
- 🙈 **全身照原图不落盘**，只存裁出的单件，中间态（含人体）走完 pipeline 即释放
- 🇨🇳 **数据闭环在境内**，VLM 用 SenseNova（阿里云子产品），不调用境外大模型
- 📲 **照片处理优先在服务端**，端侧只做轻量压缩（1024px / JPEG 0.8）后上传
- 🛡️ **`uploads/` 删除操作必须按 user_id 过滤** — 共享目录，误删不可恢复

## 🤝 贡献

欢迎 Issue / PR。

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=longliuyu2022/AI-wardrobe&type=Date)](https://star-history.com/#longliuyu2022/AI-wardrobe&Date)

## 📄 许可证

本项目以 [Apache License 2.0](LICENSE) 开源。
