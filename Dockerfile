# =============================================================================
# Stage 1: Build React Frontend
# =============================================================================
FROM node:20-bullseye-slim AS frontend-builder
WORKDIR /app/frontend

ENV CI=false \
    NODE_OPTIONS="--max-old-space-size=4096"

COPY frontend/package.json ./
RUN yarn install --network-timeout 300000

COPY frontend/ ./
RUN yarn build

# =============================================================================
# Stage 2: Production Python FastAPI Backend + Built Frontend SPA
# =============================================================================
FROM python:3.11-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/build ./frontend/build

EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.server:app --host 0.0.0.0 --port ${PORT:-8000}"]
