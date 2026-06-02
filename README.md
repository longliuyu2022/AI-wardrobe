# Wardrobe — 智能电子衣柜

一张全身照，自动入柜 5 件衣服。Web + Android 双端可用。

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)

> 邀请码注册制 · 可自部署（见下方「快速开始」）

## 核心能力

- **用户名/密码注册登录** — 凭邀请码注册, 30 天 cookie, 跨设备同步
- **单件衣物上传** — 浏览器压缩 (1024px / JPEG 0.8), 后端 SenseNova VLM 识别类目 / 子类 / 颜色 / 季节 / 材质 / 风格
- **全身照分部位** — VLM 出归一化 bbox, Pillow 裁切, 并行 identify 补属性。鞋只算一项, 配饰跳过
- **衣柜浏览** — 骨架屏加载 + 缩略图网格 + 中文标签 + emoji 分类筛选
- **单件编辑** — 类目 / 子类 / 颜色 / 季节 / 材质 / 风格 / 穿次 / 购入价 / 链接 / 备注
- **批量删除** — 编辑模式多选, 底部浮层确认删除
- **AI 搭配** — SenseNova VLM 从衣柜挑 3 套日常搭配
- **穿搭日历** — 月历视图记录每天穿搭, 最常穿 Top 10 + 最近 7 天统计
- **数据导出** — 一键导出 ZIP (衣物数据 + 图片)
- **管理后台** — 独立密码鉴权, 查看用户列表 / 衣物统计 / 图片占用
- **网络恢复** — 上传失败自动重试 + 90s 轮询找回
- **UI** — 莫兰迪暖咖色 + 雾粉强调 + 毛玻璃 + 骨架屏 + 移动端底部导航

## 系统架构

```
浏览器 / Android (压缩 + 重试恢复)
       │
       ▼
Caddy (HTTPS, 自动 cert)
       │
       ├── /  → Next.js 14 production (静态壳 + client fetch)
       └── /api/backend/*  → FastAPI :8000 (绕过 Next proxy)
              │
              ├── SQLite WAL + 4 workers
              ├── data/uploads/ (按 user_id 归属)
              └── HTTP → wardrobe-ai :8003
                          │
                          ▼
                       SenseNova VLM (sensenova-6.7-flash-lite)
```

## 项目结构

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
└── research/   产品/技术/用户调研
```

## 快速开始

### Web

```bash
cd web && pnpm install && pnpm dev    # http://localhost:3000
```

### Backend

```bash
cd backend && uv sync
cp .env.example .env  # 改 ACCESS_CODE / SESSION_SECRET / SENSENOVA_API_KEY
uv run uvicorn wardrobe_api.main:app --reload --port 8000
```

### AI 服务

```bash
cd ai && uv sync
cp .env.example .env  # 填 SENSENOVA_API_KEY
uv run uvicorn wardrobe_ai.main:app --reload --port 8003
```

### Android

```bash
cd android && ./gradlew installDebug    # 或 installRelease
```

APK 下载: 见 GitHub Releases，或自行 `cd android && ./gradlew assembleDebug` 构建

## 生产部署

生产环境用 systemd 跑三个服务 + Caddy 反代:

| 服务 | systemd unit | 端口 |
|---|---|---|
| Next.js | `wardrobe-web.service` | 127.0.0.1:3001 |
| FastAPI backend | `wardrobe-api.service` (4 workers) | 127.0.0.1:8000 |
| FastAPI ai | `wardrobe-ai.service` (4 workers) | 127.0.0.1:8003 |
| Caddy | `caddy.service` | :443 |

Caddy 配置 `/api/backend/*` 直接转给 backend, 不经 Next.js rewrite。

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /auth/register | 邀请码注册 |
| POST | /auth/login | 用户名密码登录 |
| GET | /auth/me | 当前用户信息 |
| GET | /garments | 衣物列表 (按 user 隔离) |
| POST | /garments | 单件上传 + AI 识别 |
| POST | /garments/from-full-body | 全身照分割入库 |
| PATCH | /garments/{id} | 编辑衣物属性 |
| DELETE | /garments/{id} | 删除衣物 |
| POST | /outfits/suggest | AI 搭配推荐 |
| POST | /wearlog | 记录穿搭 |
| GET | /wearlog?month=YYYY-MM | 月历数据 |
| GET | /wearlog/stats | 穿搭统计 |
| GET | /export | 导出 ZIP |
| POST | /admin/login | 管理员登录 |
| GET | /admin/stats | 管理统计 |
| GET | /admin/users | 用户列表 |

## 关键约束

- ❗ 不要引入 YOLOv8/v9/v10/v11 (AGPL-3.0 不兼容闭源商用)
- 全身照原图不落盘, 只存裁出的单件
- 数据闭环在境内 (SenseNova / 阿里云)
- uploads/ 删除操作必须按 user_id 过滤 (详见 CLAUDE.md)

## 许可证

本项目以 [Apache License 2.0](LICENSE) 开源。
