# Recruitment Manager

> Student eligibility shortlisting tool — upload raw CSVs, auto-clean, filter, manage exceptions, and export.

---

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

### Production build

```bash
cd frontend && npm run build
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

The backend serves `frontend/dist/` as static files — single origin, no CORS needed.

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

If no digit is found, the original trimmed value is kept as-is.

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

> **Flagged rows** (`is_incomplete` or `is_invalid`) are stored in the database and displayed in the table with visual dimming. They are excluded from the "Students Qualify" count, the average total, and all CSV exports.

---


## Features

### Upload & Clean
- Drag-and-drop or browse for a `.csv` file
- Pipeline runs instantly on upload; collapsible cleaning report shows exactly what changed (duplicates removed, typos fixed, rows flagged, processing time)
- **Replace mode** — wipes existing data, loads the new file fresh
- **Append mode** — merges new CSV with existing records and re-runs the full pipeline (cross-file deduplication included)

### Live Score Filter
- Slider controls the minimum total score threshold
- Qualifying count and average update instantly client-side — no network call, no button press

### Student Table
- All students displayed with full columns: Name, Gender, Grade, Math, Science, English, Total, Status, Flagged, Action
- Flagged rows (incomplete / invalid scores) are visually dimmed
- **Filter by Status** (Active / Debarred) and **Flagged** (Yes / No) via the filter icon dropdown
- Active filter count badge on the filter button; dismissible filter pills in the header

### Debar / Undebar Toggle
- Per-student Active ↔ Debarred switch
- **Optimistic update** — UI changes instantly; PATCH fires in the background
- On failure, state reverts automatically and a toast notification appears

### Export
- "Export Shortlist" downloads a CSV of Active, non-flagged students above the score threshold
- Export is always re-filtered server-side from SQLite — never trusts client state

### Persistence
- SQLite persists state across page refreshes and server restarts within the same running instance
- On page load, React hydrates from `GET /api/students` — no data loss on refresh

---

