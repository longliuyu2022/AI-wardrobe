# Contributing to Wardrobe

感谢你对 Wardrobe 项目的关注！以下是参与贡献的指南。

## 开发环境

### 依赖

- Python 3.11+
- Node.js 20+
- pnpm 9+
- Docker & Docker Compose（可选，用于本地基础设施）

### 本地启动

1. **启动基础设施**（MySQL + Redis + MinIO）：

   ```bash
   docker compose up -d
   ```

2. **后端**：

   ```bash
   cd backend
   cp .env.example .env  # 编辑配置
   pip install -e ".[dev]"
   uvicorn wardrobe_api.main:app --reload --port 8000
   ```

3. **AI 服务**：

   ```bash
   cd ai
   cp .env.example .env
   pip install -e ".[dev]"
   uvicorn wardrobe_ai.main:app --reload --port 8001
   ```

4. **前端**：

   ```bash
   cd web
   pnpm install
   pnpm dev
   ```

   访问 http://localhost:3000

## 代码规范

- **Python**: 使用 [ruff](https://github.com/astral-sh/ruff) 格式化和 lint
  ```bash
  cd backend && ruff check .
  cd ai && ruff check .
  ```

- **TypeScript/React**: 使用 ESLint
  ```bash
  cd web && pnpm lint
  ```

## 测试

```bash
cd backend && pytest -v
```

所有 PR 都需要通过 CI（lint + test）。

## 提交规范

使用语义化 commit message：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档变更
- `test:` 添加/修改测试
- `refactor:` 重构（不改变功能）
- `chore:` 构建/工具变更

示例：`feat: 添加衣物批量删除功能`

## PR 流程

1. Fork 本仓库
2. 从 `main` 创建你的分支：`git checkout -b feat/my-feature`
3. 提交你的修改
4. 确保 CI 通过
5. 创建 Pull Request，描述你做了什么以及为什么

## 分支策略

- `main` — 稳定分支，始终可部署
- 功能分支从 `main` 分出，完成后合并回 `main`

## 许可证

本项目使用 [Apache 2.0](LICENSE) 许可证。提交代码即表示你同意你的贡献使用相同许可证。
