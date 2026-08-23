"""
FastAPI application — API routes + static file mount.
All data transformation logic lives in cleaning.py; routes are thin.
"""

import io
import csv
import logging
import uuid
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

import pandas as pd

# Configure cleaning pipeline logs to show in the uvicorn terminal
logging.basicConfig(
    level=logging.WARNING,
    format="%(levelname)s  [%(name)s]  %(message)s",
)

from backend import store
from backend.cleaning import run_cleaning_pipeline
from backend.models import (
    Student,
    CleaningReport,
    StatusUpdateRequest,
    UploadResponse,
    StudentsResponse,
)
from backend.store import get_students_as_df

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
async def upload_csv(
    file: UploadFile = File(...),
    mode: str = "replace",
):
    """
    Accept a raw CSV, run the cleaning pipeline, persist to SQLite.

    mode=replace (default): wipe existing data, load new CSV fresh.
    mode=append: concatenate new CSV with existing data, re-run the
                 full cleaning pipeline on the combined dataset so that
                 cross-file deduplication works correctly.
    """
    if mode not in ("replace", "append"):
        raise HTTPException(status_code=400, detail="mode must be 'replace' or 'append'")

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    raw_bytes = await file.read()
    try:
        df_new = pd.read_csv(io.BytesIO(raw_bytes))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    if mode == "append" and store.get_active_students():
        # Normalize df_new column names to canonical lowercase BEFORE concat.
        # Without this, 'Total' (CSV) and 'total' (SQLite) produce TWO columns
        # after concat, which causes df["total"] to return a 2D DataFrame and
        # breaks pd.to_numeric inside the cleaning pipeline.
        _col_aliases = {
            "maths": "math", "mathematics": "math", "sci": "science", "eng": "english",
            "grand total": "total", "total marks": "total", "tot": "total",
            "student name": "name", "student_name": "name", "sex": "gender",
            "class": "grade", "std": "grade",
        }
        df_new.columns = [c.strip().lower() for c in df_new.columns]
        df_new = df_new.rename(columns=_col_aliases)

        df_existing = get_students_as_df()
        df_raw = pd.concat([df_existing, df_new], ignore_index=True)
    else:
        df_raw = df_new


    # Run the cleaning pipeline on the (possibly combined) dataset
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


@app.delete("/api/students")
def delete_all_students():
    """
    Delete all current records (wipes the active batch entirely).
    Used by the 'Clear All' button in the UI.
    """
    store.delete_old_batch()
    return {"deleted": True, "students": []}


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
def export_csv(
    min_total: float = 0.0,
    status_filter: str = "Active",
    flagged_filter: str = "No",
):
    """
    Server-side filtered CSV export.
    Always re-queries SQLite — never trusts client state.

    status_filter:  'Active' | 'Debarred' | 'All'
    flagged_filter: 'No'     | 'Yes'       | 'All'
    """
    if status_filter not in ("Active", "Debarred", "NotQualified", "All"):
        raise HTTPException(status_code=400, detail="status_filter must be 'Active', 'Debarred', 'NotQualified', or 'All'")
    if flagged_filter not in ("No", "Yes", "All"):
        raise HTTPException(status_code=400, detail="flagged_filter must be 'No', 'Yes', or 'All'")

    rows = store.get_export_students(min_total, status_filter, flagged_filter)

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
if not _DIST.exists():
    # Fallback: resolve relative to the process working directory (Render deploy)
    _DIST = Path.cwd() / "frontend" / "dist"

if _DIST.exists():
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="static")
else:
    import logging as _log
    _log.getLogger(__name__).warning(
        "frontend/dist not found at %s — static file serving disabled. "
        "Run 'cd frontend && npm run build' to generate it.", _DIST
    )
