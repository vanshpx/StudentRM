# Recruitment Manager

> Student eligibility shortlisting tool — upload raw CSVs, auto-clean, filter, manage exceptions, and export.

🔗 **Live Demo:** [https://studentrm-3.onrender.com](https://studentrm-3.onrender.com)

---

## UI

**Dashboard — Upload, Stats & Cleaning Summary**
![Dashboard screenshot](docs/screenshots/ui-dashboard.png)

**Student Table — Full Dataset with Filters & Debar Toggle**
![Student table screenshot](docs/screenshots/ui-table.png)

---

## Demo video

https://github.com/user-attachments/assets/d47e3ac7-ef25-4717-a243-30627ad17d0b



## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **FastAPI** + Uvicorn | API framework and server |
| **pandas** | Data cleaning pipeline |
| **SQLite** (`sqlite3`, no ORM) | Persistence — parameterized queries only |
| **Pydantic v2** | Request/response validation |
| **pytest** | Backend unit tests |

### Frontend
| Technology | Purpose |
|---|---|
| **Vite** + React (plain JS) | Build tool and UI framework |
| **Tailwind CSS** | Styling |
| **TanStack Query** | Server state, optimistic mutations |
| **react-dropzone** | Drag-and-drop CSV upload |
| **Sonner** | Toast notifications |

---

## Setup & Start

### 1. Clone and create a virtual environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Start the backend

```bash
uvicorn app:app --reload
# or equivalently:
uvicorn backend.main:app --reload
```

- API: `http://localhost:8000/api/`
- Interactive docs: `http://localhost:8000/docs`

### 4. Start the frontend (requires Node.js ≥ 18)

```bash
cd frontend
npm install
npm run dev
```

- Dev server: `http://localhost:5173`
- All `/api/*` requests are proxied to the backend automatically.

### 5. Run tests

```bash
python -m pytest backend/tests/ -v
```

### Production build (manual)

```bash
cd frontend && npm run build
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

The backend serves `frontend/dist/` as static files — single origin, no CORS needed.

### Docker (local)

```bash
# Build the image (compiles React + installs Python deps inside the container)
docker build -t recruitment-manager .

# Run — mounts a local ./data volume so SQLite persists across restarts
docker run -d \
  -p 8000:8000 \
  -v $(pwd)/data:/app/data \
  --name recruitment-manager \
  recruitment-manager
```

App available at `http://localhost:8000`.

> **Persist SQLite across container recreations:** the `-v $(pwd)/data:/app/data` flag mounts a local folder into the container. Without it, the database resets every time the container is recreated.

### Deployment — Render (Docker)

This app is deployed to **Render** as a Docker Web Service.

🔗 **Live URL:** [https://studentrm-3.onrender.com](https://studentrm-3.onrender.com)

Render automatically builds and runs the `Dockerfile` on every push to the main branch. No manual build steps are needed — Render handles the full build and deploy pipeline.

> **⚠️ Ephemeral Filesystem on Render Free Tier**
>
> Render's free-tier instances use an **ephemeral filesystem**. SQLite provides real persistence during the demo and between page refreshes within the same running instance. However, **a fresh Render deploy (or a service restart) resets the database** — all uploaded student data is lost.
>
> This is a documented trade-off of the free tier, not a bug. For persistent storage across deploys, attach a Render Disk (paid) or migrate to an external database.

---

## Cleaning Pipeline

Applied automatically on every upload. The pipeline runs entirely in `backend/cleaning.py` — no cleaning logic lives in routes.

---

### Step 1 — Flag Missing Names
- Any row where `Name` is `null`, empty, or whitespace-only is flagged `is_incomplete = True`
- The row is **kept** in the dataset (not dropped) so the user can see it in the table
- Excluded from the qualifying shortlist and the CSV export

---

### Step 2 — Strict Deduplication
- A composite key is built from: `name | gender | grade | math | science | english`
- Before comparison, each field is normalised:
  - **Name** — lowercased, whitespace collapsed, surrounding quotes stripped
  - **Scores** — converted to a canonical float string (`66.0000`) so `"66"` and `"66.0"` correctly match
  - **Text fields** — lowercased and trimmed
- Only rows where **every field matches** are treated as duplicates — partial matches are kept
- The **first occurrence is kept**; all subsequent duplicates are removed
- Reported as `duplicates_removed` in the cleaning summary

---

### Step 3 — Canonicalize Gender
Case-insensitive trimmed lookup:

| Raw input | Canonical output |
|---|---|
| `m`, `M`, `male`, `Male`, `MALE` | `Male` |
| `f`, `F`, `female`, `Female`, `FEMALE` | `Female` |
| `other`, `Other`, `o`, `O` | `Other` |
| Anything else / blank | `null` — left as missing |

---

### Step 4 — Normalize Grade
Extracts the numeric part using `re.search(r'\d+', ...)`:

| Raw input | Normalized output |
|---|---|
| `10`, `10 ` | `10` |
| `10th` | `10` |
| `Grade 10` | `10` |
| `Std 11` | `11` |
| `Class 9` | `9` |

If no digit is found, the original trimmed value is kept as-is — and the row is flagged **`is_invalid = True`** (a grade of `"Pass"` or `"A+"` cannot be matched to a class year).

---

### Step 5 — Normalize Score Values
Strips non-numeric text using `re.search(r'\d+(\.\d+)?', ...)`:

| Raw input | Extracted value |
|---|---|
| `85` | `85.0` |
| `85 marks` | `85.0` |
| `85/100` | `85.0` |
| `85 pts` | `85.0` |
| `85.5marks` | `85.5` |
| `85%` | `85.0` |
| blank / `—` / text-only | `null` |

Applies to `Math`, `Science`, and `English`. Any cell whose cleaned value differs from its raw value is counted in `typos_fixed`.

---

### Step 6 — Flag Missing Scores
- After score extraction, any row where `Math`, `Science`, or `English` is still `null` → `is_incomplete = True`
- **No imputation** — missing scores are left as `null`
- Rationale: imputing silently would misrepresent a student's actual academic record

---

### Step 7 — Recompute Total
- When all three scores are present: `Total = Math + Science + English`
- The input CSV's `Total` column is **always overwritten** — it is never trusted
- When any score is missing: `Total` is set to `null` and the row is marked `is_incomplete`

---

### Step 8 — Flag Invalid Scores
- Any row where `Math > 100`, `Science > 100`, or `English > 100` → `is_invalid = True`
- The row is kept and the (inflated) total is still computed and shown
- Invalid rows are excluded from the qualifying shortlist and the CSV export

---

### Step 9 — Flag Invalid Names
- After title-casing, any `Name` that contains **no alphabetic character** → `is_invalid = True`
- Catches purely numeric names (`"12345"`), symbol-only values (`"@#$%"`), or data-entry errors
- A valid name must contain at least one letter

---

> **Flagged rows** (`is_incomplete` or `is_invalid`) are stored in the database and displayed in the table with visual dimming. They are excluded from the "Students Qualify" count, the average total, and all CSV exports by default.

---


## Features

### Upload & Clean
- Drag-and-drop or browse for a `.csv` file
- Pipeline runs instantly on upload; collapsible cleaning report shows exactly what changed (duplicates removed, typos fixed, rows flagged, processing time)
- **Replace mode** — wipes existing data, loads the new file fresh
- **Append mode** — merges new CSV with existing records and re-runs the full pipeline (cross-file deduplication included)

### Live Score Filter
- Manual number input — type any value to set the minimum total score threshold
- The ceiling is **dynamic**: automatically set to the highest valid total in the current dataset (e.g. if the max total is 253, the range shows 0–253)
- Qualifying count and average update instantly client-side via `useDeferredValue` — no network call, no button press

### Student Table
- All students displayed with full columns: Name, Gender, Grade, Math, Science, English, Total, Status, Flagged, Action
- Flagged rows (incomplete / invalid scores) are visually dimmed
- **Status badge** reflects real qualification state:
  - 🟢 **Qualified** — Active, not flagged, total ≥ min
  - ⚫ **Not Qualified** — Active but flagged OR below threshold
  - 🔴 **Debarred** — manually debarred
- **Filter by Status**: All · Qualified · Not Qualified · Debarred
- **Filter by Flagged**: All · Yes · No
- Active filter count badge on the filter button; dismissible filter pills in the header

### Debar / Undebar Toggle
- Per-student Active ↔ Debarred switch
- **Optimistic update** — UI changes instantly; PATCH fires in the background
- On failure, state reverts automatically and a toast notification appears

### Export
- "Export Shortlist" downloads a CSV that **mirrors the current table filters exactly**
- Export is always re-filtered server-side from SQLite — never trusts client state
- Supported export modes:

  | Status Filter | Exports |
  |---|---|
  | **Qualified** *(default)* | Active, non-flagged, total ≥ min |
  | **Not Qualified** | Active, flagged OR total < min |
  | **Debarred** | Debarred students, total ≥ min |
  | **All** | All students, total ≥ min |

### Persistence
- SQLite persists state across page refreshes and server restarts within the same running instance
- On page load, React hydrates from `GET /api/students` — no data loss on refresh

---

