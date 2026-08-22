# AGENTS.md — Student Data Pipeline & UI

> **Project:** Student Data Pipeline & UI
> **Timeline:** 2-day MVP build → Render deploy
> **Stack:** FastAPI + pandas + SQLite (backend) | Vite + React + Tailwind + shadcn/ui (frontend)
> **Companion docs:** [`student-pipeline-product-requirements.md`](../documents/student-pipeline-product-requirements.md) | [`student-pipeline-technical-requirements.md`](../documents/student-pipeline-technical-requirements.md)

---

## 1. Project Overview

This is a **single-service web application** that automates the student eligibility shortlisting workflow for exam cells and admin teams.

### Problem Being Solved
Exam cells receive raw student score exports with messy data — inconsistent name casing, typo'd gender/grade fields, missing marks, sometimes-wrong totals, and duplicate entries from re-submissions. The current workflow involves 30–60 minutes of manual Excel cleaning before any filtering can happen. Late exceptions (e.g. a student flagged for malpractice after a shortlist is built) risk being silently missed.

### What This App Does
- Accepts a raw student CSV upload
- Auto-cleans it (dedup, typo correction, imputation, Total recalculation)
- Displays the cleaned table with a visible cleaning summary
- Provides a live min-score filter (client-side, zero-network, instant)
- Allows per-student debar/undebar with instant UI feedback
- Exports a filtered, Active-only shortlist as a CSV
- Survives page refreshes (SQLite persistence)

### Primary User
**Ritu — Exam Cell Coordinator.** Non-technical. Comfortable with Excel. No patience for setup, config, or documentation. Her success = upload raw file once, trust the output, flip one switch for exceptions.

---

## 2. Repository Structure

```
/
├── backend/
│   ├── main.py                    # FastAPI app, static file mount, API routes
│   ├── cleaning.py                # pandas cleaning pipeline (all rules here)
│   ├── store.py                   # SQLite thin repository layer (no ORM)
│   ├── models.py                  # Pydantic v2 models
│   └── tests/
│       └── test_cleaning.py       # pytest suite (6+ focused tests)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Root — owns students state, minTotal state
│   │   ├── components/
│   │   │   ├── UploadZone.jsx
│   │   │   ├── CleaningReportSummary.jsx
│   │   │   ├── StudentTable.jsx
│   │   │   ├── ScoreFilterInput.jsx
│   │   │   ├── ShortlistStats.jsx
│   │   │   └── ExportButton.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── documents/
│   ├── student-pipeline-product-requirements.md
│   └── student-pipeline-technical-requirements.md
│
├── .agents/
│   └── AGENTS.md                  # This file
│
└── README.md
```

---

## 3. Tech Stack — Final Decisions

Do **not** deviate from these choices mid-build. They were selected for the 2-day timeline.

| Layer | Technology | Rationale |
|---|---|---|
| Backend framework | **FastAPI** + **Uvicorn** | Async, minimal boilerplate, automatic OpenAPI docs |
| Data processing | **pandas** | Cleaning pipeline logic lives entirely here |
| Database | **SQLite** (stdlib `sqlite3` — no ORM) | Zero setup, real persistence within a deploy, state survives refresh |
| Validation | **Pydantic v2** | API boundary validation; enum for `status` field |
| Testing | **pytest** | Backend `cleaning.py` only; 6+ focused tests |
| Frontend scaffold | **Vite + React (plain JS)** | No TypeScript — skip type friction under time pressure |
| Styling | **Tailwind CSS** | CDN or Vite plugin |
| UI components | **shadcn/ui** | Pre-built Switch component for the debar toggle |
| Async data / mutations | **TanStack Query** | Handles PATCH mutation, optimistic updates, revert on failure |
| File upload UX | **react-dropzone** | Drag-and-drop CSV upload |
| Deployment | **Render** (single Web Service) | FastAPI serves both API and React `dist/` — no CORS config |

---

## 4. Architecture Flow

```
Upload CSV
   │
   ▼
FastAPI /api/upload ──► cleaning.py (pandas) ──► SQLite (students table, new batch_id)
   │
   ▼
Response: full student list + cleaning_report ──► React state (source of truth for UI)
   │
   ├─ Toggle status ──► optimistic local update (instant) ──► PATCH /api/students/{id}/status (persists)
   ├─ Min-score filter ──► client-side useMemo (no network call, instant)
   └─ Export ──► GET /api/export?min_total=X (server re-filters from SQLite — authoritative)
```

### Key Architecture Decisions

1. **Export re-filters server-side.** The UI filters client-side for speed. The downloaded CSV must never depend on possibly-stale client state. The server is the source of truth for anything that leaves the app.
2. **On page load/refresh:** `GET /api/students` hydrates React state from SQLite. This is what makes refresh-persistence work.
3. **Single active batch (MVP simplification):** only one dataset is live at a time. A new upload deletes the previous batch's student rows. No batch-switching UI.
4. **Optimistic toggle:** Status change fires an immediate local state update, then PATCH in the background. If PATCH fails → revert local state + show toast. Never let the UI drift silently from SQLite.

---

## 5. SQLite Data Model

```sql
CREATE TABLE upload_batches (
    batch_id TEXT PRIMARY KEY,
    filename TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rows_raw INTEGER,
    rows_cleaned INTEGER,
    duplicates_removed INTEGER,
    values_imputed INTEGER,
    typos_fixed INTEGER,
    processing_ms REAL
);

CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL REFERENCES upload_batches(batch_id),
    name TEXT NOT NULL,
    gender TEXT,
    grade TEXT,
    math REAL,
    science REAL,
    english REAL,
    total REAL,
    status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Debarred')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Schema Rules for Agents
- Use `uuid.uuid4()` for `batch_id` generation in Python.
- `status` is an enum-constrained column. Never write raw strings other than `'Active'` or `'Debarred'`.
- `total` is always recomputed (`math + science + english`). Never trust the input CSV's Total column.
- When a new batch is uploaded: delete all `students` rows for the old `batch_id`, then delete the old `upload_batches` row, then insert the new batch.

---

## 6. API Contract

All routes are prefixed under `/api/`. React's built `dist/` is served at `/`.

| Method | Route | Purpose | Request | Response |
|---|---|---|---|---|
| `POST` | `/api/upload` | Multipart CSV upload; runs cleaning pipeline; replaces active batch | `multipart/form-data`, field name `file` | `{ batch_id, students: [...], cleaning_report: {...} }` |
| `GET` | `/api/students` | Hydrate current active batch on page load/refresh | — | `{ students: [...] }` |
| `PATCH` | `/api/students/{id}/status` | Persist a single Active/Debarred toggle | `{ "status": "Active" | "Debarred" }` | `{ id, status }` |
| `GET` | `/api/export` | Server-side filtered CSV export of Active students | Query param: `min_total=X` | `text/csv` file stream |

### Pydantic Models (`backend/models.py`)

```python
from typing import Optional, Literal
from pydantic import BaseModel

class Student(BaseModel):
    id: int
    batch_id: str
    name: str
    gender: Optional[str] = None
    grade: Optional[str] = None
    math: Optional[float] = None
    science: Optional[float] = None
    english: Optional[float] = None
    total: Optional[float] = None
    status: Literal["Active", "Debarred"]

class CleaningReport(BaseModel):
    rows_raw: int
    rows_cleaned: int
    duplicates_removed: int
    typos_fixed: int
    values_imputed: int
    rows_dropped: int
    processing_ms: float

class StatusUpdateRequest(BaseModel):
    status: Literal["Active", "Debarred"]
```

---

## 7. Data Cleaning Pipeline Rules (`cleaning.py`)

These rules are **fixed for MVP**. Do not add fuzzy matching or extra logic unless Day 1 finishes early.

### Rule 1 — Deduplication
- Normalize `name`: trim whitespace, lowercase, collapse internal whitespace
- Compare normalized `(name, grade)` pairs
- Keep **first** occurrence; drop the rest
- Count dropped rows → `cleaning_report.duplicates_removed`

### Rule 2 — Typo Canonicalization (categorical fields)
Apply **case-insensitive, trimmed** lookups after stripping whitespace from the raw cell value.

**Gender canonicalization dict:**
```python
GENDER_MAP = {
    "m": "Male", "male": "Male",
    "f": "Female", "female": "Female",
    "other": "Other", "o": "Other",
}
# Usage: GENDER_MAP.get(raw.strip().lower())
```

**Grade normalization — extract the numeric part:**
```python
import re
def normalize_grade(raw: str) -> str:
    # Handles "10th", "Grade 10", "10 " → "10"
    match = re.search(r'\d+', str(raw))
    return match.group(0) if match else raw.strip()
```

Count any cell whose cleaned value differs from the raw value → `cleaning_report.typos_fixed`.

### Rule 3 — Missing Numeric Value Imputation
- Impute `Math`, `Science`, `English` with the **column median**
- Compute median **after dedup** and **before** recalculating `Total`
- Count imputed cells (per-cell, not per-row) → `cleaning_report.values_imputed`

### Rule 4 — Total Recalculation
- Always recompute `Total = Math + Science + English` from the cleaned subject scores
- **Never trust the input `Total` column**
- This always runs on every row; no separate counter needed

### Rule 5 — Unrecoverable Row Removal
- Any row where `Name` is missing (null/empty) → drop it
- Count dropped rows → `cleaning_report.rows_dropped`

### Cleaning Report Shape
```python
{
    "rows_raw": int,          # Row count before any cleaning
    "rows_cleaned": int,      # Row count after cleaning (rows written to DB)
    "duplicates_removed": int,
    "typos_fixed": int,
    "values_imputed": int,
    "rows_dropped": int,      # Rows dropped for missing Name
    "processing_ms": float    # Wall-clock ms for the full pipeline
}
```

Measure `processing_ms` with `time.perf_counter()`. Display it in the UI — it makes the speed demonstrable, not just felt.

---

## 8. Frontend Component Breakdown

All components live under `frontend/src/components/`.

### `App.jsx` (root)
- Owns `students` (array) and `minTotal` (number, default `0`) state
- Fetches `GET /api/students` on mount via TanStack Query to hydrate from SQLite
- Manages TanStack Query mutation for `PATCH /api/students/{id}/status` (optimistic update pattern — see Section 9)
- Passes state and handlers as props to child components

### `UploadZone.jsx`
- Uses `react-dropzone`; accepts `.csv` only
- On file drop → POST to `/api/upload` → on success: update `students` state in `App`, surface `cleaning_report` to `CleaningReportSummary`
- Show upload progress indicator; handle error state with a visible error message

### `CleaningReportSummary.jsx`
- Receives `cleaning_report` object as prop
- Renders as a **collapsible** summary card (collapsed by default, expand on user click)
- Shows: `"N duplicates removed"`, `"N typos fixed"`, `"N missing values filled"`, `"N rows dropped"`, `"Processed in Xms"`
- Only rendered after a successful upload; hidden in the empty/pre-upload state

### `StudentTable.jsx`
- Renders the **full cleaned dataset** (all students, not just those above the threshold)
- Per-row shadcn `Switch` component for Active/Debarred toggle
- On toggle: call the mutation handler from `App` (optimistic update lives in `App`, not here)
- Debarred rows must be **visually distinct** — use muted text color and optional strikethrough styling
- Columns: Name, Gender, Grade, Math, Science, English, Total, Status (switch)

### `ScoreFilterInput.jsx`
- Controlled `<input type="number">` bound to `minTotal` in `App`
- No debounce needed — filtering is `useMemo`, no network call
- Label: "Minimum Total Score"

### `ShortlistStats.jsx`
- Derived from the same `useMemo` that computes the shortlist
- Shows: `"N students qualify"` and `"Average total: X.X"`
- Excludes Debarred students from both count and average
- Updates instantly on any filter change or status toggle

### `ExportButton.jsx`
- Direct browser download via anchor `href` or `window.location.href`
- URL: `/api/export?min_total=${minTotal}`
- Do **not** use `fetch` + blob — simpler, no auth headers needed in MVP
- Label: "Export Shortlist (CSV)"

---

## 9. State Management Rules

| State | Owner | Updated By |
|---|---|---|
| `students` | `App.jsx` | Upload response, PATCH mutation (optimistic) |
| `minTotal` | `App.jsx` | `ScoreFilterInput` `onChange` |
| `filteredStudents` | `useMemo` in `App` | Derived from `students` + `minTotal`; excludes Debarred |
| `cleaning_report` | `App.jsx` (or local in `UploadZone`) | Upload response |

### Optimistic Toggle Pattern (implement exactly as below in `App.jsx`)

```jsx
const toggleStatus = useMutation({
  mutationFn: ({ id, status }) =>
    fetch(`/api/students/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
  onMutate: ({ id, status }) => {
    // 1. Snapshot previous state for rollback
    const previousStudents = students;
    // 2. Optimistically update UI immediately
    setStudents(prev =>
      prev.map(s => (s.id === id ? { ...s, status } : s))
    );
    return { previousStudents };
  },
  onError: (_err, _vars, context) => {
    // 3. Revert on failure
    setStudents(context.previousStudents);
    toast.error("Failed to update status. Please try again.");
  },
});
```

---

## 10. Non-Functional Requirements

| Requirement | Target | Implementation |
|---|---|---|
| Cleaning pipeline speed | < 500ms for real dataset | pandas is sufficient; display `processing_ms` in UI |
| Toggle perceived latency | ~0ms (instant) | Optimistic update — never wait for PATCH |
| Filter perceived latency | ~0ms (instant) | `useMemo` — no network call |
| CORS | None needed in production | FastAPI serves both API and `dist/` at the same origin |
| Browser support | Modern browsers only | No polyfills required |
| Scale consistency | Same UX for 50 to ~2,000 rows | pandas + SQLite + `useMemo` adequate at this scale; no pagination needed |

---

## 11. Testing Requirements

**Scope:** `pytest` on `cleaning.py` only. Skip frontend tests given the 2-day timeline.

**Minimum 6 tests in `backend/tests/test_cleaning.py`:**

| # | Test | Assertion |
|---|---|---|
| 1 | Dedup removes exact normalized duplicates | Two rows with same normalized `(name, grade)` → one row in output |
| 2 | Dedup keeps first occurrence | Retained row has values from the first input row |
| 3 | Gender typo normalization | `"m"`, `"male"`, `"M"`, `"MALE"` all → `"Male"` |
| 4 | Grade format normalization | `"10th"`, `"Grade 10"`, `"10 "` all → `"10"` |
| 5 | Missing numeric value → median imputed | Row with `NaN` in Math gets the correct column median |
| 6 | Total always recomputed | Row where raw Total ≠ Math+Science+English → output Total = Math+Science+English |
| 7 | Row with missing Name is dropped | `cleaning_report.rows_dropped == 1` for one such row in input |

Run tests with:
```bash
pytest backend/tests/ -v
```

---

## 12. Deployment

### Build & Serve
```bash
# Step 1 — Build the frontend
cd frontend && npm install && npm run build
# Outputs: frontend/dist/

# Step 2 — Deploy via Render
# Render start command:
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

### Static File Mount in `backend/main.py`
```python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# Register API router first
app.include_router(api_router, prefix="/api")

# Serve built React app for all other paths
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")
```

### Known Constraints — Document in README, Don't Hide
> **Render free-tier filesystem is ephemeral across redeploys.** SQLite provides real persistence during the demo and between page refreshes within the same running instance. A fresh Render deploy resets the database. This is an honest, documented trade-off — not a hidden bug. State it clearly in the README to show awareness of the constraint.

---

## 13. Two-Day Build Plan

### Day 1 (~8–10 hrs) — Backend

- [ ] Create SQLite schema (`CREATE TABLE` statements, run in `store.py.__init__`)
- [ ] `store.py` — thin repository layer:
  - `insert_batch(batch: dict) -> None`
  - `insert_students(students: list[dict]) -> None`
  - `get_active_students() -> list[dict]`
  - `update_student_status(id: int, status: str) -> dict`
  - `delete_old_batch() -> None`
  - `get_export_students(min_total: float) -> list[dict]`
- [ ] `models.py` — Pydantic v2 models (`Student`, `CleaningReport`, `StatusUpdateRequest`)
- [ ] `cleaning.py` — full pipeline per Section 7 (all 5 rules + `processing_ms`)
- [ ] `test_cleaning.py` — 6+ pytest tests, all green
- [ ] `main.py` — all 4 API routes, static file mount
- [ ] Manual smoke-test with curl/Postman and a sample CSV

### Day 2 (~8–10 hrs) — Frontend + Ship

- [ ] Vite/React scaffold; install shadcn, Tailwind, TanStack Query, react-dropzone
- [ ] Build all 6 components per Section 8
- [ ] Wire upload to API; update `students` state on success; show `CleaningReportSummary`
- [ ] `useMemo` filter + `ShortlistStats` recompute
- [ ] TanStack Query optimistic toggle mutation with revert-on-failure toast
- [ ] `ExportButton` — direct anchor download
- [ ] Polish: empty state, loading spinners, error messages
- [ ] Deploy to Render; smoke-test the live URL end-to-end
- [ ] Write README (include ephemeral-filesystem caveat)
- [ ] Record ≤90s demo video

### Demo Script (fits in 90 seconds — script this before recording)
1. Upload raw CSV → cleaned table + collapsible cleaning report appears
2. Type a min-score threshold → shortlist count and average update live, no button press
3. Toggle one student to Debarred → count drops instantly, row goes visually muted
4. Click Export → open the downloaded CSV, verify it matches what's on screen

---

## 14. Agent Coding Rules

These rules apply to **all agents** working on this repository.

### Absolute Rules (Never Break)
- **No ORM.** Use plain `sqlite3` with `?` placeholder parameterized queries. No SQLAlchemy, no Tortoise-ORM, nothing else.
- **No TypeScript** in the frontend. Plain JavaScript only.
- **No fuzzy/near-duplicate matching** (no `rapidfuzz`) in MVP. Exact normalized match only.
- **No auth, no login, no multi-user.** Single admin, single session.
- **No multi-file upload or merging.** One CSV at a time; new upload replaces entirely.
- **Never use f-strings to build SQL queries.** Use parameterized queries exclusively to avoid SQL injection.

### Backend Rules
- All data cleaning logic lives in `cleaning.py`. Routes in `main.py` must not contain data transformation logic.
- Always measure and return `processing_ms` using `time.perf_counter()`.
- Return HTTP 422 for validation errors (Pydantic handles this automatically).
- The `status` field must be validated as `Literal["Active", "Debarred"]` at the API boundary — no raw strings.
- The `total` column must always be recomputed server-side. Never write the client-provided or input-CSV total directly.

### Frontend Rules
- All shared mutable state (`students`, `minTotal`) lives in `App.jsx`. Do not introduce Redux, Zustand, or any other state library.
- Filtering must use `useMemo`. Never compute filtered lists inside JSX or render functions.
- Toggle mutations must follow the optimistic-update-then-revert pattern from Section 9 exactly.
- Export must use direct browser download (anchor `href`). Do not use `fetch` + blob.
- `CleaningReportSummary` must be collapsible. Do not render it always-expanded.

### What NOT to Build in MVP (Do Not Add Scope)
- No audit trail or history of debar decisions
- No multi-user accounts or roles
- No merging of multiple CSV files
- No hand-editing of individual score values
- No notifications or emails to students
- No GitHub Actions CI pipeline
- No persisted cleaning-audit-log table (the report is ephemeral per upload)
- No historical batch comparison

---

## 15. Success Criteria

The build is complete when **all of the following are true:**

| Criterion | Verified? |
|---|---|
| Raw CSV uploads and cleans automatically with no manual step | — |
| Cleaning summary is visible and collapsible post-upload | — |
| Cleaned table renders correctly for the full dataset | — |
| Min-score filter updates shortlist + stats live with no submit button | — |
| Debar/undebar toggle updates shortlist, stats, and export eligibility instantly | — |
| Export CSV matches exactly what's on screen (Active, above threshold only) | — |
| State survives a page refresh | — |
| Full flow completable in under 2 minutes by a first-time user | — |
| All 6+ pytest tests pass | — |
| Deployed to a single Render URL | — |
| README documents the ephemeral-filesystem caveat honestly | — |

---

## 16. Open Items to Verify Against the Real Dataset

Before or during Day 1, open the actual CSV/Google Sheet and verify:

- [ ] **Exact column header spelling/casing** — e.g. `Math` vs `Maths`, `Total` vs `Grand Total`
- [ ] **Grade format** — stored as a number (`10`) or a string (`"10th"`, `"Grade 10"`)?
- [ ] **Typo patterns actually present** — extend the canonicalization dicts in `cleaning.py` if needed
- [ ] **Approximate row count** — for realistic performance testing and to confirm < 500ms is achievable

Adjust `cleaning.py` rules and canonicalization dicts based on what you find. Do not build against assumptions about the real data format.
