# app.py — project entry point
# Re-exports the FastAPI application from backend/main.py so the app can be
# started from the project root with:
#
#   uvicorn app:app --reload
#
# (Equivalent to: uvicorn backend.main:app --reload)

from backend.main import app  # noqa: F401  re-exported as the ASGI entry point
