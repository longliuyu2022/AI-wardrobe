<div align="center">

<img src="assets/banner.svg" alt="Wardrobe · AI Digital Closet — one full-body photo, 5 garments auto-filed" width="840">

An AI-powered digital wardrobe · **Web + Android**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
&nbsp;![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
&nbsp;![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
&nbsp;![Next.js](https://img.shields.io/badge/Next.js%2014-000000?logo=nextdotjs&logoColor=white)
&nbsp;![Kotlin](https://img.shields.io/badge/Android-Kotlin%20Compose-7F52FF?logo=kotlin&logoColor=white)
&nbsp;[![Stars](https://img.shields.io/github/stars/longliuyu2022/AI-wardrobe?style=social)](https://github.com/longliuyu2022/AI-wardrobe/stargazers)

[中文](README.md) · **English**

</div>

> **What makes it different**: Every other closet app makes you photograph garments one by one. Wardrobe lets you snap **a single full-body photo** — AI segments it into top, outerwear, pants, shoes and more, all filed at once.

---

## ✨ Why Wardrobe?

- 🪄 **One-shot full-body segmentation** — the VLM emits normalized bounding boxes, Pillow crops them; one photo becomes multiple items auto-filed (shoes count once, accessories smartly skipped)
- 🏷️ **AI auto-tagging** — SenseNova VLM recognizes category / sub-category / color / season / material / style; zero-effort entry
- 👗 **AI outfit suggestions** — picks 3 daily outfits from your own closet
- 📅 **Outfit calendar** — monthly view of what you wore, Top 10 most-worn + last-7-days stats
- 📦 **Your data, always portable** — one-click ZIP export (garment data + images); free users are never locked in
- 🔒 **Data stays in-region** — VLM via SenseNova; full-body originals never touch disk, only cropped items are stored

## 🧩 Features

| Capability | Status | Notes |
|------|:----:|------|
| 👤 Auth | ✅ | Invite-code signup, 30-day cookie, cross-device sync |
| 📸 **Full-body segmentation** | ✅ | Core feature — VLM bbox + Pillow crop, ~85% accuracy |
| 🖼️ Single upload + recognition | ✅ | Browser compresses to 1024px, backend VLM auto-tags |
| 🗂️ Closet browse & filter | ✅ | Skeleton loading + thumbnail grid + emoji categories |
| ✏️ Edit / batch delete | ✅ | 9 editable attributes + multi-select delete |
| 🤖 AI outfit suggestions | ✅ | VLM picks 3 outfits |
| 📅 Outfit calendar | ✅ | Web + Android |
| 📦 ZIP export | ✅ | Web + Android |
| 🛠️ Admin dashboard | ✅ | Password-gated, user/garment stats |
| 🔄 Network recovery | ✅ | Auto-retry on failure + 90s polling recovery |
| 🎨 Morandi warm-coffee UI | ✅ | Glassmorphism + skeletons + mobile bottom nav |
| 🔪 GPU true segmentation | 🚧 | To replace bbox cropping — planned |

## 🏗️ Architecture

```
Browser / Android (compress + retry recovery)
       │
       ▼
Caddy (HTTPS, auto cert)
       │
       ├── /                → Next.js 14 production (static shell + client fetch)
       └── /api/backend/*   → FastAPI :8000 (bypasses the Next proxy)
              │
              ├── SQLite WAL + 4 workers
              ├── data/uploads/ (owned by user_id)
              └── HTTP → wardrobe-ai :8003
                          │
                          ▼
                       SenseNova VLM (sensenova-6.7-flash-lite)
```

## 🚀 Quick Start

**Prerequisites**: Python 3.11 + [uv](https://github.com/astral-sh/uv) · Node 18+ + pnpm · SenseNova API Key ([token.sensenova.cn](https://token.sensenova.cn))

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
cp .env.example .env   # set ACCESS_CODE / SESSION_SECRET / SENSENOVA_API_KEY
uv run uvicorn wardrobe_api.main:app --reload --port 8000
```
</details>

<details>
<summary><b>🧠 AI service</b></summary>

```bash
cd ai && uv sync
cp .env.example .env   # fill in SENSENOVA_API_KEY
uv run uvicorn wardrobe_ai.main:app --reload --port 8003
```
</details>

<details>
<summary><b>📱 Android</b></summary>

```bash
cd android && ./gradlew installDebug
```
> ⚠️ Before building, change `BASE_URL` in `android/app/src/main/kotlin/com/wardrobe/data/ApiClient.kt` to your own backend address. Prebuilt APKs are also available under GitHub Releases.
</details>

## 📡 API Endpoints

| Method | Path | Description |
|------|------|------|
| `POST` | `/auth/register` | Invite-code signup |
| `POST` | `/auth/login` | Username/password login |
| `GET` | `/auth/me` | Current user info |
| `GET` | `/garments` | Garment list (isolated per user) |
| `POST` | `/garments` | Single upload + AI recognition |
| `POST` | `/garments/from-full-body` | Full-body segmentation into closet |
| `PATCH` | `/garments/{id}` | Edit garment attributes |
| `DELETE` | `/garments/{id}` | Delete garment |
| `POST` | `/outfits/suggest` | AI outfit suggestions |
| `POST` | `/wearlog` | Log an outfit |
| `GET` | `/wearlog?month=YYYY-MM` | Calendar data |
| `GET` | `/wearlog/stats` | Wear stats |
| `GET` | `/export` | Export ZIP |
| `POST` | `/admin/login` | Admin login |
| `GET` | `/admin/stats` `·` `/admin/users` | Admin stats / user list |

Full contract in [`openapi/wardrobe.openapi.yaml`](openapi/wardrobe.openapi.yaml).

## 🗂️ Project Structure

```
wardrobe/
├── backend/    Business backend (FastAPI + SQLAlchemy + SQLite)
│   └── src/wardrobe_api/
│       ├── routers/   auth / garments / outfits / wearlog / admin / export
│       ├── models.py  User + Garment + WearLog
│       └── security.py  session cookie + bcrypt
├── ai/         AI inference (FastAPI + SenseNova VLM)
├── web/        Web (Next.js 14 + Tailwind)
│   ├── app/         home / closet / upload / detail / calendar / admin
│   └── components/  nav / bottom-nav / badge / skeleton / toast / empty-state
├── android/    Android (Kotlin Compose)
├── openapi/    Cross-platform API contract
└── research/   Product / tech / user research
```

## 🔒 Design Principles

- ❗ **No YOLOv8/v9/v10/v11** (AGPL-3.0, incompatible with closed-source commercial use); use RT-DETR-seg / Mask R-CNN (Apache 2.0) for instance segmentation
- 🙈 **Full-body originals are never persisted** — only cropped items are saved; the intermediate state (with the human body) is released after a single pipeline pass
- 🇨🇳 **Data loop stays in-region** — VLM via SenseNova (an Alibaba Cloud sub-product); no overseas LLM calls
- 📲 **Photo processing prefers the server** — the client only does light compression (1024px / JPEG 0.8) before upload
- 🛡️ **`uploads/` deletions MUST be filtered by user_id** (see [CLAUDE.md](CLAUDE.md))

## 🤝 Contributing

Issues and PRs are welcome. Please read [CLAUDE.md](CLAUDE.md) for project constraints and the shared-directory deletion safety rules.

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=longliuyu2022/AI-wardrobe&type=Date)](https://star-history.com/#longliuyu2022/AI-wardrobe&Date)

## 📄 License

Released under the [Apache License 2.0](LICENSE).
