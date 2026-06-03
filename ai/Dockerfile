# 默认不装 torch (VLM 纯 API 调用, ~150 MB)。
# 如需 GPU 真分割, 构建时加 --build-arg INSTALL_GPU=1 (镜像 ~4-6 GB)。
ARG INSTALL_GPU=0

# ---- build ----
FROM python:3.11-slim AS build
ARG INSTALL_GPU
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock* ./
RUN uv pip install --system --no-cache . && \
    if [ "$INSTALL_GPU" = "1" ]; then uv pip install --system --no-cache ".[gpu]"; fi
COPY src/ src/

# ---- runtime ----
FROM python:3.11-slim
WORKDIR /app
COPY --from=build /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=build /usr/local/bin /usr/local/bin
COPY src/ src/
EXPOSE 8003
CMD ["uvicorn", "wardrobe_ai.main:app", "--host", "0.0.0.0", "--port", "8003", "--workers", "2"]
