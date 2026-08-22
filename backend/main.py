"""
FastAPI application — API routes + static file mount.
All data transformation logic lives in cleaning.py; routes are thin.
"""

import io
import csv
import uuid
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

import pandas as pd

from backend import store
from backend.cleaning import run_cleaning_pipeline
from backend.models import (
    Student,
    CleaningReport,
    StatusUpdateRequest,
    UploadResponse,
    StudentsResponse,
)

app = FastAPI(title="Student Pipeline API", version="1.0.0")


# ---------------------------------------------------------------------------
# Startup: initialise the database
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup():
    store.init_db()


# ---------------------------------------------------------------------------
# API Routes — all under /api/
# ---------------------------------------------------------------------------

@app.post("/api/upload", response_model=UploadResponse)
async def upload_csv(file: UploadFile = File(...)):
    """
    Accept a raw CSV, run the cleaning pipeline, persist to SQLite.
    Replaces any previously active batch (single-batch MVP).
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    raw_bytes = await file.read()
    try:
        df_raw = pd.read_csv(io.BytesIO(raw_bytes))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    # Run the cleaning pipeline
    df_clean, report = run_cleaning_pipeline(df_raw)

    batch_id = str(uuid.uuid4())

    # Persist — wipe old batch first (single-batch MVP rule)
    store.delete_old_batch()
    store.insert_batch(
        {
            "batch_id": batch_id,
            "filename": file.filename,
            **report,
        }
    )

    # Build student dicts for DB insertion
    student_rows = []
    for _, row in df_clean.iterrows():
        student_rows.append(
            {
                "batch_id": batch_id,
                "name": row.get("name") if not pd.isna(row.get("name")) else None,
                "gender": row.get("gender") if row.get("gender") is not None else None,
                "grade": str(row.get("grade")) if row.get("grade") is not None else None,
                "math": float(row["math"]) if pd.notna(row.get("math")) else None,
                "science": float(row["science"]) if pd.notna(row.get("science")) else None,
                "english": float(row["english"]) if pd.notna(row.get("english")) else None,
                "total": float(row["total"]) if pd.notna(row.get("total")) else None,
                "status": "Active",
                "is_incomplete": bool(row.get("is_incomplete", False)),
                "is_invalid": bool(row.get("is_invalid", False)),
            }
        )
    store.insert_students(student_rows)

    # Fetch from DB to get auto-assigned IDs
    db_students = store.get_active_students()
    students = [Student(**s) for s in db_students]

    return UploadResponse(
        batch_id=batch_id,
        students=students,
        cleaning_report=CleaningReport(**report),
    )


@app.get("/api/students", response_model=StudentsResponse)
def get_students():
    """
    Hydrate the React app from SQLite on page load or refresh.
    Returns all students for the current active batch.
    """
    rows = store.get_active_students()
    students = [Student(**r) for r in rows]
    return StudentsResponse(students=students)


@app.patch("/api/students/{student_id}/status")
def update_status(student_id: int, body: StatusUpdateRequest):
    """
    Persist a single Active/Debarred toggle.
    The UI fires this in the background after an optimistic local update.
    """
    try:
        updated = store.update_student_status(student_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return updated


@app.get("/api/export")
def export_csv(min_total: float = 0.0):
    """
    Server-side filtered CSV export.
    Always re-queries SQLite — never trusts client state.
    Returns Active students with total >= min_total.
    """
    rows = store.get_export_students(min_total)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["name", "gender", "grade", "math", "science", "english", "total", "status"],
    )
    writer.writeheader()
    writer.writerows(rows)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=shortlist.csv"},
    )


# ---------------------------------------------------------------------------
# Serve the built React app for all other routes
# Must be mounted AFTER API routes are registered
# ---------------------------------------------------------------------------

_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if _DIST.exists():
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="static")
