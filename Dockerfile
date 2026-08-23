# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Install deps first (layer-cached unless package.json changes)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Copy source and build
COPY frontend/ .
RUN npm run build
# Output: /app/frontend/dist/


# ── Stage 2: Python backend + serve built frontend ───────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/
COPY app.py .

# Copy the built React app from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# SQLite database directory (survives container restarts via volume mount)
RUN mkdir -p data

# Expose API + static file port
EXPOSE 8000

# Start FastAPI — serves both API (/api/*) and React (everything else)
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
