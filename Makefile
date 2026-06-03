.PHONY: help up down logs backend ai web android fmt deploy deploy-down

help:
	@echo "Wardrobe — 常用命令"
	@echo ""
	@echo "  开发:"
	@echo "  make up          起本地基础设施（MySQL + Redis + MinIO）"
	@echo "  make down        停掉基础设施"
	@echo "  make logs        查看基础设施日志"
	@echo "  make backend     跑业务后端"
	@echo "  make ai          跑 AI 推理服务"
	@echo "  make web         跑 Web 端"
	@echo "  make android     编译并安装 Android"
	@echo "  make fmt         格式化全部代码"
	@echo ""
	@echo "  一键部署 (Docker):"
	@echo "  make deploy      构建并启动全部服务 (需先 cp .env.docker .env)"
	@echo "  make deploy-down 停止并删除容器"

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

backend:
	cd backend && uv run uvicorn wardrobe_api.main:app --reload --port 8000

ai:
	cd ai && uv run uvicorn wardrobe_ai.main:app --reload --port 8003

web:
	cd web && pnpm dev

android:
	cd android && ./gradlew installDebug

fmt:
	cd backend && uv run ruff format src tests
	cd ai && uv run ruff format src
	cd web && pnpm exec prettier --write .

deploy:
	docker compose -f docker-compose.prod.yml up -d --build

deploy-down:
	docker compose -f docker-compose.prod.yml down
