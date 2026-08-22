"""
Data cleaning pipeline — all cleaning rules live here, nowhere else.
Routes in main.py must not contain any data transformation logic.
"""

import logging
import re
import time
from typing import Any

import pandas as pd

logger = logging.getLogger("cleaning")

# ---------------------------------------------------------------------------
# Canonicalization dictionaries (Rule 3 — typo canonicalization)
# ---------------------------------------------------------------------------

GENDER_MAP: dict[str, str] = {
    "m": "Male",
    "male": "Male",
    "f": "Female",
    "female": "Female",
    "other": "Other",
    "o": "Other",
}


def _normalize_gender(raw: Any) -> str | None:
    """Map a raw gender cell to a canonical value, or return None if unknown."""
    if pd.isna(raw) or str(raw).strip() == "":
        return None
    return GENDER_MAP.get(str(raw).strip().lower())


def _normalize_grade(raw: Any) -> str | None:
    """
    Extract the numeric part from grade strings.
    Handles: '10th', 'Grade 10', '10 ', '10', '11th', etc.
    Returns None if the cell is empty/missing.
    """
    if pd.isna(raw) or str(raw).strip() == "":
        return None
    match = re.search(r"\d+", str(raw))
    return match.group(0) if match else str(raw).strip()


def _extract_numeric_score(raw: Any) -> float | None:
    """
    Rule 3 — Score canonicalization.
    Strips non-numeric text from mark cells so values like:
      '24 marks', '24/100', '24 pts', '24.5marks', '85%'
    are all reduced to their numeric part (24.0, 24.0, 24.0, 24.5, 85.0).
    Returns None if the cell is empty/missing or contains no digits.
    """
    if pd.isna(raw) or str(raw).strip() == "":
        return None
    match = re.search(r"\d+(\.\d+)?", str(raw))
    return float(match.group(0)) if match else None


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_cleaning_pipeline(df_raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Apply all 6 cleaning rules in order and return:
      - cleaned DataFrame (includes is_incomplete and is_invalid columns)
      - cleaning_report dict matching CleaningReport schema

    Rules (in order):
      1. Flag rows with missing Name as incomplete (do NOT drop)
      2. Deduplicate only when ALL columns are identical
      3. Canonicalize Gender, Grade, and extract numeric scores
      4. Flag rows with any missing numeric score as incomplete (do NOT impute)
      5. Recompute Total only when Math, Science, and English are all valid
      6. Flag rows where any score > 100 as invalid
    """
    t_start = time.perf_counter()

    rows_raw = len(df_raw)
    duplicates_removed = 0
    typos_fixed = 0
    incomplete_rows = 0
    invalid_rows = 0

    # Work on a copy; normalise column names to lowercase/stripped
    df = df_raw.copy()
    df.columns = [c.strip().lower() for c in df.columns]

    # Map common alternative column names to canonical ones
    col_aliases = {
        "maths": "math",
        "mathematics": "math",
        "sci": "science",
        "eng": "english",
        "grand total": "total",
        "total marks": "total",
        "tot": "total",
        "student name": "name",
        "student_name": "name",
        "sex": "gender",
        "class": "grade",
        "std": "grade",
    }
    df = df.rename(columns=col_aliases)

    # Ensure required columns exist (fill missing ones with NaN)
    for col in ["name", "gender", "grade", "math", "science", "english", "total"]:
        if col not in df.columns:
            df[col] = pd.NA

    # Cast total to float early (we may need to null it out later).
    # Use astype(object) first so that Python None from SQLite rows (append mode)
    # doesn't cause TypeError in pd.to_numeric with mixed-type series.
    df["total"] = pd.to_numeric(df["total"].astype(object), errors="coerce").astype(float)

    # Initialise flag columns as Python bool objects (avoids numpy bool identity issues)
    df["is_incomplete"] = False
    df["is_invalid"] = False

    # ------------------------------------------------------------------
    # Rule 1 — Flag rows with missing Name as incomplete (keep them)
    # ------------------------------------------------------------------
    missing_name_mask = df["name"].isna() | (df["name"].astype(str).str.strip() == "")
    df.loc[missing_name_mask, "is_incomplete"] = True

    # ------------------------------------------------------------------
    # Rule 2 — Strict deduplication: remove only when ALL columns match.
    # Normalize numeric columns to float string so that "85" and "85.0"
    # (which appear from CSV vs SQLite rows in append mode) match correctly.
    # ------------------------------------------------------------------
    def _norm_str(series: pd.Series) -> pd.Series:
        return series.astype(str).str.strip().str.lower().str.replace(r"\s+", " ", regex=True)

    def _norm_score(series: pd.Series) -> pd.Series:
        """
        Canonical numeric string for dedup keying.
        Uses _extract_numeric_score so '66 marks' → 66.0 → '66.0000'
        instead of coercing to NaN → '' which caused false duplicate matches.
        """
        extracted = series.apply(_extract_numeric_score)
        return extracted.apply(lambda v: f"{v:.4f}" if v is not None and pd.notna(v) else "")

    def _norm_name(series: pd.Series) -> pd.Series:
        """Strip surrounding/trailing quotes before lowercasing for dedup key."""
        return (
            series.fillna("")
            .astype(str)
            .str.strip()
            .str.strip("\"'")   # remove quotes that appear in the raw CSV
            .str.strip()
            .str.lower()
            .str.replace(r"\s+", " ", regex=True)
        )

    df["_key"] = (
        _norm_name(df["name"])
        + "|" + _norm_str(df["gender"].fillna(""))
        + "|" + _norm_str(df["grade"].fillna(""))
        + "|" + _norm_score(df["math"])
        + "|" + _norm_score(df["science"])
        + "|" + _norm_score(df["english"])
    )

    before_dedup = len(df)

    # Find which rows are duplicates (not the first occurrence)
    is_dup = df.duplicated(subset=["_key"], keep="first")
    if is_dup.any():
        dup_rows = df[is_dup]
        logger.warning("[DEDUP] %d duplicate row(s) removed:", len(dup_rows))
        for csv_row_num, (_, row) in enumerate(dup_rows.iterrows(), start=1):
            name_val = row.get("name", "(no name)")
            # original 1-based row number in the input (index + 2 accounts for header)
            original_row = row.name + 2  # pandas index is 0-based, +1 for header, +1 for 1-based
            logger.warning(
                "  Row %d (CSV line ~%d): name='%s' gender='%s' grade='%s' "
                "math=%s science=%s english=%s",
                csv_row_num,
                original_row,
                name_val,
                row.get("gender", ""),
                row.get("grade", ""),
                row.get("math", ""),
                row.get("science", ""),
                row.get("english", ""),
            )
    else:
        logger.info("[DEDUP] No duplicates found.")

    df = df.drop_duplicates(subset=["_key"], keep="first")
    duplicates_removed = before_dedup - len(df)
    df = df.drop(columns=["_key"])


    # ------------------------------------------------------------------
    # Rule 3 — Typo canonicalization: Gender, Grade, and Score values
    # ------------------------------------------------------------------
    # Gender
    original_gender = df["gender"].copy()
    df["gender"] = df["gender"].apply(_normalize_gender)
    typos_fixed += int(
        (
            original_gender.astype(str).str.strip().str.lower()
            != df["gender"].fillna("").str.lower()
        ).sum()
    )

    # Grade
    original_grade = df["grade"].copy()
    df["grade"] = df["grade"].apply(_normalize_grade)
    typos_fixed += int(
        (
            original_grade.astype(str).str.strip()
            != df["grade"].fillna("").astype(str)
        ).sum()
    )

    # Score columns — extract numeric part (e.g. "24 marks" → 24.0)
    # This must run on the raw (string) values before any to_numeric cast.
    for col in ["math", "science", "english"]:
        original_col = df[col].copy()
        df[col] = df[col].apply(_extract_numeric_score)
        # Cast to float after extraction
        df[col] = pd.to_numeric(df[col], errors="coerce").astype(float)
        # Count cells where we stripped text (value changed from raw)
        changed = (
            original_col.astype(str).str.strip()
            != df[col].apply(lambda v: f"{v:.10g}" if pd.notna(v) else "None")
        )
        typos_fixed += int(changed.sum())

    # ------------------------------------------------------------------
    # Rule 4 — Flag rows with any missing numeric score (do NOT impute)
    # ------------------------------------------------------------------
    for col in ["math", "science", "english"]:
        missing_mask = df[col].isna()
        df.loc[missing_mask, "is_incomplete"] = True

    # ------------------------------------------------------------------
    # Rule 5 — Recompute Total only when all 3 subject scores are valid
    # ------------------------------------------------------------------
    all_scores_valid = (
        df["math"].notna() & df["science"].notna() & df["english"].notna()
    )
    df.loc[all_scores_valid, "total"] = (
        df.loc[all_scores_valid, "math"]
        + df.loc[all_scores_valid, "science"]
        + df.loc[all_scores_valid, "english"]
    )
    # Where any score is missing, Total must also be null and row is incomplete
    df.loc[~all_scores_valid, "total"] = None
    df.loc[~all_scores_valid, "is_incomplete"] = True

    # ------------------------------------------------------------------
    # Rule 6 — Flag rows where any score > 100 as invalid
    # ------------------------------------------------------------------
    over_limit_mask = (
        (df["math"].notna() & (df["math"] > 100))
        | (df["science"].notna() & (df["science"] > 100))
        | (df["english"].notna() & (df["english"] > 100))
    )
    df.loc[over_limit_mask, "is_invalid"] = True

    # ------------------------------------------------------------------
    # Final cleanup — sanitize and title-case names where present
    # Strips surrounding/trailing quotes and apostrophes that appear in
    # real CSV exports (e.g. "Aarav" → Aarav, Aarav' → Aarav)
    # ------------------------------------------------------------------
    has_name = ~(df["name"].isna() | (df["name"].astype(str).str.strip() == ""))
    df.loc[has_name, "name"] = (
        df.loc[has_name, "name"]
        .astype(str)
        .str.strip()
        .str.strip("\"'")   # remove surrounding/trailing quote characters
        .str.strip()        # strip any whitespace left after quote removal
        .str.title()
    )

    # Tally summary counters
    incomplete_rows = int(df["is_incomplete"].sum())
    invalid_rows = int(df["is_invalid"].sum())

    rows_cleaned = len(df)
    processing_ms = round((time.perf_counter() - t_start) * 1000, 2)

    cleaning_report = {
        "rows_raw": rows_raw,
        "rows_cleaned": rows_cleaned,
        "duplicates_removed": duplicates_removed,
        "typos_fixed": typos_fixed,
        "incomplete_rows": incomplete_rows,
        "invalid_rows": invalid_rows,
        "processing_ms": processing_ms,
    }

    return df, cleaning_report
