# Wardrobe Backend

业务后端，FastAPI + MySQL + Redis + OSS。

## 开发

确认根目录的基础设施已起：

```bash
cd .. && docker compose up -d
```

安装并跑：

```bash
uv sync
cp .env.example .env
uv run uvicorn wardrobe_api.main:app --reload --port 8000
```

Swagger UI：http://localhost:8000/docs

## 项目布局

```
backend/
├── pyproject.toml
├── src/wardrobe_api/
│   ├── main.py            FastAPI app + middleware
│   ├── settings.py        Pydantic 配置（环境变量）
│   ├── db.py              SQLAlchemy engine / Session
│   ├── models.py          ORM 模型（User, Garment, ...）
│   ├── schemas.py         Pydantic 出入参 schema
│   └── routers/           路由分模块
│       ├── health.py
│       ├── auth.py
│       └── garments.py    含 /garments/from-full-body（核心差异化）
└── tests/
```

## 当前进度

骨架阶段。`/health` 已可用；其他端点是桩，待 Phase 0 接 OSS + AI 服务后填实现。
