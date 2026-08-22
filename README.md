# Student Pipeline — Eligibility Shortlisting Tool

A single-service web app for exam cells to upload raw student CSVs, auto-clean them, filter by minimum total score, manage eligibility exceptions, and export a clean shortlist.

## Stack

- **Backend:** FastAPI + pandas + SQLite (`sqlite3`, no ORM) + Pydantic v2
- **Frontend:** Vite + React (plain JS) + Tailwind CSS + TanStack Query + react-dropzone

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

### 3. Install frontend dependencies (requires Node.js ≥ 18)

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server at `http://localhost:5173` — proxies `/api/*` to the backend automatically.

### 4. Run tests

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

Automatically applied on upload, in order:

1. **Drop missing names** — rows with no `Name` are unrecoverable and removed
2. **Deduplicate** — normalized `(name, grade)` pairs; keeps first occurrence
3. **Canonicalize Gender/Grade** — `"m"` → `"Male"`, `"10th"` → `"10"`, etc.
4. **Impute missing scores** — `Math`, `Science`, `English` nulls filled with column median
5. **Recompute Total** — always `Math + Science + English`; input Total is never trusted

## API Reference

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/upload` | Upload and clean a CSV |
| `GET` | `/api/students` | Get all students (page load hydration) |
| `PATCH` | `/api/students/{id}/status` | Toggle Active / Debarred |
| `GET` | `/api/export?min_total=X` | Download filtered shortlist as CSV |

## ⚠️ Known Constraint (Render Free Tier)

SQLite gives real persistence across page refreshes and server restarts **within the same running instance**. However, **a fresh Render deploy resets the database** because Render's free-tier filesystem is ephemeral across redeploys.

This is an honest, documented trade-off — not a bug. During a demo session, data persists correctly. For production use requiring durable storage across redeploys, upgrade to a Render plan with a persistent disk, or migrate to a hosted Postgres.

## Demo Script (≤ 90 seconds)

1. Upload the raw `sample_data/messy_students.csv`
2. See the cleaned table + collapsible cleaning report
3. Type `200` in "Minimum Total Score" — shortlist updates live
4. Toggle one student to **Debarred** — count drops instantly, row goes muted
5. Click **Export Shortlist (CSV)** — verify the download matches the screen
