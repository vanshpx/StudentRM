"""
Data cleaning pipeline — all 5 rules live here, nowhere else.
Routes in main.py must not contain any data transformation logic.
"""

import re
import time
from typing import Any

import pandas as pd

# ---------------------------------------------------------------------------
# Canonicalization dictionaries (Rule 2)
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


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_cleaning_pipeline(df_raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Apply all 5 cleaning rules in order and return:
      - cleaned DataFrame
      - cleaning_report dict matching CleaningReport schema

    Rules (in order):
      1. Drop rows with missing Name
      2. Deduplicate by normalized (name, grade)
      3. Canonicalize Gender and Grade
      4. Impute missing numeric values with column median
      5. Recompute Total = Math + Science + English
    """
    t_start = time.perf_counter()

    rows_raw = len(df_raw)
    rows_dropped = 0
    duplicates_removed = 0
    typos_fixed = 0
    values_imputed = 0

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

    # ------------------------------------------------------------------
    # Rule 5 — Drop rows with missing Name (counted as rows_dropped)
    # ------------------------------------------------------------------
    missing_name_mask = df["name"].isna() | (df["name"].astype(str).str.strip() == "")
    rows_dropped = int(missing_name_mask.sum())
    df = df[~missing_name_mask].copy()

    # ------------------------------------------------------------------
    # Rule 1 — Deduplication by normalized (name, grade)
    # ------------------------------------------------------------------
    df["_norm_name"] = (
        df["name"]
        .astype(str)
        .str.strip()
        .str.lower()
        .str.replace(r"\s+", " ", regex=True)
    )
    df["_norm_grade"] = df["grade"].apply(
        lambda g: _normalize_grade(g) if not pd.isna(g) else ""
    )
    before_dedup = len(df)
    df = df.drop_duplicates(subset=["_norm_name", "_norm_grade"], keep="first")
    duplicates_removed = before_dedup - len(df)
    df = df.drop(columns=["_norm_name", "_norm_grade"])

    # ------------------------------------------------------------------
    # Rule 2 — Typo canonicalization: Gender and Grade
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

    # ------------------------------------------------------------------
    # Rule 3 — Missing numeric imputation (median, computed after dedup)
    # ------------------------------------------------------------------
    for col in ["math", "science", "english"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        col_median = df[col].median()
        missing_mask = df[col].isna()
        values_imputed += int(missing_mask.sum())
        df.loc[missing_mask, col] = col_median

    # ------------------------------------------------------------------
    # Rule 4 — Recompute Total (never trust the input column)
    # ------------------------------------------------------------------
    df["total"] = df["math"] + df["science"] + df["english"]

    # Clean up Name: strip and title-case it
    df["name"] = df["name"].astype(str).str.strip().str.title()

    rows_cleaned = len(df)
    processing_ms = round((time.perf_counter() - t_start) * 1000, 2)

    cleaning_report = {
        "rows_raw": rows_raw,
        "rows_cleaned": rows_cleaned,
        "duplicates_removed": duplicates_removed,
        "typos_fixed": typos_fixed,
        "values_imputed": values_imputed,
        "rows_dropped": rows_dropped,
        "processing_ms": processing_ms,
    }

    return df, cleaning_report
