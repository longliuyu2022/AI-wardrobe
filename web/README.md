# Wardrobe Web

Next.js 14 (App Router) + TypeScript + Tailwind。

## 开发

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

打开 http://localhost:3000。

页面：
- `/` — 首页
- `/wardrobe` — 衣橱列表
- `/upload` — 上传衣物（含全身照分部位）

后端代理：`/api/backend/*` 自动代理到 `NEXT_PUBLIC_API_URL`（默认 `http://localhost:8000`）。

## 项目布局

```
web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx          首页
│   ├── wardrobe/page.tsx
│   └── upload/page.tsx
├── components/
│   └── nav.tsx
└── lib/
    └── api.ts            backend client，从 openapi/ 生成类型（TODO）
```

## 待办（Phase 1）

- [ ] 用 openapi-typescript 从 `../openapi/wardrobe.openapi.yaml` 生成 TS 类型
- [ ] 真实接入登录、上传、列表
- [ ] 微信扫码登录（生产）
- [ ] 国际化（暂只做中文）
