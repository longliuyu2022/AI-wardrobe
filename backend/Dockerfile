# ---- build ----
FROM python:3.11-slim AS build
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock* ./
RUN uv pip install --system --no-cache -e . 2>/dev/null || uv pip install --system --no-cache .
COPY src/ src/

# ---- runtime ----
FROM python:3.11-slim
WORKDIR /app
COPY --from=build /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=build /usr/local/bin /usr/local/bin
COPY src/ src/
RUN mkdir -p data/uploads
EXPOSE 8000
CMD ["uvicorn", "wardrobe_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
