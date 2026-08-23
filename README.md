# Recruitment Manager — Student Eligibility Shortlisting Tool

A single-service web app for exam cells to upload raw student CSVs, auto-clean them, filter by minimum total score, manage eligibility exceptions, and export a clean shortlist.

## Stack

- **Backend:** FastAPI + pandas + SQLite (`sqlite3`, no ORM) + Pydantic v2
- **Frontend:** Vite + React (plain JS) + Tailwind CSS + TanStack Query + react-dropzone + Sonner

## Quick Start

### 1. Create and activate the virtual environment

```bash
# Create (one-time)
python -m venv .venv

# Activate — Windows
.venv\Scripts\activate

# Activate — macOS / Linux
source .venv/bin/activate
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Start the backend

```bash
uvicorn backend.main:app --reload
```

API available at `http://localhost:8000/api/`. Interactive docs at `http://localhost:8000/docs`.

### 4. Install frontend dependencies and start the dev server (requires Node.js ≥ 18)

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server at `http://localhost:5173` — proxies `/api/*` to the backend automatically.

### 5. Run tests

```bash
python -m pytest backend/tests/ -v
```

## Production Build

```bash
cd frontend && npm run build
# Then start backend — it serves frontend/dist/ as static files
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

## Cleaning Pipeline

Automatically applied on every upload, in order:

| # | Rule | Behaviour |
|---|---|---|
| 1 | **Flag missing names** | Rows with no `Name` are kept but marked `is_incomplete` |
| 2 | **Strict deduplication** | Rows where every field matches are deduplicated; first occurrence is kept |
| 3 | **Canonicalize Gender / Grade / Scores** | `"m"` → `"Male"`, `"10th"` → `"10"`, `"85 marks"` → `85.0`, etc. |
| 4 | **Flag missing scores** | Any row missing `Math`, `Science`, or `English` is marked `is_incomplete`; scores are **not** imputed |
| 5 | **Recompute Total** | `Total = Math + Science + English`; the input CSV's `Total` column is never trusted |
| 6 | **Flag invalid scores** | Any score > 100 marks the row `is_invalid` |

Flagged rows (incomplete or invalid) are shown in the table but visually dimmed and excluded from the qualifying shortlist and CSV export.

## Upload Modes

| Mode | Behaviour |
|---|---|
| **Replace** (default) | Deletes all existing records, loads the new CSV fresh |
| **Append** | Concatenates the new CSV with existing data, then re-runs the full cleaning pipeline on the combined dataset (cross-file deduplication included) |

## API Reference

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/upload?mode=replace\|append` | Upload and clean a CSV |
| `GET` | `/api/students` | Get all students (page-load hydration) |
| `PATCH` | `/api/students/{id}/status` | Toggle Active / Debarred |
| `DELETE` | `/api/students` | Clear all records |
| `GET` | `/api/export?min_total=X` | Download filtered shortlist as CSV |

## ⚠️ Known Constraint (Render Free Tier)

SQLite provides real persistence across page refreshes and server restarts **within the same running instance**. However, **a fresh Render deploy resets the database** because Render's free-tier filesystem is ephemeral across redeploys.

This is an honest, documented trade-off — not a bug. During a demo session, data persists correctly. For production use requiring durable storage across redeploys, upgrade to a Render plan with a persistent disk, or migrate to hosted Postgres.

## Demo Script (≤ 90 seconds)

1. Upload `sample_data/messy_students.csv` — cleaned table + collapsible cleaning report appear
2. Use the **Min Total Score** slider — shortlist count and average update live
3. Click the **filter icon** → filter by Status or Flagged
4. Toggle one student to **Debarred** — count drops instantly, row goes muted
5. Click **Export Shortlist** — verify the CSV matches what's on screen
