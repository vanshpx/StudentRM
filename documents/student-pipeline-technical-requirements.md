# Technical Requirements: Student Data Pipeline & UI

**Timeline:** 2-day build → deploy
**Status:** MVP-scoped. Anything not in Section 2 "In Scope" is deliberately cut.

---

## 1. Project Summary

A single-service web app: upload a raw student CSV → auto-clean it → view the cleaned table → toggle students Active/Debarred in real time → filter by minimum total score → export the filtered shortlist as CSV. Backend is FastAPI + pandas + SQLite. Frontend is React (Vite) + Tailwind + shadcn/ui.

---

## 2. Scope for the 2-Day Build

**In scope (must ship):**
- CSV upload + auto-cleaning pipeline
- Cleaned data table view
- Debar/Undebar toggle per student, persisted in SQLite
- Live min-total-score filter with instant stats
- CSV export of the filtered shortlist
- Single Render deployment (one URL)
- README + ≤90s demo video

**Out of scope / only if time remains on Day 2 evening:**
- Fuzzy near-duplicate matching (`rapidfuzz`) — MVP uses normalized exact-match dedup instead
- GitHub Actions CI running pytest
- A persisted cleaning-audit-log table (MVP returns the report once at upload, doesn't store row-level history)
- Auth or multi-user isolation

Cutting these now is what makes 2 days realistic — don't add them back mid-build unless Day 1 finishes early.

---

## 3. Tech Stack (Final)

**Backend:** FastAPI, Uvicorn, pandas, `sqlite3` (stdlib — skip an ORM to save setup time), Pydantic v2, pytest

**Frontend:** Vite + React (plain JS, not TypeScript — skip type friction under time pressure) + Tailwind (CDN or Vite plugin) + shadcn/ui + TanStack Query + `react-dropzone`

**Deployment:** One Render Web Service. FastAPI serves both the JSON API and the built React `dist/` folder — no separate frontend host, no CORS config to maintain in production.

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
   └─ Export ──► GET /api/export?min_total=X (server re-filters from SQLite — authoritative, not trusting client state)
```

**Why export re-filters server-side:** the UI filters client-side for speed, but the downloaded CSV should never depend on possibly-stale client state. Server is the source of truth for anything that leaves the app; client is the source of truth for anything the user is just looking at.

**On page load/refresh:** `GET /api/students` hydrates React state from SQLite — this is what makes the SQLite choice actually pay off (state survives a refresh or a server restart within the same deploy).

---

## 5. Data Model (SQLite)

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

**Single active batch rule (MVP simplification):** only one dataset is "live" at a time. A new upload deletes the previous batch's student rows and starts fresh. This avoids building batch-switching UI you don't have time for, and matches the assessment's actual demo flow (upload once, work with it).

---

## 6. API Contract

| Method | Route | Purpose | Response |
|---|---|---|---|
| `POST` | `/api/upload` | Multipart CSV upload, runs cleaning pipeline, replaces active batch | `{ batch_id, students: [...], cleaning_report: {...} }` |
| `GET` | `/api/students` | Hydrate current active batch (used on page load/refresh) | `{ students: [...] }` |
| `PATCH` | `/api/students/{id}/status` | Persist a single toggle | `{ id, status }` |
| `GET` | `/api/export?min_total=X` | Server-side filtered CSV of Active students ≥ X | `text/csv` file stream |

Pydantic models: `Student`, `CleaningReport`, `StatusUpdateRequest`. Validate `min_total` and `status` (enum: `Active`/`Debarred`) at the API boundary, not just in the frontend.

---

## 7. Data Cleaning Pipeline Rules

1. **Duplicates:** normalize `name` (trim, lowercase, collapse internal whitespace) and compare with `grade`; identical pairs → keep first occurrence, drop rest. Count dropped rows for the report.
2. **Typos (categorical fields):** canonicalization dicts.
   - Gender: `{"m": "Male", "male": "Male", "f": "Female", "female": "Female", ...}` (case-insensitive, trimmed)
   - Grade: normalize formats like `"10th"`, `"Grade 10"`, `"10 "` → a single canonical string, e.g. `"10"`
3. **Missing numeric values:** impute `Math`/`Science`/`English` with the column median, computed *after* dedup and *before* recalculating `Total`. Flag which cells were imputed in the report.
4. **Total recalculation:** always recompute `Total = Math + Science + English` from the (cleaned) subject scores — never trust the input `Total` column. Log any row where the recomputed value differs from the raw input.
5. **Unrecoverable rows:** a row with a missing `Name` is dropped (can't identify the student) and counted separately in the report.

The `cleaning_report` returned from `/api/upload` should surface: `rows_raw`, `rows_cleaned`, `duplicates_removed`, `typos_fixed`, `values_imputed`, `rows_dropped`, `processing_ms`. Show this in the UI as a small collapsible summary — it's what makes the cleaning step legible to a judge instead of a black box.

---

## 8. Frontend Component Breakdown

- `UploadZone` — drag-and-drop via `react-dropzone`
- `CleaningReportSummary` — collapsible, renders the report from upload response
- `StudentTable` — cleaned data + per-row `Switch` (shadcn) for Active/Debarred
- `ScoreFilterInput` — controlled input, drives `useMemo` filter, no debounce needed since there's no network call
- `ShortlistStats` — matched count + average scores, recomputed with the same `useMemo`
- `ExportButton` — hits `/api/export?min_total=X` directly (browser download, not fetch+blob, unless you need auth headers)
- `App` — owns `students` state, `minTotal` state, TanStack Query mutation for the PATCH toggle

---

## 9. State Management

Client-authoritative for display (instant filter/toggle feedback), server-authoritative for anything persisted or exported. Toggle = optimistic local update first, PATCH fired in the background (non-blocking). If the PATCH fails, revert the optimistic update and show a toast — don't let the UI silently drift from SQLite.

---

## 10. Non-Functional Requirements

- Cleaning pipeline: comfortably under 500ms for the actual dataset size; test once with a synthetically inflated 10k-row CSV so you can honestly claim it scales, and display `processing_ms` in the UI.
- Toggle interaction: perceived latency near 0ms (optimistic update, not waiting on the PATCH).
- One deployed URL, no CORS in production.

---

## 11. Testing

`pytest` on `cleaning.py` only (skip frontend tests given the timeline) — minimum:
- dedup removes exact normalized duplicates, keeps first occurrence
- gender/grade typo normalization covers a few known variants
- missing numeric value gets median-imputed
- `Total` is always recomputed, not trusted from input
- a row with missing `Name` is dropped and counted

6 focused tests is enough to demonstrate rigor without eating Day 1.

---

## 12. Deployment

- Build: `cd frontend && npm install && npm run build` → outputs `frontend/dist`
- FastAPI mounts `dist/` as static files at `/`, API routes live under `/api/*`
- Render start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

**Known caveat to flag in your README, not hide:** Render's free-tier filesystem is ephemeral across redeploys (though it persists across normal restarts within the same running instance). SQLite gives you real persistence during the demo and between page refreshes, but a fresh deploy will reset it unless you're on a paid plan with a persistent disk. That's an honest, defensible trade-off to state explicitly — it shows judges you understand the constraint rather than having it discovered as a bug.

---

## 13. Two-Day Task Breakdown

**Day 1 (~8–10 hrs) — Backend**
- SQLite schema + `store.py` (thin repository layer, no ORM)
- `cleaning.py` + the 6 pytest tests
- `/api/upload`, `/api/students`, `/api/students/{id}/status`, `/api/export`
- Manual testing with curl/Postman against a sample CSV

**Day 2 (~8–10 hrs) — Frontend + Ship**
- Vite/React scaffold, shadcn components, Tailwind pass
- Wire components to the API (TanStack Query), client-side `useMemo` filtering
- Toggle UX polish (optimistic update + revert-on-failure)
- Deploy to Render, smoke-test the live URL
- README + record the ≤90s demo (script it — see below)
- Buffer: 1–2 hrs for the inevitable last-minute bug

**Demo script (fits in 90s if you don't pause):** upload → cleaned table + cleaning report → set min-score threshold, watch shortlist update → toggle one student to Debarred, watch shortlist update live → click export, show the downloaded CSV.

---

## 14. Judging Criteria Crosswalk

| Criterion | Where this doc addresses it |
|---|---|
| Data Cleaning & Pipeline Robustness | Section 7 — explicit, auditable rules + visible `cleaning_report` |
| UI Functionality & Real-Time Interactivity | Section 9 — optimistic toggle, zero-network client-side filter |
| Time Latency & Performance | Section 10 — measured `processing_ms`, tested at 10k rows, near-0ms toggle |
| Code Quality & Architecture | Sections 5–6 — modular schema/API contract, single deploy, no ORM overhead |
| Documentation & Video Demo | Section 13 demo script, Section 12 deployment caveat stated honestly |

---

## 15. Open Items to Verify Against the Actual Dataset

I couldn't open the Google Sheet directly (it needs your Google auth), so verify these once you do and adjust Section 7 if needed:
- Exact column header spelling/casing in the real CSV
- Whether `Grade` is stored as a number or a string like `"10th"`
- The actual typo patterns present (may need to extend the canonicalization dicts beyond the examples above)

---

Want me to scaffold the actual repo next — `cleaning.py` with the rules above, the FastAPI routes, and the SQLite `store.py`?
