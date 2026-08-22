# Product Requirements: Student Data Pipeline & UI

**Companion doc to:** `student-pipeline-technical-requirements.md` (this file covers *what* and *why*; that one covers *how*)

---

## 1. Problem Statement

Exam cells and admin teams routinely receive student score data as messy exports — inconsistent name casing, typo'd genders/grades, missing marks, sometimes-wrong totals, duplicate entries from re-submissions. Today this gets cleaned by hand in Excel before anyone can apply a score threshold and produce a shortlist. It's slow, error-prone, and every time an eligibility exception comes up (a student needs to be excluded after the list is already built), the whole manual process risks being redone or, worse, quietly skipped.

This product removes the manual cleaning step and makes eligibility exceptions (debarment) a real-time toggle instead of a re-export.

---

## 2. Primary Persona

**Ritu — Exam Cell Coordinator**
- Handles shortlisting for scholarships, merit lists, or eligibility rounds a few times a term.
- Comfortable with Excel, not a technical user — no patience for anything requiring setup, config files, or a manual.
- Currently spends 30–60 minutes per batch manually deduping, fixing typo'd entries, and recalculating totals before she can even start filtering.
- Her biggest fear isn't the cleaning — it's a late exception. A student gets flagged for malpractice *after* the shortlist is built, and she has to remember to manually strike them from every downstream document.
- Success for Ritu = upload the raw file once, trust that the totals and duplicates are handled correctly, and be able to flip a single switch when an exception comes up — without touching the dataset again.

---

## 3. Goals

1. Cut the time from "raw file" to "trustworthy shortlist" from ~30–60 minutes to under 2 minutes.
2. Make every cleaning decision the system makes visible, not silent — Ritu should be able to see *what* was changed, not just trust a black box.
3. Make eligibility exceptions (debar/undebar) instant and reflected everywhere at once — the shortlist, the stats, and the export — with zero re-processing.
4. Require no training. A first-time user should complete the full flow without documentation.

---

## 4. User Stories

| # | Story | Priority |
|---|---|---|
| 1 | As Ritu, I want to upload a raw CSV and have it cleaned automatically, so I don't manually fix typos and duplicates in Excel. | Must |
| 2 | As Ritu, I want to see what the system changed during cleaning (duplicates removed, values fixed), so I can trust the output instead of guessing. | Must |
| 3 | As Ritu, I want to set a minimum total score and instantly see who qualifies, so I can test different thresholds without re-uploading. | Must |
| 4 | As Ritu, I want to see match count and average score update live as I change the threshold, so I get a feel for the distribution without extra clicks. | Must |
| 5 | As Ritu, I want to mark a student as Debarred with one click and have them immediately disappear from the shortlist and any export, so a late exception never slips through. | Must |
| 6 | As Ritu, I want to reverse a debar decision just as easily, in case it was a mistake. | Must |
| 7 | As Ritu, I want to download the final shortlist as a CSV, so I can hand it off or archive it. | Must |
| 8 | As Ritu, I want my work to still be there if I accidentally refresh the page, so I don't lose the current state mid-task. | Should |
| 9 | As Ritu, I want the app to work the same way every time regardless of file size, so I trust it for both a 50-student list and a 2,000-student list. | Should |

---

## 5. Functional Requirements (Product Language)

**Must have (MVP — ships in 2 days):**
- Upload a CSV via a simple, obvious drop zone or file picker
- Automatic cleaning on upload: dedup, typo correction on Gender/Grade, missing-value handling, Total always recalculated — no manual trigger needed
- A visible summary of what the cleaning step changed (counts, not raw logs)
- A clean, readable table of every student post-cleaning
- A single input to set minimum total score, with the shortlist and stats updating as it's changed — no "Apply" button required
- A per-student Active/Debarred control directly in the table
- Debarred students excluded from the shortlist, the stats, and the export immediately, without re-upload
- One-click CSV export of the current filtered, Active-only shortlist

**Should have:**
- State survives a page refresh (doesn't reset to empty)
- Visible performance signal (e.g. "cleaned in 340ms") so speed is demonstrable, not just felt

**Could have (only if Day 1 finishes early):**
- Smarter near-duplicate detection (catching typo'd names, not just exact matches)

**Won't have (this round):**
- Multi-user accounts or login
- Uploading and merging multiple files into one dataset
- Any editing of individual score values by hand (cleaning is automatic only — no manual override of a mark)
- Notifications or emails to students
- Historical comparison across upload batches

---

## 6. Primary User Flow

1. Ritu opens the app — empty state with an upload prompt.
2. She drops in the raw CSV.
3. Within moments, she sees the cleaned table and a short summary ("3 duplicates removed, 2 typos fixed, 1 missing score filled in").
4. She types a minimum total score into the filter field. The shortlist and stats (count, average) update as she types — no button press.
5. She notices one student on the list shouldn't qualify due to an unrelated issue and flips their status to Debarred. The shortlist count drops by one instantly; that student's row visually reflects the change.
6. She clicks Export and gets a CSV of exactly what she's looking at — Active students, above threshold.
7. She closes the tab. If she comes back later, her data and any debar decisions are still there.

**Exception flow — new upload:** if Ritu uploads a new file, it fully replaces the current dataset (this is a single-batch tool, not a multi-batch archive — see Won't Have above). This should be either obvious from the UI or briefly confirmed, so she doesn't lose work by accident.

---

## 7. Non-Functional Requirements (Product-Level)

- **Zero training required.** A first-time user should complete the full flow (upload → filter → debar → export) without instructions.
- **Transparency over automation.** Every automatic cleaning decision should be summarized, not hidden — this is what makes Ritu trust the output enough to skip her manual process.
- **Perceived instancy.** Filtering and toggling should never feel like they're "loading" — this is the core value proposition versus her current Excel workflow.
- **Consistent behavior at scale.** The experience shouldn't degrade meaningfully between a 50-row file and a couple thousand rows.

---

## 8. Success Metrics

| Metric | Target |
|---|---|
| Time from upload to first usable shortlist | Under 2 minutes |
| Clicks required for the full core flow (upload → filter → export) | 5 or fewer |
| Debar/undebar reflected in shortlist + export | Immediate, 0 manual steps |
| Data cleaning errors reaching the final export (wrong Total, uncaught duplicate) | 0 |
| First-time usability | Completable with no documentation |

---

## 9. Assumptions & Constraints

- Single admin, single active dataset at a time — no concurrent multi-user editing to reconcile in this version.
- Dataset sizes are consistent with a typical exam-cell batch (tens to a few thousand rows), not enterprise-scale data.
- Deployed on a free-tier host; state persists across refreshes and normal restarts, but a fresh deployment resets stored data (documented honestly rather than treated as a bug — see the technical requirements doc, Section 12).
- Modern browser assumed; no legacy browser support required.

---

## 10. Future / V2 Roadmap

Not built now, but the natural next steps if this became a real product:

- **Audit trail:** who debarred which student and why, with a timestamp — turns a silent toggle into an accountable decision log.
- **Authentication & roles:** multiple admins, permission levels (e.g. view-only vs. can-debar).
- **Multi-batch history:** compare shortlists across semesters/rounds instead of one dataset at a time.
- **Configurable cleaning rules:** let an admin edit the typo-correction dictionaries themselves instead of them being hardcoded.
- **Bulk ingestion:** upload and merge multiple source files into one batch.
- **Richer export formats:** formatted Excel or PDF report, not just raw CSV.
- **Basic analytics:** score distribution chart, subject-wise breakdowns, so Ritu can sanity-check thresholds visually instead of guessing.
- **Mobile-responsive view** for quick checks away from a desktop.

---

## 11. Definition of Done (MVP)

- [ ] Raw CSV uploads and cleans automatically with no manual step
- [ ] Cleaning summary is visible to the user post-upload
- [ ] Cleaned table renders correctly for the full dataset
- [ ] Min-score filter updates shortlist + stats live, no submit button
- [ ] Debar/undebar toggle updates shortlist, stats, and export eligibility instantly
- [ ] Export produces a CSV matching exactly what's on screen (Active, above threshold)
- [ ] State survives a page refresh
- [ ] Full flow completable in under 2 minutes by someone seeing the app for the first time

---

## 12. Appendix: Mapping to Assessment Judging Criteria

| Judging Criterion | Product Requirement Driving It |
|---|---|
| Data Cleaning & Pipeline Robustness | Section 5 — automatic, and Section 7's transparency requirement |
| UI Functionality & Real-Time Interactivity | Section 6 flow, Section 8's "0 manual steps" metric |
| Time Latency & Performance | Section 7 "perceived instancy," Section 8's 2-minute target |
| Code Quality & Architecture | See technical requirements doc |
| Documentation & Video Demo | This PRD + the technical doc together form the documentation; the flow in Section 6 doubles as your demo script |
